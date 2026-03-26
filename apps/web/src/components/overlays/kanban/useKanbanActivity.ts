import { useCallback, useEffect, useRef } from 'react';

interface UseKanbanActivityOptions {
	isSelected: boolean;
	onActivityChange?: (isActive: boolean) => void;
}

interface UseKanbanActivityResult {
	isActive: boolean;
	reportActivity: (active: boolean) => void;
}

export function useKanbanActivity({
	isSelected,
	onActivityChange,
}: UseKanbanActivityOptions): UseKanbanActivityResult {
	const onActivityChangeRef = useRef(onActivityChange);
	const lastReportedEditingRef = useRef<boolean | null>(null);

	// Update ref on each render (not useEffect)
	onActivityChangeRef.current = onActivityChange;

	// Activity reporting - track isSelected changes
	useEffect(() => {
		if (lastReportedEditingRef.current !== isSelected) {
			lastReportedEditingRef.current = isSelected;
			onActivityChangeRef.current?.(isSelected);
		}
	}, [isSelected]);

	// Cleanup on unmount - report inactive
	useEffect(() => {
		return () => {
			if (lastReportedEditingRef.current) {
				onActivityChangeRef.current?.(false);
				lastReportedEditingRef.current = false;
			}
		};
	}, []);

	const reportActivity = useCallback((active: boolean) => {
		lastReportedEditingRef.current = active;
		onActivityChangeRef.current?.(active);
	}, []);

	const isActive = lastReportedEditingRef.current ?? false;

	return { isActive, reportActivity };
}
