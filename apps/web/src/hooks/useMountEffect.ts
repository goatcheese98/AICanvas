import { useEffect } from 'react';

/**
 * Hook for one-time setup/cleanup of external systems.
 *
 * This is the ONLY allowed useEffect pattern in components.
 * Use for things like:
 * - Initializing external libraries (Lexical, Excalidraw, etc.)
 * - Setting up IntersectionObserver, ResizeObserver, etc.
 * - One-time DOM measurements
 *
 * @param setup Function that runs once on mount. Can return cleanup function.
 *
 * @example
 * useMountEffect(() => {
 *   const editor = createEditor();
 *   return () => editor.destroy();
 * });
 */
// biome-ignore lint/suspicious/noConfusingVoidType: standard cleanup pattern
export function useMountEffect(setup: () => void | (() => void)): void {
	// biome-ignore lint/correctness/useExhaustiveDependencies: setup runs once on mount
	useEffect(() => {
		const cleanup = setup();
		return cleanup;
	}, []);
}
