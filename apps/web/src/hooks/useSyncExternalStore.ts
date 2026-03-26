import { useSyncExternalStore as reactUseSyncExternalStore } from 'react';

/**
 * Re-export with our naming convention.
 *
 * Use this for synchronizing with external mutable sources:
 * - Browser APIs (online status, window size, matchesMedia)
 * - External stores (non-React state management)
 * - Mutable refs that need reactive reads
 *
 * Prefer this over useMountEffect when you need:
 * - Reactive updates (not just mount/unmount)
 * - SSR-safe external state reading
 *
 * @see https://react.dev/reference/react/useSyncExternalStore
 */
export const useSyncExternalStore = reactUseSyncExternalStore;

/**
 * Helper for creating store subscriptions with useSyncExternalStore.
 *
 * Example:
 * ```typescript
 * const online = useSyncExternalStore(
 *   subscribeToOnlineStatus,
 *   () => navigator.onLine,
 *   () => true // server snapshot
 * );
 * ```
 */
export function createSubscribe<T>(
	subscribe: (callback: () => void) => () => void,
	getSnapshot: () => T,
	getServerSnapshot?: () => T,
) {
	return {
		subscribe,
		getSnapshot,
		getServerSnapshot: getServerSnapshot ?? getSnapshot,
	};
}
