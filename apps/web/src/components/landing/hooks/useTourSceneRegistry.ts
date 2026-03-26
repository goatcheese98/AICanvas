/**
 * Scene Registry Hook - Pure data layer for tour scenes.
 *
 * Anti-Slop Pattern:
 * - No side effects, no React state
 * - Pure data transformations and lookups
 * - Scene definitions and metadata access only
 */

import { useCallback, useMemo } from 'react';
import type { CanvasTourChapter } from '../canvas-tour-content';
import { canvasTourChapters } from '../canvas-tour-content';
import type { RegisteredTourSceneSnapshot } from '../canvas-tour-registry';

export interface TourScene {
	id: string;
	chapter: CanvasTourChapter;
	label: string;
	slug: string;
}

export interface UseTourSceneRegistryReturn {
	/** All available scenes derived from chapters */
	scenes: TourScene[];
	/** All chapter definitions */
	chapters: CanvasTourChapter[];
	/** Get scene by ID (chapter ID) */
	getSceneById: (id: string) => TourScene | undefined;
	/** Get scene by slug (kebab-case label) */
	getSceneBySlug: (slug: string) => TourScene | undefined;
	/** Get chapter by ID */
	getChapterById: (id: string) => CanvasTourChapter | undefined;
	/** Get all scenes for a chapter (1:1 mapping currently) */
	getChapterScene: (chapterId: string) => TourScene | undefined;
	/** Get default scene (first chapter) */
	getDefaultScene: () => TourScene;
	/** Check if scene/chapter exists */
	hasScene: (id: string) => boolean;
	/** Get scene index in sequence */
	getSceneIndex: (id: string) => number;
	/** Total scene count */
	sceneCount: number;
}

function chapterToScene(chapter: CanvasTourChapter): TourScene {
	return {
		id: chapter.id,
		chapter,
		label: chapter.label,
		slug: chapter.id,
	};
}

function slugifyLabel(label: string): string {
	return label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function useTourSceneRegistry(): UseTourSceneRegistryReturn {
	const scenes = useMemo(() => canvasTourChapters.map(chapterToScene), []);

	const getSceneById = useCallback((id: string): TourScene | undefined => {
		const chapter = canvasTourChapters.find((c) => c.id === id);
		return chapter ? chapterToScene(chapter) : undefined;
	}, []);

	const getSceneBySlug = useCallback(
		(slug: string): TourScene | undefined => {
			// Try exact ID match first
			const byId = getSceneById(slug);
			if (byId) return byId;

			// Try label slug match
			return scenes.find((s) => s.slug === slug || slugifyLabel(s.label) === slug);
		},
		[scenes, getSceneById],
	);

	const getChapterById = useCallback((id: string): CanvasTourChapter | undefined => {
		return canvasTourChapters.find((c) => c.id === id);
	}, []);

	const getChapterScene = useCallback(
		(chapterId: string): TourScene | undefined => {
			return getSceneById(chapterId);
		},
		[getSceneById],
	);

	const getDefaultScene = useCallback((): TourScene => {
		return chapterToScene(canvasTourChapters[0]);
	}, []);

	const hasScene = useCallback((id: string): boolean => {
		return canvasTourChapters.some((c) => c.id === id);
	}, []);

	const getSceneIndex = useCallback((id: string): number => {
		return canvasTourChapters.findIndex((c) => c.id === id);
	}, []);

	const sceneCount = useMemo(() => canvasTourChapters.length, []);

	return useMemo(
		() => ({
			scenes,
			chapters: canvasTourChapters,
			getSceneById,
			getSceneBySlug,
			getChapterById,
			getChapterScene,
			getDefaultScene,
			hasScene,
			getSceneIndex,
			sceneCount,
		}),
		[
			scenes,
			getSceneById,
			getSceneBySlug,
			getChapterById,
			getChapterScene,
			getDefaultScene,
			hasScene,
			getSceneIndex,
			sceneCount,
		],
	);
}

/**
 * Build a default scene snapshot for a given chapter/scene ID.
 * Pure function - no hooks, can be used outside React.
 */
export function buildDefaultSceneSnapshot(
	sceneId: string,
	defaultElements: unknown[],
): Omit<RegisteredTourSceneSnapshot, 'elements'> & { elements: unknown[] } {
	const chapter = canvasTourChapters.find((c) => c.id === sceneId) ?? canvasTourChapters[0];
	return {
		sceneId,
		elements: defaultElements,
		camera: chapter.camera,
		overlay: chapter.overlay,
		capturedAt: new Date(0).toISOString(),
	} as Omit<RegisteredTourSceneSnapshot, 'elements'> & { elements: unknown[] };
}

/**
 * Resolve chapter for a given scene ID.
 * Pure function - no hooks.
 */
export function resolveChapterById(
	sceneId: string,
	fallback?: CanvasTourChapter,
): CanvasTourChapter {
	return canvasTourChapters.find((c) => c.id === sceneId) ?? fallback ?? canvasTourChapters[0];
}
