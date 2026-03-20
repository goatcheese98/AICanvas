import { useMountEffect } from '@/hooks/useMountEffect';
import { useRef, useCallback } from 'react';

interface UseMarkdownActivityProps {
	isEditing: boolean;
	onActivityChange?: (isActive: boolean) => void;
}

interface UseMarkdownActivityReturn {
	reportActivity: (isActive: boolean) => void;
}

export function useMarkdownActivity({
	isEditing,
	onActivityChange,
}: UseMarkdownActivityProps): UseMarkdownActivityReturn {
	const onActivityChangeRef = useRef(onActivityChange);
	const lastReportedActivityRef = useRef<boolean | null>(null);
	const hasReportedActivityRef = useRef(false);
	const prevIsEditingRef = useRef(isEditing);

	onActivityChangeRef.current = onActivityChange;

	// Track isEditing changes and report activity
	if (prevIsEditingRef.current !== isEditing) {
		prevIsEditingRef.current = isEditing;
		if (hasReportedActivityRef.current && lastReportedActivityRef.current !== isEditing) {
			lastReportedActivityRef.current = isEditing;
			onActivityChangeRef.current?.(isEditing);
		}
		hasReportedActivityRef.current = true;
	}

	// Activity cleanup on unmount
	useMountEffect(() => {
		hasReportedActivityRef.current = true;
		lastReportedActivityRef.current = isEditing;
		if (isEditing) {
			onActivityChangeRef.current?.(true);
		}
		return () => {
			if (lastReportedActivityRef.current) {
				onActivityChangeRef.current?.(false);
				lastReportedActivityRef.current = false;
			}
		};
	});

	const reportActivity = useCallback((isActive: boolean) => {
		if (lastReportedActivityRef.current !== isActive) {
			lastReportedActivityRef.current = isActive;
			onActivityChangeRef.current?.(isActive);
		}
		hasReportedActivityRef.current = true;
	}, []);

	return {
		reportActivity,
	};
}
