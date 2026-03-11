import type {
	KanbanBoardSummary,
	KanbanOverlayCustomData,
	MarkdownOverlayCustomData,
	PrototypeOverlayCustomData,
	WebEmbedOverlayCustomData,
} from './overlay';

export type GenerationMode = 'chat' | 'mermaid' | 'd2' | 'image' | 'sketch' | 'kanban' | 'prototype';

export type AssistantContextMode = 'all' | 'selected' | 'none';

export type AssistantRunStatus =
	| 'queued'
	| 'running'
	| 'completed'
	| 'failed'
	| 'cancelled';

export type AssistantTaskStatus =
	| 'queued'
	| 'running'
	| 'completed'
	| 'failed'
	| 'cancelled';

export type AssistantTaskType =
	| 'plan_run'
	| 'generate_response'
	| 'generate_image'
	| 'vectorize_asset'
	| 'create_markdown_overlay'
	| 'place_canvas_artifact'
	| 'verify_layout'
	| 'verify_run';

export type AssistantRunEventType =
	| 'run.created'
	| 'run.started'
	| 'task.created'
	| 'task.started'
	| 'task.completed'
	| 'task.failed'
	| 'message.created'
	| 'run.completed'
	| 'run.failed';

export interface AssistantMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	generationMode?: GenerationMode;
	artifacts?: AssistantArtifact[];
	createdAt: string;
}

export interface AssistantThread {
	id: string;
	canvasId: string;
	title: string;
	messages: AssistantMessage[];
	createdAt: string;
	updatedAt: string;
}

export interface AssistantContextSnapshot {
	canvasId: string;
	totalElementCount: number;
	selectedElementIds: string[];
	selectedElementCount: number;
	selectedOverlayTypes: string[];
	selectionSummary: Array<{
		id: string;
		elementType: string;
		overlayType?: string;
		label?: string;
	}>;
	selectedContexts: AssistantSelectedContext[];
}

export interface AssistantSelectedContextBase {
	id: string;
	priority: number;
	elementType: string;
	overlayType?: string;
	label?: string;
}

export interface AssistantSelectedMarkdownContext extends AssistantSelectedContextBase {
	kind: 'markdown';
	markdown: MarkdownOverlayCustomData;
}

export interface AssistantSelectedKanbanContext extends AssistantSelectedContextBase {
	kind: 'kanban';
	kanban: KanbanOverlayCustomData;
	kanbanSummary: KanbanBoardSummary;
}

export interface AssistantSelectedWebEmbedContext extends AssistantSelectedContextBase {
	kind: 'web-embed';
	webEmbed: WebEmbedOverlayCustomData;
}

export interface AssistantSelectedPrototypeContext extends AssistantSelectedContextBase {
	kind: 'prototype';
	prototype: {
		title: string;
		template: PrototypeOverlayCustomData['template'];
		activeFile?: string;
		filePaths: string[];
		dependencies: string[];
	};
}

export interface AssistantSelectedGeneratedDiagramContext extends AssistantSelectedContextBase {
	kind: 'generated-diagram';
	diagram: {
		language: 'mermaid' | 'd2';
		code: string;
	};
}

export interface AssistantSelectedGenericContext extends AssistantSelectedContextBase {
	kind: 'generic';
}

export type AssistantSelectedContext =
	| AssistantSelectedMarkdownContext
	| AssistantSelectedKanbanContext
	| AssistantSelectedWebEmbedContext
	| AssistantSelectedPrototypeContext
	| AssistantSelectedGeneratedDiagramContext
	| AssistantSelectedGenericContext;

export interface AssistantArtifact {
	type:
		| 'mermaid'
		| 'd2'
		| 'image'
		| 'image-vector'
		| 'kanban-ops'
		| 'kanban-patch'
		| 'prototype-files'
		| 'markdown'
		| 'markdown-patch'
		| 'layout-plan';
	content: string;
}

export interface AssistantMarkdownPatchArtifact {
	kind: 'markdown_patch';
	targetId: string;
	summary: string;
	base: {
		title?: string;
		content: string;
	};
	next: {
		title?: string;
		content: string;
		images?: Record<string, string>;
		settings?: MarkdownOverlayCustomData['settings'];
		editorMode?: MarkdownOverlayCustomData['editorMode'];
	};
}

export interface AssistantKanbanPatchArtifact {
	kind: 'kanban_patch';
	targetId: string;
	summary: string;
	operations: Array<Record<string, unknown>>;
	base: KanbanOverlayCustomData;
	next: KanbanOverlayCustomData;
}

export interface AssistantArtifactRecord {
	id: string;
	runId: string;
	taskId: string;
	type: AssistantArtifact['type'];
	title: string;
	content: string;
	createdAt: string;
}

export interface AssistantRunRequest {
	threadId: string;
	canvasId: string;
	message: string;
	contextMode: AssistantContextMode;
	modeHint?: GenerationMode;
	history?: AssistantMessage[];
	selectedElementIds?: string[];
	prototypeContext?: PrototypeOverlayCustomData;
	contextSnapshot?: AssistantContextSnapshot;
}

export type AssistantTaskInput =
	| {
			kind: 'plan_run';
			request: AssistantRunRequest;
	  }
	| {
			kind: 'generate_image';
			prompt: string;
			style: 'image' | 'sketch';
			outputTitle: string;
	  }
	| {
			kind: 'vectorize_asset';
			sourceArtifactType: 'image';
			outputTitle: string;
	  }
	| {
			kind: 'create_markdown_overlay';
			resolvedMode: GenerationMode;
			sourceArtifactTypes: AssistantArtifact['type'][];
			title: string;
	  }
	| {
			kind: 'place_canvas_artifact';
			targetArtifactTypes: AssistantArtifact['type'][];
			title: string;
			strategy: 'avoid-overlap';
	  }
	| {
			kind: 'generate_response';
			resolvedMode: GenerationMode;
			includeArtifactTypes: AssistantArtifact['type'][];
			summary: string;
	  }
	| {
			kind: 'verify_layout';
			requiredArtifactTypes: AssistantArtifact['type'][];
	  }
	| {
			kind: 'verify_run';
			requiredTaskTypes: AssistantTaskType[];
			requiredArtifactTypes: AssistantArtifact['type'][];
			requireResultMessage: boolean;
	  };

export type AssistantTaskOutput =
	| {
			kind: 'plan_run';
			resolvedMode: GenerationMode;
			enqueuedTaskTypes: AssistantTaskType[];
	  }
	| {
			kind: 'artifact_created';
			artifactIds: string[];
	  }
	| {
			kind: 'placement_ready';
			artifactIds: string[];
			strategy: 'avoid-overlap';
	  }
	| {
			kind: 'response_ready';
			messageId: string;
			artifactTypes: AssistantArtifact['type'][];
	  }
	| {
			kind: 'verification';
			verified: boolean;
			details: string;
	  };

export interface AssistantRun {
	id: string;
	status: AssistantRunStatus;
	request: AssistantRunRequest;
	resultMessage?: AssistantMessage;
	error?: string;
	createdAt: string;
	updatedAt: string;
}

export interface AssistantTask {
	id: string;
	runId: string;
	type: AssistantTaskType;
	status: AssistantTaskStatus;
	title: string;
	input?: AssistantTaskInput;
	output?: AssistantTaskOutput;
	error?: string;
	createdAt: string;
	updatedAt: string;
}

export interface AssistantRunEvent {
	id: string;
	runId: string;
	sequence: number;
	type: AssistantRunEventType;
	data?: {
		taskId?: string;
		taskType?: AssistantTask['type'];
		taskTitle?: string;
		taskStatus?: AssistantTaskStatus;
		message?: AssistantMessage;
		error?: string;
		status?: AssistantRunStatus;
	};
	createdAt: string;
}

export interface AssistantRunCreated {
	runId: string;
	status: AssistantRunStatus;
}

export interface AssistantJob {
	id: string;
	status: 'pending' | 'running' | 'completed' | 'failed';
	generationMode: GenerationMode;
	result?: string;
	error?: string;
}
