import { useAppStore } from '@/stores/store';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useMemo } from 'react';

type ElementWithMeta = ExcalidrawElement & {
	points?: ReadonlyArray<readonly [number, number]>;
	groupIds?: string[];
};

/**
 * Detects whether an element belongs to an AI vector group inserted by the
 * layer-based vectorization pipeline. Those elements carry nested groupIds of
 * the form: [<overallId>-layer-<n>, <overallId>].
 */
function isAiVectorElement(element: ExcalidrawElement): boolean {
	const groupIds = (element as ElementWithMeta).groupIds;
	return (
		Array.isArray(groupIds) &&
		groupIds.length >= 2 &&
		typeof groupIds[0] === 'string' &&
		groupIds[0].includes('-layer-')
	);
}

/**
 * Converts an Excalidraw element's polygon data to an SVG path string in
 * screen (pixel) coordinates. Elements from the sketch vectorizer are
 * `type: 'line'` with a `points` array relative to `(el.x, el.y)`.
 */
function elementToSvgPath(
	element: ExcalidrawElement,
	scrollX: number,
	scrollY: number,
	zoom: number,
): string | null {
	const el = element as ElementWithMeta;

	if (el.points && el.points.length >= 3) {
		// Polygon points are relative to the element's (x, y) origin.
		// The last point duplicates the first to close the loop; skip it for Z.
		const pts = el.points;
		const lastIsDuplicate =
			pts.length >= 2 &&
			pts[pts.length - 1][0] === pts[0][0] &&
			pts[pts.length - 1][1] === pts[0][1];
		const renderPts = lastIsDuplicate ? pts.slice(0, -1) : pts;

		const toScreen = (px: number, py: number) => {
			const sx = ((el.x + px + scrollX) * zoom).toFixed(2);
			const sy = ((el.y + py + scrollY) * zoom).toFixed(2);
			return `${sx},${sy}`;
		};

		const d =
			renderPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toScreen(p[0], p[1])}`).join(' ') + ' Z';
		return d;
	}

	// Fallback for rectangle/ellipse: use bounding box
	const sx = ((el.x + scrollX) * zoom).toFixed(2);
	const sy = ((el.y + scrollY) * zoom).toFixed(2);
	const sw = ((el.width ?? 0) * zoom).toFixed(2);
	const sh = ((el.height ?? 0) * zoom).toFixed(2);
	if (Number(sw) <= 0 || Number(sh) <= 0) return null;
	return `M${sx},${sy} h${sw} v${sh} h-${sw} Z`;
}

// Marching ants dash length in screen pixels — fixed for visual consistency
const DASH_LEN = 9;
const GAP_LEN = 7;

export function AIVectorSelectionOverlay() {
	const elements = useAppStore((s) => s.elements);
	const selectedElementIds = useAppStore(
		(s) => (s.appState.selectedElementIds ?? {}) as Record<string, boolean>,
	);
	const scrollX = useAppStore((s) => s.appState.scrollX ?? 0);
	const scrollY = useAppStore((s) => s.appState.scrollY ?? 0);
	const zoom = useAppStore((s) => s.appState.zoom?.value ?? 1);

	const result = useMemo(() => {
		const aiElements = elements.filter(
			(el) => selectedElementIds[el.id] === true && isAiVectorElement(el),
		);
		if (aiElements.length === 0) return null;

		// Detect selection level by counting distinct layer-group IDs:
		//   >1 distinct layer IDs → outer (full) group selected (first click)
		//   1 distinct layer ID   → single color layer selected (second click)
		const layerGroupIds = new Set(
			aiElements.map((el) => (el as ElementWithMeta).groupIds?.[0] ?? ''),
		);
		const isFullGroup = layerGroupIds.size > 1;

		const paths = aiElements
			.map((el) => elementToSvgPath(el, scrollX, scrollY, zoom))
			.filter((d): d is string => d !== null);

		return { paths, isFullGroup };
	}, [elements, selectedElementIds, scrollX, scrollY, zoom]);

	if (!result || result.paths.length === 0) return null;

	// Full-group selection → more prominent / faster; layer → slower / subtler
	const animDuration = result.isFullGroup ? '0.9s' : '1.4s';
	const strokeColor = result.isFullGroup ? '#6c87f7' : '#a8beff';
	const shadowColor = 'rgba(0,0,0,0.5)';
	const dashArray = `${DASH_LEN} ${GAP_LEN}`;

	return (
		<div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 3 }}>
			<svg
				style={{
					position: 'absolute',
					inset: 0,
					width: '100%',
					height: '100%',
				}}
				aria-hidden="true"
			>
				<defs>
					<style>{`
						@keyframes ai-vector-march {
							from { stroke-dashoffset: 0; }
							to   { stroke-dashoffset: -${DASH_LEN + GAP_LEN}; }
						}
					`}</style>
				</defs>
				{result.paths.map((d, i) => (
					<g key={i}>
						{/* Dark shadow stroke for contrast on any background */}
						<path
							d={d}
							fill="none"
							stroke={shadowColor}
							strokeWidth={3.5}
							strokeDasharray={dashArray}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						{/* Animated foreground marching ants */}
						<path
							d={d}
							fill="none"
							stroke={strokeColor}
							strokeWidth={2}
							strokeDasharray={dashArray}
							strokeLinecap="round"
							strokeLinejoin="round"
							style={{
								animation: `ai-vector-march ${animDuration} linear infinite`,
							}}
						/>
					</g>
				))}
			</svg>
		</div>
	);
}
