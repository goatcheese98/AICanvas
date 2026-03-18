import { useCallback, useRef } from 'react';
import { useResettableTimeout } from './useResettableTimeout';

export function useThrottledCallback<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
	const lastRef = useRef(0);
	const fnRef = useRef(fn);
	const { schedule, clear } = useResettableTimeout();
	fnRef.current = fn;

	return useCallback(
		(...args: A) => {
			const now = Date.now();
			if (now - lastRef.current >= ms) {
				lastRef.current = now;
				clear();
				fnRef.current(...args);
			} else {
				schedule(
					() => {
						lastRef.current = Date.now();
						fnRef.current(...args);
					},
					ms - (now - lastRef.current),
				);
			}
		},
		[clear, ms, schedule],
	);
}
