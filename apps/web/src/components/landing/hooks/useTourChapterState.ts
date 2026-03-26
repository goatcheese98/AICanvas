/**
 * Tour Chapter State Hook - Chapter completion and availability tracking.
 *
 * Anti-Slop Pattern:
 * - Tracks chapter-specific progress state
 * - Manages locked/unlocked status
 * - No scene data, no navigation logic
 */

import { useCallback, useMemo, useState } from 'react';
import { canvasTourChapters } from '../canvas-tour-content';

type ChapterId = string;

export interface ChapterProgress {
	/** Whether chapter has been completed */
	completed: boolean;
	/** When chapter was completed */
	completedAt?: string;
	/** Number of times visited */
	visitCount: number;
	/** Last visited timestamp */
	lastVisitedAt?: string;
}

export interface ChapterAvailability {
	/** Chapter ID */
	chapterId: ChapterId;
	/** Is chapter available (unlocked) */
	isAvailable: boolean;
	/** Is chapter completed */
	isCompleted: boolean;
	/** Why is it locked (if applicable) */
	lockedReason?: string;
}

export interface UseTourChapterStateArgs {
	/** Initially completed chapter IDs */
	initialCompleted?: ChapterId[];
	/** Require sequential completion */
	sequentialUnlock?: boolean;
	/** Custom unlock predicate */
	canUnlockChapter?: (chapterId: ChapterId, completedChapters: Set<ChapterId>) => boolean;
}

export interface UseTourChapterStateReturn {
	/** Set of completed chapter IDs */
	completedChapters: Set<ChapterId>;
	/** Map of chapter progress data */
	chapterProgress: Map<ChapterId, ChapterProgress>;
	/** Mark a chapter as complete */
	markComplete: (chapterId: ChapterId) => boolean;
	/** Mark a chapter as incomplete */
	markIncomplete: (chapterId: ChapterId) => boolean;
	/** Check if chapter is completed */
	isCompleted: (chapterId: ChapterId) => boolean;
	/** Check if chapter is available */
	isAvailable: (chapterId: ChapterId) => boolean;
	/** Record chapter visit */
	recordVisit: (chapterId: ChapterId) => void;
	/** Get chapter availability info */
	getChapterAvailability: (chapterId: ChapterId) => ChapterAvailability;
	/** Get all available chapters */
	getAvailableChapters: () => ChapterId[];
	/** Get next available incomplete chapter */
	getNextChapter: () => ChapterId | null;
	/** Reset all progress */
	resetProgress: () => void;
	/** Overall completion percentage (0-1) */
	completionRate: number;
	/** Total chapters count */
	totalChapters: number;
	/** Completed count */
	completedCount: number;
}

export function useTourChapterState({
	initialCompleted = [],
	sequentialUnlock = false,
	canUnlockChapter,
}: UseTourChapterStateArgs = {}): UseTourChapterStateReturn {
	const [completedChapters, setCompletedChapters] = useState<Set<ChapterId>>(
		() => new Set(initialCompleted),
	);
	const [chapterProgress, setChapterProgress] = useState<Map<ChapterId, ChapterProgress>>(
		() => new Map(),
	);

	const totalChapters = canvasTourChapters.length;
	const completedCount = completedChapters.size;
	const completionRate = useMemo(
		() => (totalChapters > 0 ? completedCount / totalChapters : 0),
		[completedCount, totalChapters],
	);

	const isCompleted = useCallback(
		(chapterId: ChapterId): boolean => {
			return completedChapters.has(chapterId);
		},
		[completedChapters],
	);

	const isAvailable = useCallback(
		(chapterId: ChapterId): boolean => {
			// First chapter is always available
			if (canvasTourChapters[0]?.id === chapterId) return true;

			// Check if chapter exists
			const chapterIndex = canvasTourChapters.findIndex((c) => c.id === chapterId);
			if (chapterIndex === -1) return false;

			// Custom unlock logic
			if (canUnlockChapter) {
				return canUnlockChapter(chapterId, completedChapters);
			}

			// Sequential unlock: previous chapter must be completed
			if (sequentialUnlock) {
				const previousChapter = canvasTourChapters[chapterIndex - 1];
				if (previousChapter && !completedChapters.has(previousChapter.id)) {
					return false;
				}
			}

			return true;
		},
		[completedChapters, sequentialUnlock, canUnlockChapter],
	);

	const markComplete = useCallback(
		(chapterId: ChapterId): boolean => {
			if (!isAvailable(chapterId)) return false;

			setCompletedChapters((prev) => {
				const next = new Set(prev);
				next.add(chapterId);
				return next;
			});

			setChapterProgress((prev) => {
				const next = new Map(prev);
				const existing = next.get(chapterId);
				next.set(chapterId, {
					completed: true,
					completedAt: new Date().toISOString(),
					visitCount: existing?.visitCount ?? 1,
					lastVisitedAt: existing?.lastVisitedAt ?? new Date().toISOString(),
				});
				return next;
			});

			return true;
		},
		[isAvailable],
	);

	const markIncomplete = useCallback((chapterId: ChapterId): boolean => {
		setCompletedChapters((prev) => {
			const next = new Set(prev);
			next.delete(chapterId);
			return next;
		});

		setChapterProgress((prev) => {
			const next = new Map(prev);
			const existing = next.get(chapterId);
			if (existing) {
				next.set(chapterId, {
					...existing,
					completed: false,
					completedAt: undefined,
				});
			}
			return next;
		});

		return true;
	}, []);

	const recordVisit = useCallback((chapterId: ChapterId): void => {
		setChapterProgress((prev) => {
			const next = new Map(prev);
			const existing = next.get(chapterId);
			next.set(chapterId, {
				completed: existing?.completed ?? false,
				completedAt: existing?.completedAt,
				visitCount: (existing?.visitCount ?? 0) + 1,
				lastVisitedAt: new Date().toISOString(),
			});
			return next;
		});
	}, []);

	const getChapterAvailability = useCallback(
		(chapterId: ChapterId): ChapterAvailability => {
			const available = isAvailable(chapterId);
			const completed = isCompleted(chapterId);

			let lockedReason: string | undefined;
			if (!available) {
				if (sequentialUnlock) {
					const chapterIndex = canvasTourChapters.findIndex((c) => c.id === chapterId);
					const previousChapter = canvasTourChapters[chapterIndex - 1];
					lockedReason = previousChapter
						? `Complete "${previousChapter.label}" to unlock`
						: 'Chapter is locked';
				} else {
					lockedReason = 'Chapter is locked';
				}
			}

			return {
				chapterId,
				isAvailable: available,
				isCompleted: completed,
				lockedReason,
			};
		},
		[isAvailable, isCompleted, sequentialUnlock],
	);

	const getAvailableChapters = useCallback((): ChapterId[] => {
		return canvasTourChapters.filter((c) => isAvailable(c.id)).map((c) => c.id);
	}, [isAvailable]);

	const getNextChapter = useCallback((): ChapterId | null => {
		for (const chapter of canvasTourChapters) {
			if (isAvailable(chapter.id) && !isCompleted(chapter.id)) {
				return chapter.id;
			}
		}
		return null;
	}, [isAvailable, isCompleted]);

	const resetProgress = useCallback((): void => {
		setCompletedChapters(new Set());
		setChapterProgress(new Map());
	}, []);

	return useMemo(
		() => ({
			completedChapters,
			chapterProgress,
			markComplete,
			markIncomplete,
			isCompleted,
			isAvailable,
			recordVisit,
			getChapterAvailability,
			getAvailableChapters,
			getNextChapter,
			resetProgress,
			completionRate,
			totalChapters,
			completedCount,
		}),
		[
			completedChapters,
			chapterProgress,
			markComplete,
			markIncomplete,
			isCompleted,
			isAvailable,
			recordVisit,
			getChapterAvailability,
			getAvailableChapters,
			getNextChapter,
			resetProgress,
			completionRate,
			totalChapters,
			completedCount,
		],
	);
}
