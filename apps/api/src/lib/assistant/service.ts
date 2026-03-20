import { normalizeKanbanOverlay, normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type {
	AssistantArtifact,
	AssistantMessage,
	GenerationMode,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';
import { nanoid } from 'nanoid';
import { createAnthropicMessage } from './anthropic';
import { summarizeAssistantContextSnapshot } from './context';
export { resolveGenerationMode } from './generation-mode';
import {
	buildAnthropicConversation,
	getLastDiagramArtifact,
	getLastSvgSource,
	resolveGenerationMode,
} from './generation-mode';
import {
	buildD2EditPrompt,
	buildD2Prompt,
	buildKanbanPrompt,
	buildMermaidEditPrompt,
	buildMermaidPrompt,
	buildPrototypePrompt,
	buildSvgEditPrompt,
	buildSvgPrompt,
	extractCodeBlock,
} from './parsing';
import {
	buildChatDraft,
	buildD2Draft,
	buildD2DraftFromHistory,
	buildImageRunDraft,
	buildKanbanDraft,
	buildMermaidDraft,
	buildMermaidDraftFromHistory,
	buildSvgPlaceholderDraft,
} from './service/fallback-drafts';
import { parsePrototypeArtifactContent, serializePrototypeArtifact } from './service/prototype-helpers';
import { executePrototypeRun } from './service/prototype-runner';
import { buildSelectedEditDraft } from './service/selection-edits';
import type { AssistantDraft, AssistantServiceInput, AssistantServiceResult } from './types';

function buildDraft(input: AssistantServiceInput): AssistantDraft {
	switch (resolveGenerationMode(input)) {
		case 'mermaid':
			return (
				buildMermaidDraftFromHistory(input) ?? buildMermaidDraft(input.message, input.contextMode)
			);
		case 'd2':
			return buildD2DraftFromHistory(input) ?? buildD2Draft(input.message, input.contextMode);
		case 'kanban':
			return buildKanbanDraft(input);
		case 'image':
			return buildImageRunDraft(input, 'image');
		case 'sketch':
			return buildImageRunDraft(input, 'sketch');
		case 'svg':
			return buildSvgPlaceholderDraft(input);
		case 'prototype':
			return {
				content: [
					'Prototype generation requires a valid AI-authored prototype JSON payload.',
					'No prototype was created because the model response was unavailable or invalid.',
				].join('\n\n'),
			};
		case 'chat':
		default:
			return buildChatDraft(input);
	}
}

async function buildAnthropicDraft(input: AssistantServiceInput): Promise<AssistantDraft | null> {
	if (!input.bindings?.ANTHROPIC_API_KEY) {
		return null;
	}

	const generationMode = resolveGenerationMode(input);
	const contextSnapshotSummary =
		input.contextMode === 'none' ? null : summarizeAssistantContextSnapshot(input.contextSnapshot);
	const systemPrompt = [
		'You are AI Canvas, an assistant that prepares structured outputs for a canvas-based workspace.',
		'Prefer concise, directly usable outputs.',
		...(input.contextMode !== 'none'
			? [
					`Current context mode: ${input.contextMode === 'selected' ? 'selected elements' : 'whole canvas'}.`,
				]
			: []),
		...(contextSnapshotSummary ? [contextSnapshotSummary] : []),
	].join('\n');

	if (generationMode === 'mermaid') {
		const previous = getLastDiagramArtifact(input.history);
		const completion = await createAnthropicMessage(input.bindings, {
			system: systemPrompt,
			messages: buildAnthropicConversation(
				input,
				previous?.mode === 'mermaid'
					? buildMermaidEditPrompt(input.message, previous.content)
					: buildMermaidPrompt(input.message),
			),
		});
		const code = extractCodeBlock(completion.text, 'mermaid');
		if (!code) {
			return null;
		}
		return {
			content: ['Generated a Mermaid diagram draft:', '', '```mermaid', code, '```'].join('\n'),
			artifacts: [{ type: 'mermaid', content: code }],
		};
	}

	if (generationMode === 'd2') {
		const previous = getLastDiagramArtifact(input.history);
		const completion = await createAnthropicMessage(input.bindings, {
			system: systemPrompt,
			messages: buildAnthropicConversation(
				input,
				previous?.mode === 'd2'
					? buildD2EditPrompt(input.message, previous.content)
					: buildD2Prompt(input.message),
			),
		});
		const code = extractCodeBlock(completion.text, 'd2');
		if (!code) {
			return null;
		}
		return {
			content: ['Generated a D2 diagram draft:', '', '```d2', code, '```'].join('\n'),
			artifacts: [{ type: 'd2', content: code }],
		};
	}

	if (generationMode === 'kanban') {
		const completion = await createAnthropicMessage(input.bindings, {
			system: systemPrompt,
			messages: buildAnthropicConversation(input, buildKanbanPrompt(input.message)),
		});
		const json = extractCodeBlock(completion.text, 'json');
		if (!json) {
			return null;
		}
		return {
			content: ['Generated kanban operations:', '', '```json', json, '```'].join('\n'),
			artifacts: [{ type: 'kanban-ops', content: json }],
		};
	}

	if (generationMode === 'prototype') {
		const prototypeRun = await executePrototypeRun({
			input: {
				...input,
				bindings: input.bindings,
			},
			systemPrompt,
		});
		if (!prototypeRun.ok) {
			return {
				content: [
					`Prototype generation failed validation after ${prototypeRun.attempts} attempt${prototypeRun.attempts === 1 ? '' : 's'}.`,
					'',
					'Last validation issues:',
					...prototypeRun.diagnostics
						.slice(0, 8)
						.map((diagnostic) =>
							`- ${diagnostic.path ? `${diagnostic.path}${diagnostic.line ? `:${diagnostic.line}` : ''}` : diagnostic.source}: ${diagnostic.message}`,
						),
				].join('\n'),
			};
		}
		return {
			content: [
				'Prepared prototype files for the canvas.',
				'',
				`Prototype: ${prototypeRun.prototype.title}`,
				...(prototypeRun.attempts > 1
					? [`Validation passes: ${prototypeRun.attempts}`]
					: []),
				'',
				'The response includes a full multi-file prototype payload for the custom runtime.',
			].join('\n'),
			artifacts: [
				{
					type: 'prototype-files',
					content: serializePrototypeArtifact(prototypeRun.prototype),
				},
			],
		};
	}

	if (generationMode === 'svg') {
		const previous = getLastSvgSource(input.history);
		const completion = await createAnthropicMessage(input.bindings, {
			system: [
				systemPrompt,
				'When the user asks for an SVG, produce vector-friendly illustration markup only.',
			].join('\n'),
			messages: buildAnthropicConversation(
				input,
				previous ? buildSvgEditPrompt(input.message, previous) : buildSvgPrompt(input.message),
			),
			maxTokens: 3000,
		});
		const svg = extractCodeBlock(completion.text, 'svg');
		if (!svg) {
			return null;
		}
		return {
			content: [
				'Prepared an SVG illustration draft for the canvas.',
				'',
				'```svg',
				svg,
				'```',
			].join('\n'),
		};
	}

	if (generationMode === 'chat') {
		const completion = await createAnthropicMessage(input.bindings, {
			system: systemPrompt,
			messages: buildAnthropicConversation(input, input.message),
		});
		if (!completion.text.trim()) {
			return null;
		}
		return {
			content: completion.text.trim(),
		};
	}

	if (generationMode === 'image' || generationMode === 'sketch') {
		const completion = await createAnthropicMessage(input.bindings, {
			system: systemPrompt,
			messages: buildAnthropicConversation(
				input,
				generationMode === 'sketch'
					? `Summarize the intended sketch output and canvas context for this request:\n${input.message}`
					: `Summarize the intended generated image output and canvas context for this request:\n${input.message}`,
			),
		});
		if (!completion.text.trim()) {
			return null;
		}
		return {
			content: completion.text.trim(),
		};
	}

	return null;
}

export async function generateAssistantResponse(
	input: AssistantServiceInput,
): Promise<AssistantServiceResult> {
	const generationMode = resolveGenerationMode(input);
	const selectedEditDraft = await buildSelectedEditDraft(input, generationMode);
	const draft = selectedEditDraft ?? (await buildAnthropicDraft(input)) ?? buildDraft(input);

	const message: AssistantMessage = {
		id: nanoid(),
		role: 'assistant',
		content: draft.content,
		generationMode,
		artifacts: (draft.artifacts ?? []) as AssistantArtifact[],
		createdAt: new Date().toISOString(),
	};

	return { message };
}
