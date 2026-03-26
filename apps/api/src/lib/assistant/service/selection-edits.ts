import type {
	AssistantArtifact,
	AssistantSelectedContext,
	GenerationMode,
} from '@ai-canvas/shared/types';
import type { AssistantDraft, AssistantServiceInput } from '../types';
import { buildSelectedKanbanDraft } from './kanban-edits';
import { buildSelectedMarkdownDraft } from './markdown-edits';
import {
	isCreateNewArtifactIntent,
	isEditableSelectionRequest,
	sentenceCase,
} from './service-utils';

function getSelectedEditableContexts(input: AssistantServiceInput): AssistantSelectedContext[] {
	return (input.contextSnapshot?.selectedContexts ?? []).filter(
		(context) => context.kind === 'markdown' || context.kind === 'kanban',
	);
}

export async function buildSelectedEditDraft(
	input: AssistantServiceInput,
	generationMode: GenerationMode,
): Promise<AssistantDraft | null> {
	if (!isEditableSelectionRequest(input.message) || isCreateNewArtifactIntent(input.message)) {
		return null;
	}

	const editableContexts = getSelectedEditableContexts(input);
	if (editableContexts.length === 0) {
		return null;
	}

	if (editableContexts.length > 1) {
		const labels = editableContexts
			.map((context) => context.label ?? context.id)
			.slice(0, 4)
			.join(', ');
		return {
			content: [
				'I found more than one editable selected item, so I did not apply a patch automatically.',
				'',
				`Selected editable items: ${labels}.`,
				'Please narrow the selection or name the specific board or note you want me to change.',
			].join('\n'),
		};
	}

	const artifacts: AssistantArtifact[] = [];
	for (const context of editableContexts) {
		if (context.kind === 'markdown' && generationMode === 'chat') {
			artifacts.push(await buildSelectedMarkdownDraft(context, input.message, input.bindings));
			continue;
		}

		if (context.kind === 'kanban' && (generationMode === 'chat' || generationMode === 'kanban')) {
			artifacts.push(await buildSelectedKanbanDraft(context, input.message, input.bindings));
		}
	}

	if (artifacts.length === 0) {
		return null;
	}

	const artifactLabels = artifacts.map((artifact) =>
		artifact.type === 'markdown-patch' ? 'markdown patch' : 'kanban patch',
	);

	return {
		content: [
			'Prepared reversible selection edits.',
			'',
			`Request: ${sentenceCase(input.message)}`,
			'',
			`Ready to apply: ${artifactLabels.join(', ')}.`,
			'Use the patch cards below to apply, undo, or reapply each change.',
		].join('\n'),
		artifacts,
	};
}
