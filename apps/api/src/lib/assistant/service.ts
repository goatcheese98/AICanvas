import { nanoid } from 'nanoid';
import type { AssistantArtifact, AssistantMessage } from '@ai-canvas/shared/types';
import type { AssistantDraft, AssistantServiceInput, AssistantServiceResult } from './types';

function sentenceCase(text: string): string {
	const trimmed = text.trim().replace(/\s+/g, ' ');
	if (!trimmed) return 'Untitled';
	return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function slug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
		.slice(0, 24) || 'node';
}

function buildMermaidDraft(message: string, contextMode: AssistantServiceInput['contextMode']): AssistantDraft {
	const title = sentenceCase(message);
	const root = slug(title);
	const contextNode = contextMode === 'selected' ? 'selected_context' : 'canvas_context';
	const code = [
		'flowchart TD',
		`  ${root}["${title}"]`,
		`  ${contextNode}["${contextMode === 'selected' ? 'Selected elements' : 'Canvas context'}"]`,
		'  next_step["Next step"]',
		`  ${contextNode} --> ${root}`,
		`  ${root} --> next_step`,
	].join('\n');

	return {
		content: ['Generated a Mermaid diagram draft:', '', '```mermaid', code, '```'].join('\n'),
		artifacts: [{ type: 'mermaid', content: code }],
	};
}

function buildD2Draft(message: string, contextMode: AssistantServiceInput['contextMode']): AssistantDraft {
	const title = sentenceCase(message);
	const code = [
		'title: "AI Canvas Diagram"',
		`request: "${title}"`,
		`${contextMode}: "${contextMode === 'selected' ? 'Selected elements' : 'Canvas context'}"`,
		'result: "Suggested output"',
		`${contextMode} -> request`,
		'request -> result',
	].join('\n');

	return {
		content: ['Generated a D2 diagram draft:', '', '```d2', code, '```'].join('\n'),
		artifacts: [{ type: 'd2', content: code }],
	};
}

function buildKanbanDraft(message: string): AssistantDraft {
	const title = sentenceCase(message);
	const ops = [
		{
			op: 'add_column',
			column: { id: 'ai-next', title: 'AI Next', cards: [] },
		},
		{
			op: 'add_card',
			columnId: 'ai-next',
			card: {
				title,
				description: 'Generated from the assistant request',
				priority: 'medium',
			},
		},
	];
	const serialized = JSON.stringify(ops, null, 2);

	return {
		content: ['Generated kanban operations:', '', '```json', serialized, '```'].join('\n'),
		artifacts: [{ type: 'kanban-ops', content: serialized }],
	};
}

function buildChatDraft(message: string, contextMode: AssistantServiceInput['contextMode']): AssistantDraft {
	return {
		content: [
			`Working in ${contextMode === 'selected' ? 'selected-context' : 'whole-canvas'} mode.`,
			'',
			`Request: ${sentenceCase(message)}`,
			'',
			'Suggested next step: turn this into a structured overlay, diagram, or kanban operation if you want a concrete canvas mutation.',
		].join('\n'),
	};
}

function buildDraft(input: AssistantServiceInput): AssistantDraft {
	switch (input.generationMode) {
		case 'mermaid':
			return buildMermaidDraft(input.message, input.contextMode);
		case 'd2':
			return buildD2Draft(input.message, input.contextMode);
		case 'kanban':
			return buildKanbanDraft(input.message);
		case 'image':
		case 'sketch':
			return {
				content: 'Image and sketch generation are not ported yet. The assistant service is ready for text, Mermaid, D2, and Kanban flows first.',
			};
		case 'chat':
		default:
			return buildChatDraft(input.message, input.contextMode);
	}
}

export async function generateAssistantResponse(
	input: AssistantServiceInput,
): Promise<AssistantServiceResult> {
	const draft = buildDraft(input);

	const message: AssistantMessage = {
		id: nanoid(),
		role: 'assistant',
		content: draft.content,
		generationMode: input.generationMode,
		artifacts: (draft.artifacts ?? []) as AssistantArtifact[],
		createdAt: new Date().toISOString(),
	};

	return { message };
}
