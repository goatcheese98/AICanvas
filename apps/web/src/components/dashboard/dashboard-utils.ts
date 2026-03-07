import type { Canvas } from '@ai-canvas/shared/types';
import { getCanvasTitleKey } from '@ai-canvas/shared/schemas';

export type DashboardSortOption = 'recent' | 'alphabetical' | 'favorites';

export function filterAndSortCanvases(
	canvases: Canvas[],
	searchTerm: string,
	sortBy: DashboardSortOption,
): Canvas[] {
	const normalizedSearch = searchTerm.trim().toLowerCase();

	return [...canvases]
		.filter((canvas) => {
			if (!normalizedSearch) return true;
			const title = canvas.title.toLowerCase();
			const description = canvas.description?.toLowerCase() ?? '';
			return title.includes(normalizedSearch) || description.includes(normalizedSearch);
		})
		.sort((left, right) => {
			if (sortBy === 'alphabetical') {
				return left.title.localeCompare(right.title);
			}

			if (sortBy === 'favorites') {
				const favoriteDelta = Number(right.isFavorite) - Number(left.isFavorite);
				if (favoriteDelta !== 0) return favoriteDelta;
			}

			return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
		});
}

export function hasCanvasTitleConflict(
	canvases: Canvas[],
	title: string,
	excludeCanvasId?: string,
): boolean {
	const titleKey = getCanvasTitleKey(title);
	return canvases.some(
		(canvas) => canvas.id !== excludeCanvasId && getCanvasTitleKey(canvas.title) === titleKey,
	);
}
