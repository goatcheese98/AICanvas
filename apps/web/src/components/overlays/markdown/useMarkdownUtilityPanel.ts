import { useMountEffect } from '@/hooks/useMountEffect';
import { useRef, useState } from 'react';
import type { UtilityPanel } from './markdown-note-helpers';

interface UseMarkdownUtilityPanelProps {
	isSelected: boolean;
}

interface UseMarkdownUtilityPanelReturn {
	utilityPanelRef: React.RefObject<HTMLDivElement | null>;
	detachedUtilityPanelRef: React.RefObject<HTMLDivElement | null>;
	activeUtilityPanel: UtilityPanel;
	setActiveUtilityPanel: React.Dispatch<React.SetStateAction<UtilityPanel>>;
	isCompactControlsVisible: boolean;
	setIsCompactControlsVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useMarkdownUtilityPanel({
	isSelected,
}: UseMarkdownUtilityPanelProps): UseMarkdownUtilityPanelReturn {
	const utilityPanelRef = useRef<HTMLDivElement>(null);
	const detachedUtilityPanelRef = useRef<HTMLDivElement>(null);

	const [activeUtilityPanelState, setActiveUtilityPanel] = useState<UtilityPanel>('none');
	const [isCompactControlsVisibleState, setIsCompactControlsVisible] = useState(false);

	// Derived state based on isSelected
	const activeUtilityPanel = !isSelected ? 'none' : activeUtilityPanelState;
	const isCompactControlsVisible = !isSelected ? false : isCompactControlsVisibleState;

	// Track activeUtilityPanel changes for the outside click handler
	const activeUtilityPanelRef = useRef(activeUtilityPanel);
	activeUtilityPanelRef.current = activeUtilityPanel;

	// Outside click handler for utility panel
	useMountEffect(() => {
		const handlePointerDown = (event: PointerEvent) => {
			const currentPanel = activeUtilityPanelRef.current;
			const target = event.target as Node;
			const insideTrigger = utilityPanelRef.current?.contains(target) ?? false;
			const insideDetachedPanel = detachedUtilityPanelRef.current?.contains(target) ?? false;
			if (currentPanel !== 'none' && !insideTrigger && !insideDetachedPanel) {
				setActiveUtilityPanel('none');
			}
		};

		window.addEventListener('pointerdown', handlePointerDown);
		return () => window.removeEventListener('pointerdown', handlePointerDown);
	});

	return {
		utilityPanelRef,
		detachedUtilityPanelRef,
		activeUtilityPanel,
		setActiveUtilityPanel,
		isCompactControlsVisible,
		setIsCompactControlsVisible,
	};
}
