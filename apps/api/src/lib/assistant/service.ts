import type { AssistantArtifact, AssistantMessage, GenerationMode } from '@ai-canvas/shared/types';
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
import { serializePrototypeArtifact } from './service/prototype-helpers';
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
		default:
			return buildChatDraft(input);
	}
}

function buildAnthropicSystemPrompt(input: AssistantServiceInput): string {
	const contextSnapshotSummary =
		input.contextMode === 'none' ? null : summarizeAssistantContextSnapshot(input.contextSnapshot);

	return [
		'You are AI Canvas, an assistant that prepares structured outputs for a canvas-based workspace.',
		'Prefer concise, directly usable outputs.',
		...(input.contextMode !== 'none'
			? [
					`Current context mode: ${input.contextMode === 'selected' ? 'selected elements' : 'whole canvas'}.`,
				]
			: []),
		...(contextSnapshotSummary ? [contextSnapshotSummary] : []),
	].join('\n');
}

async function buildMermaidAnthropicDraft(
	input: AssistantServiceInput,
	systemPrompt: string,
): Promise<AssistantDraft | null> {
	const previous = getLastDiagramArtifact(input.history);
	const completion = await createAnthropicMessage(input.bindings!, {
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

async function buildD2AnthropicDraft(
	input: AssistantServiceInput,
	systemPrompt: string,
): Promise<AssistantDraft | null> {
	const previous = getLastDiagramArtifact(input.history);
	const completion = await createAnthropicMessage(input.bindings!, {
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

async function buildKanbanAnthropicDraft(
	input: AssistantServiceInput,
	systemPrompt: string,
): Promise<AssistantDraft | null> {
	const completion = await createAnthropicMessage(input.bindings!, {
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

async function buildPrototypeAnthropicDraft(
	input: AssistantServiceInput,
	systemPrompt: string,
): Promise<AssistantDraft> {
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
				...prototypeRun.diagnostics.slice(0, 8).map((diagnostic) => {
					const location = diagnostic.path
						? `${diagnostic.path}${diagnostic.line ? `:${diagnostic.line}` : ''}`
						: diagnostic.source;
					return `- ${location}: ${diagnostic.message}`;
				}),
			].join('\n'),
		};
	}

	return {
		content: [
			'Prepared prototype files for the canvas.',
			'',
			`Prototype: ${prototypeRun.prototype.title}`,
			...(prototypeRun.attempts > 1 ? [`Validation passes: ${prototypeRun.attempts}`] : []),
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

async function buildSvgAnthropicDraft(
	input: AssistantServiceInput,
	systemPrompt: string,
): Promise<AssistantDraft | null> {
	const previous = getLastSvgSource(input.history);
	const completion = await createAnthropicMessage(input.bindings!, {
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
		content: ['Prepared an SVG illustration draft for the canvas.', '', '```svg', svg, '```'].join(
			'\n',
		),
	};
}

async function buildChatAnthropicDraft(
	input: AssistantServiceInput,
	systemPrompt: string,
): Promise<AssistantDraft | null> {
	const completion = await createAnthropicMessage(input.bindings!, {
		system: systemPrompt,
		messages: buildAnthropicConversation(input, input.message),
	});
	const content = completion.text.trim();
	if (!content) {
		return null;
	}

	return { content };
}

async function buildImageSummaryAnthropicDraft(
	input: AssistantServiceInput,
	systemPrompt: string,
	mode: Extract<GenerationMode, 'image' | 'sketch'>,
): Promise<AssistantDraft | null> {
	const completion = await createAnthropicMessage(input.bindings!, {
		system: systemPrompt,
		messages: buildAnthropicConversation(
			input,
			mode === 'sketch'
				? `Summarize the intended sketch output and canvas context for this request:\n${input.message}`
				: `Summarize the intended generated image output and canvas context for this request:\n${input.message}`,
		),
	});
	const content = completion.text.trim();
	if (!content) {
		return null;
	}

	return { content };
}

async function buildAnthropicDraft(input: AssistantServiceInput): Promise<AssistantDraft | null> {
	if (!input.bindings?.ANTHROPIC_API_KEY) {
		return null;
	}

	const generationMode = resolveGenerationMode(input);
	const systemPrompt = buildAnthropicSystemPrompt(input);

	switch (generationMode) {
		case 'mermaid':
			return buildMermaidAnthropicDraft(input, systemPrompt);
		case 'd2':
			return buildD2AnthropicDraft(input, systemPrompt);
		case 'kanban':
			return buildKanbanAnthropicDraft(input, systemPrompt);
		case 'prototype':
			return buildPrototypeAnthropicDraft(input, systemPrompt);
		case 'svg':
			return buildSvgAnthropicDraft(input, systemPrompt);
		case 'chat':
			return buildChatAnthropicDraft(input, systemPrompt);
		case 'image':
		case 'sketch':
			return buildImageSummaryAnthropicDraft(input, systemPrompt, generationMode);
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
