import { useCallback, useEffect } from 'react';

/**
 * Hook to handle clicks outside a referenced element.
 *
 * Note: This uses useEffect internally as it's the standard pattern for DOM event subscriptions.
 * The effect is encapsulated in this dedicated hook, following the principle of isolating
 * side effects to specialized hooks rather than having them directly in components.
 *
 * @param ref - React ref to the element to watch
 * @param isActive - Whether the click detection is currently active
 * @param onOutsideClick - Callback when a click outside occurs
 */
export function useOutsideClick(
	ref: React.RefObject<HTMLElement | null>,
	isActive: boolean,
	onOutsideClick: () => void,
): void {
	const handlePointerDown = useCallback(
		(event: PointerEvent) => {
			if (!ref.current?.contains(event.target as Node)) {
				onOutsideClick();
			}
		},
		[ref, onOutsideClick],
	);

	useEffect(() => {
		if (!isActive) return;

		window.addEventListener('pointerdown', handlePointerDown);
		return () => window.removeEventListener('pointerdown', handlePointerDown);
	}, [isActive, handlePointerDown]);
}
