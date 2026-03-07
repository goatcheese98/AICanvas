export type GenerationMode = 'chat' | 'mermaid' | 'd2' | 'image' | 'sketch' | 'kanban';

export interface AssistantMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	generationMode?: GenerationMode;
	artifacts?: AssistantArtifact[];
	createdAt: string;
}

export interface AssistantArtifact {
	type: 'mermaid' | 'd2' | 'image' | 'kanban-ops';
	content: string;
}

export interface AssistantJob {
	id: string;
	status: 'pending' | 'running' | 'completed' | 'failed';
	generationMode: GenerationMode;
	result?: string;
	error?: string;
}
