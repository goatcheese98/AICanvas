import { sanitizePersistedCanvasAppState } from '@/hooks/collaboration-utils';
import type { CanvasData } from '@/lib/persistence/CanvasPersistenceCoordinator';

type QueryStatus = 'pending' | 'error' | 'success';
type FetchStatus = 'fetching' | 'paused' | 'idle';

export function buildPersistedCanvasData(
	elements: readonly unknown[],
	appState: Record<string, unknown> | null | undefined,
	files: Record<string, unknown> | null | undefined,
): CanvasData {
	return {
		elements: [...elements],
		appState: sanitizePersistedCanvasAppState(appState ?? {}),
		files: files ?? null,
	};
}

export function shouldWaitForCanvasHydration(status: QueryStatus, fetchStatus: FetchStatus): boolean {
	return status === 'pending' || fetchStatus === 'fetching';
}
