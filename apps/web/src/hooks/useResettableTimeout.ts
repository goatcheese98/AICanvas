import { useCallback, useEffect, useRef } from 'react';

export function useResettableTimeout() {
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clear = useCallback(() => {
		if (timeoutRef.current !== null) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
	}, []);

	const schedule = useCallback(
		(callback: () => void, delayMs: number) => {
			clear();
			timeoutRef.current = setTimeout(() => {
				timeoutRef.current = null;
				callback();
			}, delayMs);
		},
		[clear],
	);

	useEffect(() => clear, [clear]);

	return {
		schedule,
		clear,
	};
}
