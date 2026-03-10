import type {
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
	'message' | 'contextMode' | 'modeHint' | 'history' | 'prototypeContext' | 'contextSnapshot'
>;

function hasSelectedKanbanContext(request: PlannerRequest): boolean {
	return request.contextMode === 'selected'
		&& (request.contextSnapshot?.selectedContexts ?? []).some((context) => context.kind === 'kanban');
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

function buildImagePipelineTasks(mode: GenerationMode): PlannedAssistantTask[] {
	return [
		{
			type: 'generate_image',
			title: mode === 'sketch' ? 'Generate sketch source image' : 'Generate source image',
			input: createImageGenerationInput('', mode as Extract<GenerationMode, 'image' | 'sketch'>),
		},
		{
			type: 'vectorize_asset',
			title: 'Vectorize generated asset',
			input: {
				kind: 'vectorize_asset',
				sourceArtifactType: 'image',
				outputTitle: 'Vectorized generated asset',
			},
		},
		{
			type: 'create_markdown_overlay',
			title: 'Create markdown overlay draft',
			input: {
				kind: 'create_markdown_overlay',
				resolvedMode: mode,
				sourceArtifactTypes: ['image', 'image-vector'],
				title: 'Generated asset markdown brief',
			},
		},
		{
			type: 'place_canvas_artifact',
			title: 'Build placement plan',
			input: {
				kind: 'place_canvas_artifact',
				targetArtifactTypes: ['image-vector', 'markdown'],
				title: 'Canvas placement plan',
				strategy: 'avoid-overlap',
			},
		},
		{
			type: 'generate_response',
			title: buildTaskTitle(mode),
			input: {
				kind: 'generate_response',
				resolvedMode: mode,
				includeArtifactTypes: ['image', 'image-vector', 'markdown', 'layout-plan'],
				summary:
					mode === 'sketch'
						? 'Prepared a sketch asset pipeline with supporting canvas context.'
						: 'Prepared an image asset pipeline with supporting canvas context.',
			},
		},
		{
			type: 'verify_layout',
			title: 'Verify layout plan',
			input: {
				kind: 'verify_layout',
				requiredArtifactTypes: ['image-vector', 'markdown', 'layout-plan'],
			},
		},
		{
			type: 'verify_run',
			title: 'Verify generated output',
			input: {
				kind: 'verify_run',
				requiredTaskTypes: [
					'generate_image',
					'vectorize_asset',
					'create_markdown_overlay',
					'place_canvas_artifact',
					'generate_response',
					'verify_layout',
				],
				requiredArtifactTypes: ['image', 'image-vector', 'markdown', 'layout-plan'],
				requireResultMessage: true,
			},
		},
	];
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
			type: 'verify_run',
			title: 'Verify generated output',
			input: {
				kind: 'verify_run',
				requiredTaskTypes: ['generate_response'],
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
			? buildImagePipelineTasks(resolvedMode).map((task) =>
					task.type === 'generate_image'
						? {
								...task,
								input: createImageGenerationInput(
									request.message,
									resolvedMode as Extract<GenerationMode, 'image' | 'sketch'>,
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
				: [
						{
							type: 'generate_response',
							title: buildTaskTitle(resolvedMode),
							input: {
								kind: 'generate_response',
								resolvedMode,
								includeArtifactTypes:
									resolvedMode === 'kanban'
										? hasSelectedKanbanContext(request)
											? ['kanban-patch']
											: ['kanban-ops']
										: resolvedMode === 'prototype'
											? ['prototype-files']
											: [],
								summary:
									resolvedMode === 'kanban'
										? 'Prepared Kanban operations for the canvas.'
										: resolvedMode === 'prototype'
											? 'Prepared prototype files for the custom runtime.'
										: 'Prepared an assistant response for the canvas.',
							},
						},
						{
							type: 'verify_run',
							title: 'Verify generated output',
							input: {
								kind: 'verify_run',
								requiredTaskTypes: ['generate_response'],
								requiredArtifactTypes:
									resolvedMode === 'kanban'
										? hasSelectedKanbanContext(request)
											? ['kanban-patch']
											: ['kanban-ops']
										: resolvedMode === 'prototype'
											? ['prototype-files']
											: [],
								requireResultMessage: true,
							},
						},
				  ],
	};
}
