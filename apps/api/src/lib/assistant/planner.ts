import type {
	AssistantArtifact,
	AssistantRunRequest,
	AssistantTaskInput,
	AssistantTaskType,
	GenerationMode,
} from '@ai-canvas/shared/types';
import { resolveGenerationMode } from './service';
import { createImageGenerationInput } from './task-execution';

export interface PlannedAssistantTask {
	type: Exclude<AssistantTaskType, 'plan_run'>;
	title: string;
	input: AssistantTaskInput;
}

export interface AssistantPlan {
	resolvedMode: GenerationMode;
	tasks: PlannedAssistantTask[];
}

type PlannerRequest = Pick<
	AssistantRunRequest,
	| 'message'
	| 'contextMode'
	| 'modeHint'
	| 'history'
	| 'prototypeContext'
	| 'contextSnapshot'
	| 'selectedElementIds'
> & {
	vectorizationEnabled?: boolean;
};

function getSelectedContexts(request: PlannerRequest) {
	return request.contextSnapshot?.selectedContexts ?? [];
}

function hasSingleSelectedContextKind(
	request: PlannerRequest,
	kind: 'kanban' | 'markdown',
): boolean {
	const selectedContexts = getSelectedContexts(request);
	return selectedContexts.length === 1 && selectedContexts[0]?.kind === kind;
}

function isCreateNewArtifactIntent(message: string): boolean {
	return /\b(new\s+(board|kanban|note|prototype)|create\s+(a\s+)?new|from this|based on this|turn this into|make (?:a|an)\b)/i.test(
		message,
	);
}

function isEditIntent(message: string): boolean {
	return /\b(add|adjust|change|clean up|condense|convert|edit|expand|fix|improve|move|organize|polish|priorit|refine|rename|reorder|rewrite|summari[sz]e|update)\b/i.test(
		message,
	);
}

function shouldPatchSelectedKanban(request: PlannerRequest): boolean {
	return hasSingleSelectedContextKind(request, 'kanban')
		&& isEditIntent(request.message)
		&& !isCreateNewArtifactIntent(request.message);
}

function shouldPatchSelectedMarkdown(request: PlannerRequest): boolean {
	return hasSingleSelectedContextKind(request, 'markdown')
		&& isEditIntent(request.message)
		&& !isCreateNewArtifactIntent(request.message);
}

function buildTaskTitle(mode: GenerationMode): string {
	switch (mode) {
		case 'mermaid':
			return 'Generate Mermaid draft';
		case 'd2':
			return 'Generate D2 draft';
		case 'kanban':
			return 'Generate Kanban operations';
		case 'prototype':
			return 'Generate prototype files';
		case 'image':
			return 'Prepare image response';
		case 'sketch':
			return 'Prepare sketch response';
		case 'chat':
		default:
			return 'Generate assistant response';
	}
}

function buildImagePipelineTasks(
	mode: GenerationMode,
	options?: { vectorizationEnabled?: boolean },
): PlannedAssistantTask[] {
	const vectorizationEnabled = (options?.vectorizationEnabled ?? false) && mode === 'sketch';
	const includeArtifactTypes: AssistantArtifact['type'][] = vectorizationEnabled
		? ['image', 'image-vector']
		: ['image'];
	const requiredArtifactTypes: AssistantArtifact['type'][] = vectorizationEnabled
		? ['image', 'image-vector']
		: ['image'];
	const requiredTaskTypes: AssistantTaskType[] = vectorizationEnabled
		? ['generate_image', 'vectorize_asset', 'generate_response']
		: ['generate_image', 'generate_response'];
	const summary = vectorizationEnabled
		? 'Generated a sketch preview with an optional vector version ready to insert.'
		: mode === 'sketch'
			? 'Generated a sketch preview ready to insert.'
			: 'Generated an image preview ready to insert.';

	const tasks: PlannedAssistantTask[] = [
		{
			type: 'generate_image',
			title: mode === 'sketch' ? 'Generate sketch source image' : 'Generate source image',
			input: createImageGenerationInput('', mode as Extract<GenerationMode, 'image' | 'sketch'>),
		},
	];

	if (vectorizationEnabled) {
		tasks.push({
			type: 'vectorize_asset',
			title: 'Vectorize generated asset',
			input: {
				kind: 'vectorize_asset',
				sourceArtifactType: 'image',
				outputTitle: 'Vectorized generated asset',
			},
		});
	}

	tasks.push(
		{
			type: 'generate_response',
			title: buildTaskTitle(mode),
			input: {
				kind: 'generate_response',
				resolvedMode: mode,
				includeArtifactTypes,
				summary,
			},
		},
		{
			type: 'verify_run',
			title: 'Verify generated output',
			input: {
				kind: 'verify_run',
				requiredTaskTypes,
				requiredArtifactTypes,
				requireResultMessage: true,
			},
		},
	);

	return tasks;
}

function buildDiagramTasks(mode: Extract<GenerationMode, 'mermaid' | 'd2'>): PlannedAssistantTask[] {
	return [
		{
			type: 'generate_response',
			title: buildTaskTitle(mode),
			input: {
				kind: 'generate_response',
				resolvedMode: mode,
				includeArtifactTypes: [mode],
				summary:
					mode === 'mermaid'
						? 'Prepared a Mermaid draft and rendered diagram output.'
						: 'Prepared a D2 draft and rendered diagram output.',
			},
		},
		{
			type: 'place_canvas_artifact',
			title: 'Build placement plan',
			input: {
				kind: 'place_canvas_artifact',
				targetArtifactTypes: [mode],
				title: 'Canvas placement plan',
				strategy: 'avoid-overlap',
			},
		},
		{
			type: 'verify_run',
			title: 'Verify generated output',
			input: {
				kind: 'verify_run',
				requiredTaskTypes: ['generate_response', 'place_canvas_artifact'],
				requiredArtifactTypes: [mode],
				requireResultMessage: true,
			},
		},
	];
}

export function planAssistantRun(request: PlannerRequest): AssistantPlan {
	const resolvedMode = resolveGenerationMode({
		message: request.message,
		contextMode: request.contextMode,
		generationMode: request.modeHint,
		history: request.history,
	});

	const imageTasks =
		resolvedMode === 'image' || resolvedMode === 'sketch'
			? buildImagePipelineTasks(resolvedMode, {
					vectorizationEnabled: request.vectorizationEnabled,
				}).map((task) =>
					task.type === 'generate_image'
						? {
								...task,
								input: createImageGenerationInput(
									request.message,
									resolvedMode as Extract<GenerationMode, 'image' | 'sketch'>,
									request.history,
								),
						  }
						: task,
			  )
			: null;

	return {
		resolvedMode,
		tasks:
			imageTasks
				? imageTasks
				: resolvedMode === 'mermaid' || resolvedMode === 'd2'
					? buildDiagramTasks(resolvedMode)
				: (() => {
						const shouldPatchKanban = resolvedMode === 'kanban' && shouldPatchSelectedKanban(request);
						const shouldPatchMarkdown = resolvedMode === 'chat' && shouldPatchSelectedMarkdown(request);
						const includeArtifactTypes: AssistantArtifact['type'][] =
							resolvedMode === 'kanban'
								? shouldPatchKanban
									? ['kanban-patch']
									: ['kanban-ops']
								: resolvedMode === 'prototype'
									? ['prototype-files']
									: shouldPatchMarkdown
										? ['markdown-patch']
										: [];
						const isInsertableCreation =
							(resolvedMode === 'kanban' && !shouldPatchKanban)
							|| resolvedMode === 'prototype';
						const targetArtifactTypes: AssistantArtifact['type'][] =
							resolvedMode === 'kanban' && !shouldPatchKanban
								? ['kanban-ops']
								: resolvedMode === 'prototype'
									? ['prototype-files']
									: [];
						return [
							{
								type: 'generate_response',
								title: buildTaskTitle(resolvedMode),
								input: {
									kind: 'generate_response',
									resolvedMode,
									includeArtifactTypes,
									summary:
										resolvedMode === 'kanban'
											? shouldPatchKanban
												? 'Prepared a reversible Kanban patch for the selected board.'
												: 'Prepared a new Kanban board for insertion onto the canvas.'
											: resolvedMode === 'prototype'
												? 'Prepared prototype files for the canvas.'
												: shouldPatchMarkdown
													? 'Prepared a reversible markdown patch for the selected note.'
													: 'Prepared an assistant response for the canvas.',
								},
							},
							...(isInsertableCreation
								? [
										{
											type: 'place_canvas_artifact' as const,
											title: 'Build placement plan',
											input: {
												kind: 'place_canvas_artifact' as const,
												targetArtifactTypes,
												title: 'Canvas placement plan',
												strategy: 'avoid-overlap' as const,
											},
										},
								  ]
								: []),
							{
								type: 'verify_run',
								title: 'Verify generated output',
								input: {
									kind: 'verify_run',
									requiredTaskTypes: [
										'generate_response',
										...(isInsertableCreation ? (['place_canvas_artifact'] as const) : []),
									],
									requiredArtifactTypes: includeArtifactTypes,
									requireResultMessage: true,
								},
							},
						];
				  })(),
	};
}
