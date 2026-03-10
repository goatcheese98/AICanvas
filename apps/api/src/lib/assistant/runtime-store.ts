import type { AssistantRunEvent } from '@ai-canvas/shared/types';

interface OwnerRuntimeState {
	listenersByRun: Map<string, Set<(event: AssistantRunEvent) => void>>;
}

const runtimeByOwner = new Map<string, OwnerRuntimeState>();

function getOwnerState(ownerId: string): OwnerRuntimeState {
	const existing = runtimeByOwner.get(ownerId);
	if (existing) {
		return existing;
	}

	const state: OwnerRuntimeState = {
		listenersByRun: new Map(),
	};
	runtimeByOwner.set(ownerId, state);
	return state;
}

export function publishAssistantRunEvent(
	ownerId: string,
	runId: string,
	event: AssistantRunEvent,
): void {
	const listeners = getOwnerState(ownerId).listenersByRun.get(runId);
	if (!listeners || listeners.size === 0) {
		return;
	}

	for (const listener of listeners) {
		listener(event);
	}
}

export function subscribeToAssistantRun(
	ownerId: string,
	runId: string,
	listener: (event: AssistantRunEvent) => void,
): () => void {
	const state = getOwnerState(ownerId);
	const listeners = state.listenersByRun.get(runId) ?? new Set<(event: AssistantRunEvent) => void>();
	listeners.add(listener);
	state.listenersByRun.set(runId, listeners);

	return () => {
		const current = state.listenersByRun.get(runId);
		if (!current) {
			return;
		}
		current.delete(listener);
		if (current.size === 0) {
			state.listenersByRun.delete(runId);
		}
	};
}
