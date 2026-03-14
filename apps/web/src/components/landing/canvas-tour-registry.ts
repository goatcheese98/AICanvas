import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { normalizeSceneElements } from '@/components/canvas/scene-element-normalizer';
import { canvasTourChapters, type CanvasTourGuideOverlay } from './canvas-tour-content';
import type { CameraTarget } from './useCanvasTourSceneController';

export interface RegisteredTourSceneSnapshot {
	sceneId: string;
	elements: ExcalidrawElement[];
	camera: CameraTarget;
	overlay: CanvasTourGuideOverlay;
	capturedAt: string;
}

export interface RegisteredTourSceneLibrary {
	scenes: Record<string, RegisteredTourSceneSnapshot>;
	updatedAt: string;
}

const TOUR_REGISTERED_SCENE_STORAGE_KEY = 'ai-canvas:tour:registered-scenes:v2';
const IS_DEV = import.meta.env.DEV;

function isValidCamera(camera: unknown): camera is CameraTarget {
	return (
		typeof (camera as CameraTarget | undefined)?.x === 'number' &&
		typeof (camera as CameraTarget | undefined)?.y === 'number' &&
		typeof (camera as CameraTarget | undefined)?.zoom === 'number'
	);
}

function normalizeGuideOverlay(
	fallback: CanvasTourGuideOverlay,
	overlay: Partial<CanvasTourGuideOverlay> | undefined,
) {
	if (!overlay) {
		return fallback;
	}

	return {
		label: typeof overlay.label === 'string' ? overlay.label : fallback.label,
		title: typeof overlay.title === 'string' ? overlay.title : fallback.title,
		description:
			typeof overlay.description === 'string' ? overlay.description : fallback.description,
		hint: typeof overlay.hint === 'string' ? overlay.hint : fallback.hint,
		accentColor:
			typeof overlay.accentColor === 'string' ? overlay.accentColor : fallback.accentColor,
		surfaceOpacity:
			typeof overlay.surfaceOpacity === 'number'
				? overlay.surfaceOpacity
				: fallback.surfaceOpacity,
		placement: {
			leftRem:
				typeof overlay.placement?.leftRem === 'number'
					? overlay.placement.leftRem
					: fallback.placement.leftRem,
			topRem:
				typeof overlay.placement?.topRem === 'number'
					? overlay.placement.topRem
					: fallback.placement.topRem,
			widthRem:
				typeof overlay.placement?.widthRem === 'number'
					? overlay.placement.widthRem
					: fallback.placement.widthRem,
		},
	} satisfies CanvasTourGuideOverlay;
}

function normalizeRegisteredSceneSnapshot(
	sceneId: string,
	input: Partial<RegisteredTourSceneSnapshot>,
): RegisteredTourSceneSnapshot | null {
	if (!Array.isArray(input.elements) || !isValidCamera(input.camera)) {
		return null;
	}
	const fallbackChapter = canvasTourChapters.find((chapter) => chapter.id === sceneId) ?? canvasTourChapters[0];
	if (!fallbackChapter) {
		return null;
	}

	return {
		sceneId,
		elements: normalizeSceneElements(input.elements as ExcalidrawElement[]),
		camera: input.camera,
		overlay: normalizeGuideOverlay(
			fallbackChapter.overlay,
			input.overlay as Partial<CanvasTourGuideOverlay> | undefined,
		),
		capturedAt: typeof input.capturedAt === 'string' ? input.capturedAt : new Date().toISOString(),
	};
}

export function loadRegisteredTourScenes(): RegisteredTourSceneLibrary | null {
	if (!IS_DEV || typeof window === 'undefined') {
		return null;
	}

	try {
		const raw = window.localStorage.getItem(TOUR_REGISTERED_SCENE_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as
			| Partial<RegisteredTourSceneSnapshot>
			| Partial<RegisteredTourSceneLibrary>;

		if ('scenes' in parsed && parsed.scenes && typeof parsed.scenes === 'object') {
			const scenes = Object.entries(parsed.scenes).reduce<Record<string, RegisteredTourSceneSnapshot>>(
				(acc, [sceneId, value]) => {
					const normalized = normalizeRegisteredSceneSnapshot(
						sceneId,
						value as Partial<RegisteredTourSceneSnapshot>,
					);
					if (normalized) {
						acc[sceneId] = normalized;
					}
					return acc;
				},
				{},
			);
			if (Object.keys(scenes).length === 0) {
				return null;
			}
			return {
				scenes,
				updatedAt:
					typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
			};
		}

		const firstChapter = canvasTourChapters[0];
		const migrated = firstChapter
			? normalizeRegisteredSceneSnapshot(firstChapter.id, parsed as Partial<RegisteredTourSceneSnapshot>)
			: null;
		if (!migrated) {
			return null;
		}
		return {
			scenes: {
				[migrated.sceneId]: migrated,
			},
			updatedAt: migrated.capturedAt,
		};
	} catch {
		return null;
	}
}

export function persistRegisteredTourScenes(library: RegisteredTourSceneLibrary) {
	if (!IS_DEV || typeof window === 'undefined') {
		return;
	}

	window.localStorage.setItem(TOUR_REGISTERED_SCENE_STORAGE_KEY, JSON.stringify(library));
}

export function clearRegisteredTourScenes() {
	if (!IS_DEV || typeof window === 'undefined') {
		return;
	}

	window.localStorage.removeItem(TOUR_REGISTERED_SCENE_STORAGE_KEY);
}
