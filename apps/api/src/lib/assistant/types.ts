import type { AssistantArtifact, AssistantMessage, GenerationMode } from '@ai-canvas/shared/types';

export interface AssistantServiceInput {
	message: string;
	contextMode: 'all' | 'selected';
	generationMode: GenerationMode;
}

export interface AssistantServiceResult {
	message: AssistantMessage;
}

export interface AssistantDraft {
	content: string;
	artifacts?: AssistantArtifact[];
}
