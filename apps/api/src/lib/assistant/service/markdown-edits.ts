import type {
	AssistantArtifact,
	AssistantMarkdownPatchArtifact,
	AssistantSelectedContext,
} from '@ai-canvas/shared/types';
import { createAnthropicMessage } from '../anthropic';
import { buildMarkdownRewritePrompt, extractCodeBlock } from '../parsing';
import type { AssistantServiceInput } from '../types';
import { normalizeSource, truncateLabel } from './service-utils';

export function normalizeMarkdownComparableText(value: string): string {
	return value
		.toLowerCase()
		.replace(/[`*_>#-]/g, ' ')
		.replace(/\[[ xX]\]/g, ' ')
		.replace(/[^\w\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function extractMarkdownResponseContent(value: string): string {
	return extractCodeBlock(value, 'markdown') ?? value.trim();
}

function extractRemovalSectionTarget(message: string): string | null {
	const match = message.match(/\bremove\s+(?:the\s+)?(.+?)\s+section\b/i);
	return match?.[1]?.trim() || null;
}

function removeMarkdownSection(
	content: string,
	targetSection: string,
): { content: string; removed: boolean } {
	const lines = content.split('\n');
	const normalizedTarget = normalizeMarkdownComparableText(targetSection);
	const headingPattern = /^\s{0,3}(#{1,6})\s+(.*)$/;
	const startIndex = lines.findIndex((line) => {
		const match = line.match(headingPattern);
		return match && normalizeMarkdownComparableText(match[2] ?? '') === normalizedTarget;
	});

	if (startIndex === -1) {
		return { content, removed: false };
	}

	const startLevel = lines[startIndex]?.match(headingPattern)?.[1].length ?? 1;
	let endIndex = lines.length;
	for (let index = startIndex + 1; index < lines.length; index += 1) {
		const match = lines[index]?.match(headingPattern);
		if (match && match[1].length <= startLevel) {
			endIndex = index;
			break;
		}
	}

	const nextLines = [...lines.slice(0, startIndex), ...lines.slice(endIndex)];
	return {
		content: nextLines
			.join('\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim(),
		removed: true,
	};
}

function extractUnavailableItems(message: string): string[] {
	const patterns = [
		/\b(?:do not have|don't have|dont have|without|no)\s+(.+?)(?:[?.!]|$)/i,
		/\bremove\s+(?:the\s+)?(.+?)(?:\s+from\b|[?.!]|$)/i,
	];

	for (const pattern of patterns) {
		const match = message.match(pattern);
		if (!match?.[1]) {
			continue;
		}

		return match[1]
			.split(/,| and | or /i)
			.map((item) =>
				item
					.replace(
						/\b(the|a|an|any|section|list|grocery|groceries|ingredients?|please|actually|can you|could you)\b/gi,
						' ',
					)
					.replace(/\s+/g, ' ')
					.trim(),
			)
			.filter((item) => item.length > 1);
	}

	return [];
}

function removeMarkdownListItems(
	currentContent: string,
	targets: string[],
): { content: string; removedCount: number } {
	if (targets.length === 0) {
		return { content: currentContent, removedCount: 0 };
	}

	const normalizedTargets = targets.map((target) => normalizeMarkdownComparableText(target));
	const lines = currentContent.split('\n');
	let removedCount = 0;
	const nextLines = lines.filter((line) => {
		if (!/^(\s*)[-*+]\s|^(\s*)\d+\.\s/.test(line) && !/^\s*[-*+]\s+\[[ xX]\]\s/.test(line)) {
			return true;
		}

		const comparableLine = normalizeMarkdownComparableText(line);
		const shouldRemove = normalizedTargets.some(
			(target) => comparableLine.includes(target) || target.includes(comparableLine),
		);
		if (shouldRemove) {
			removedCount += 1;
			return false;
		}

		return true;
	});

	return {
		content: nextLines
			.join('\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim(),
		removedCount,
	};
}

function buildMarkdownPatchResult(
	currentContent: string,
	message: string,
): { content: string; summary: string } {
	const sectionTarget = extractRemovalSectionTarget(message);
	if (sectionTarget) {
		const sectionRemoval = removeMarkdownSection(currentContent, sectionTarget);
		if (sectionRemoval.removed) {
			return {
				content: sectionRemoval.content,
				summary: `Removes the "${truncateLabel(sectionTarget, 40)}" section from the selected markdown note.`,
			};
		}
	}

	const unavailableItems = extractUnavailableItems(message);
	if (unavailableItems.length > 0) {
		const listRemoval = removeMarkdownListItems(currentContent, unavailableItems);
		if (listRemoval.removedCount > 0) {
			return {
				content: listRemoval.content,
				summary:
					listRemoval.removedCount === 1
						? 'Removes one matching list item from the selected markdown note.'
						: `Removes ${listRemoval.removedCount} matching list items from the selected markdown note.`,
			};
		}
	}

	const normalized = normalizeSource(currentContent);
	const sectionTitle = /summari[sz]e/i.test(message) ? 'AI Summary' : 'AI Update';
	const note = truncateLabel(message, 160);
	const separator = normalized.length > 0 ? '\n\n' : '';
	return {
		content: `${normalized}${separator}## ${sectionTitle}\n\n- ${note}\n`.trim(),
		summary: /summari[sz]e/i.test(message)
			? 'Adds an AI summary section to the selected markdown note.'
			: 'Adds an AI update section to the selected markdown note.',
	};
}

function validateMarkdownRewrite(params: {
	original: string;
	rewritten: string;
	message: string;
}): boolean {
	const rewritten = normalizeSource(params.rewritten);
	const original = normalizeSource(params.original);
	if (!rewritten || rewritten.length < 8) {
		return false;
	}

	if (rewritten === original) {
		return false;
	}

	const normalizedPrompt = normalizeMarkdownComparableText(params.message);
	const normalizedRewrite = normalizeMarkdownComparableText(rewritten);
	if (
		normalizedPrompt.length > 0 &&
		normalizedRewrite.includes(normalizedPrompt) &&
		rewritten.length < original.length + Math.max(60, params.message.length * 2)
	) {
		return false;
	}

	const sectionTarget = extractRemovalSectionTarget(params.message);
	if (sectionTarget) {
		const normalizedSection = normalizeMarkdownComparableText(sectionTarget);
		const stillHasSection = rewritten.split('\n').some((line) => {
			const match = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
			return match && normalizeMarkdownComparableText(match[2] ?? '') === normalizedSection;
		});
		if (stillHasSection) {
			return false;
		}
	}

	const unavailableItems = extractUnavailableItems(params.message);
	if (unavailableItems.length > 0) {
		const normalizedRewriteLines = rewritten
			.split('\n')
			.map((line) => normalizeMarkdownComparableText(line));
		const stillHasUnavailableItem = unavailableItems.some((item) => {
			const normalizedItem = normalizeMarkdownComparableText(item);
			return normalizedRewriteLines.some((line) => line.includes(normalizedItem));
		});
		if (stillHasUnavailableItem) {
			return false;
		}
	}

	return true;
}

export async function buildSelectedMarkdownDraft(
	context: Extract<AssistantSelectedContext, { kind: 'markdown' }>,
	message: string,
	bindings?: AssistantServiceInput['bindings'],
): Promise<AssistantArtifact> {
	let patchResult: { content: string; summary: string } | null = null;

	if (bindings?.ANTHROPIC_API_KEY) {
		try {
			const completion = await createAnthropicMessage(bindings, {
				system: [
					'You are AI Canvas, editing a selected markdown note.',
					'Produce exact, useful document rewrites with no meta commentary.',
					'Return only the revised markdown document.',
				].join('\n'),
				messages: [
					{
						role: 'user',
						content: buildMarkdownRewritePrompt(message, context.markdown.content),
					},
				],
				maxTokens: 2200,
			});
			const rewrittenMarkdown = extractMarkdownResponseContent(completion.text);
			if (
				validateMarkdownRewrite({
					original: context.markdown.content,
					rewritten: rewrittenMarkdown,
					message,
				})
			) {
				patchResult = {
					content: rewrittenMarkdown,
					summary: 'Rewrites the selected markdown note to satisfy the edit request.',
				};
			}
		} catch {
			// Fall back to the local structural editor if model-assisted rewriting fails.
		}
	}

	if (!patchResult) {
		patchResult = buildMarkdownPatchResult(context.markdown.content, message);
	}
	const patch: AssistantMarkdownPatchArtifact = {
		kind: 'markdown_patch',
		targetId: context.id,
		summary: patchResult.summary,
		base: {
			title: context.markdown.title,
			content: context.markdown.content,
		},
		next: {
			title: context.markdown.title,
			content: patchResult.content,
			images: context.markdown.images,
			settings: context.markdown.settings,
			editorMode: context.markdown.editorMode,
		},
	};

	return {
		type: 'markdown-patch',
		content: JSON.stringify(patch, null, 2),
	};
}
