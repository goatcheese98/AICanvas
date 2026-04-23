import type {
	AssistantContextMode,
	AssistantContextSnapshot,
	AssistantMessage,
	AssistantTask,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';
import type { AppEnv } from '../../../types';
import type { createDb } from '../../db/client';

type AssistantDb = ReturnType<typeof createDb>;

export interface TaskHandlerContext {
	db: AssistantDb;
	bindings: AppEnv['Bindings'];
	ownerId: string;
	runId: string;
	message: string;
	contextMode: AssistantContextMode;
	history: AssistantMessage[] | undefined;
	contextSnapshot: AssistantContextSnapshot | undefined;
	prototypeContext: PrototypeOverlayCustomData | undefined;
}

export interface TaskHandlerResult {
	output: AssistantTask['output'];
}
