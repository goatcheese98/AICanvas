import { useEffect } from 'react';

/**
 * useMountEffect - The only allowed useEffect pattern in this codebase.
 * 
 * Use this for one-time external system synchronization on mount:
 * - DOM integration (focus, scroll, resize observers)
 * - Third-party widget initialization (Lexical, Excalidraw)
 * - Browser API subscriptions
 * 
 * NEVER use useEffect directly in components. If you think you need it,
 * you probably need one of these instead:
 * - Derived state (compute inline)
 * - Event handlers (onClick, onChange)
 * - TanStack Query (data fetching)
 * - useSyncExternalStore (external store sync)
 * 
 * @see https://react.dev/learn/you-might-not-need-an-effect
 */
export function useMountEffect(effect: () => void | (() => void)) {
	/* eslint-disable react-hooks/rules-of-hooks */
	useEffect(effect, []);
}
