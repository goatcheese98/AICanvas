import type {
	AssistantArtifact,
	AssistantContextSnapshot,
	AssistantContextMode,
	AssistantMessage,
	GenerationMode,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';
import type { AppEnv } from '../../types';

export interface AssistantServiceInput {
	message: string;
	contextMode: AssistantContextMode;
	generationMode?: GenerationMode;
	history?: AssistantMessage[];
	contextSnapshot?: AssistantContextSnapshot;
	prototypeContext?: PrototypeOverlayCustomData;
	bindings?: AppEnv['Bindings'];
}

export interface AssistantServiceResult {
	message: AssistantMessage;
}

export interface AssistantDraft {
	content: string;
	artifacts?: AssistantArtifact[];
}
