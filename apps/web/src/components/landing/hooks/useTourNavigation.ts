/**
 * Tour Navigation Hook - Chapter/step navigation state management.
 *
 * Anti-Slop Pattern:
 * - Manages navigation state transitions only
 * - No scene data, no persistence logic
 * - Explicit guards and progress tracking
 */

import { useCallback, useMemo, useState } from 'react';
import { canvasTourChapters } from '../canvas-tour-content';

export interface TourNavigationState {
	/** Current chapter index (0-based) */
	currentChapterIndex: number;
	/** Current step within chapter (0-based, reserved for future use) */
	currentStepIndex: number;
}

export interface TourNavigationActions {
	/** Navigate to next chapter */
	nextChapter: () => boolean;
	/** Navigate to previous chapter */
	previousChapter: () => boolean;
	/** Navigate to specific chapter by ID */
	goToChapter: (chapterId: string) => boolean;
	/** Navigate to chapter by index */
	goToChapterIndex: (index: number) => boolean;
	/** Navigate to specific step (reserved) */
	goToStep: (stepIndex: number) => boolean;
	/** Reset navigation to start */
	resetNavigation: () => void;
}

export interface TourNavigationGuards {
	/** Can navigate to next chapter? */
	canGoNext: boolean;
	/** Can navigate to previous chapter? */
	canGoPrevious: boolean;
	/** Is currently at first chapter? */
	isAtStart: boolean;
	/** Is currently at last chapter? */
	isAtEnd: boolean;
}

export interface TourProgress {
	/** Progress through chapters (0-1) */
	chapterProgress: number;
	/** Overall progress (0-1, includes steps) */
	overallProgress: number;
	/** Current chapter number (1-based) for display */
	chapterNumber: number;
	/** Total chapters */
	totalChapters: number;
}

export interface UseTourNavigationReturn
	extends TourNavigationState,
		TourNavigationActions,
		TourNavigationGuards,
		TourProgress {
	/** Current chapter ID */
	currentChapterId: string;
	/** Set chapter index directly (for controlled usage) */
	setCurrentChapterIndex: React.Dispatch<React.SetStateAction<number>>;
	/** Set step index directly (for controlled usage) */
	setCurrentStepIndex: React.Dispatch<React.SetStateAction<number>>;
}

interface UseTourNavigationArgs {
	initialChapterIndex?: number;
	initialStepIndex?: number;
	/** Callback when chapter changes */
	onChapterChange?: (chapterId: string, index: number) => void;
	/** Guard function to check if chapter navigation is allowed */
	canNavigateToChapter?: (chapterId: string) => boolean;
}

export function useTourNavigation({
	initialChapterIndex = 0,
	initialStepIndex = 0,
	onChapterChange,
	canNavigateToChapter,
}: UseTourNavigationArgs = {}): UseTourNavigationReturn {
	const [currentChapterIndex, setCurrentChapterIndex] = useState(initialChapterIndex);
	const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex);

	const totalChapters = canvasTourChapters.length;
	const currentChapterId = canvasTourChapters[currentChapterIndex]?.id ?? '';

	const guards = useMemo(
		() => ({
			canGoNext: currentChapterIndex < totalChapters - 1,
			canGoPrevious: currentChapterIndex > 0,
			isAtStart: currentChapterIndex === 0,
			isAtEnd: currentChapterIndex === totalChapters - 1,
		}),
		[currentChapterIndex, totalChapters],
	);

	const progress = useMemo(
		() => ({
			chapterProgress: totalChapters > 0 ? (currentChapterIndex + 1) / totalChapters : 0,
			overallProgress: totalChapters > 0 ? (currentChapterIndex + 1) / totalChapters : 0,
			chapterNumber: currentChapterIndex + 1,
			totalChapters,
		}),
		[currentChapterIndex, totalChapters],
	);

	const nextChapter = useCallback((): boolean => {
		if (!guards.canGoNext) return false;

		const nextIndex = currentChapterIndex + 1;
		const nextChapterId = canvasTourChapters[nextIndex]?.id;

		if (!nextChapterId) return false;
		if (canNavigateToChapter && !canNavigateToChapter(nextChapterId)) return false;

		setCurrentChapterIndex(nextIndex);
		setCurrentStepIndex(0);
		onChapterChange?.(nextChapterId, nextIndex);
		return true;
	}, [currentChapterIndex, guards.canGoNext, canNavigateToChapter, onChapterChange]);

	const previousChapter = useCallback((): boolean => {
		if (!guards.canGoPrevious) return false;

		const prevIndex = currentChapterIndex - 1;
		const prevChapterId = canvasTourChapters[prevIndex]?.id;

		if (!prevChapterId) return false;
		if (canNavigateToChapter && !canNavigateToChapter(prevChapterId)) return false;

		setCurrentChapterIndex(prevIndex);
		setCurrentStepIndex(0);
		onChapterChange?.(prevChapterId, prevIndex);
		return true;
	}, [currentChapterIndex, guards.canGoPrevious, canNavigateToChapter, onChapterChange]);

	const goToChapterIndex = useCallback(
		(index: number): boolean => {
			if (index < 0 || index >= totalChapters) return false;

			const chapterId = canvasTourChapters[index]?.id;
			if (!chapterId) return false;
			if (canNavigateToChapter && !canNavigateToChapter(chapterId)) return false;

			setCurrentChapterIndex(index);
			setCurrentStepIndex(0);
			onChapterChange?.(chapterId, index);
			return true;
		},
		[totalChapters, canNavigateToChapter, onChapterChange],
	);

	const goToChapter = useCallback(
		(chapterId: string): boolean => {
			const index = canvasTourChapters.findIndex((c) => c.id === chapterId);
			if (index === -1) return false;
			return goToChapterIndex(index);
		},
		[goToChapterIndex],
	);

	const goToStep = useCallback((stepIndex: number): boolean => {
		// For now, chapters don't have internal steps
		// This is reserved for future multi-step chapters
		if (stepIndex !== 0) return false;
		setCurrentStepIndex(stepIndex);
		return true;
	}, []);

	const resetNavigation = useCallback((): void => {
		setCurrentChapterIndex(initialChapterIndex);
		setCurrentStepIndex(initialStepIndex);
		const chapterId = canvasTourChapters[initialChapterIndex]?.id;
		if (chapterId) {
			onChapterChange?.(chapterId, initialChapterIndex);
		}
	}, [initialChapterIndex, initialStepIndex, onChapterChange]);

	return useMemo(
		() => ({
			currentChapterIndex,
			currentStepIndex,
			currentChapterId,
			setCurrentChapterIndex,
			setCurrentStepIndex,
			nextChapter,
			previousChapter,
			goToChapter,
			goToChapterIndex,
			goToStep,
			resetNavigation,
			...guards,
			...progress,
		}),
		[
			currentChapterIndex,
			currentStepIndex,
			currentChapterId,
			nextChapter,
			previousChapter,
			goToChapter,
			goToChapterIndex,
			goToStep,
			resetNavigation,
			guards,
			progress,
		],
	);
}
