import { sanitizePersistedCanvasAppState } from '@/hooks/collaboration-utils';
import type {
	CanvasData,
	PersistedCanvasAppState,
	PersistedCanvasElement,
	PersistedCanvasFiles,
} from '@/lib/persistence/CanvasPersistenceCoordinator';

type QueryStatus = 'pending' | 'error' | 'success';
type FetchStatus = 'fetching' | 'paused' | 'idle';

export function buildPersistedCanvasData(
	elements: readonly PersistedCanvasElement[],
	appState: PersistedCanvasAppState | null | undefined,
	files: PersistedCanvasFiles | null | undefined,
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
