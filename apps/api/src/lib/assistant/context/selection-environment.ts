import type {
	AssistantCanvasBounds,
	AssistantCanvasElementSummary,
	CanvasElement,
} from '@ai-canvas/shared/types';
import { SELECTION_ENVIRONMENT_LIMIT } from './constants';
import { buildElementSummary, compareByPriorityAndLabel } from './context-builders';
import { toElementId } from './element-parsers';
import { buildBounds } from './geometry';

function rectDistance(a: AssistantCanvasBounds, b: AssistantCanvasBounds): number {
	const dx = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width));
	const dy = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height));
	return Math.sqrt(dx * dx + dy * dy);
}

export function buildSelectionEnvironment(
	elements: CanvasElement[],
	selectedIdSet: Set<string>,
	selectedBounds?: AssistantCanvasBounds,
): AssistantCanvasElementSummary[] | undefined {
	if (!selectedBounds) {
		return undefined;
	}

	const candidates = elements
		.filter((element) => {
			const id = toElementId(element);
			return id ? !selectedIdSet.has(id) : false;
		})
		.map((element) => {
			const bounds = buildBounds(element);
			const distance = bounds ? rectDistance(selectedBounds, bounds) : Number.POSITIVE_INFINITY;
			return { element, distance };
		})
		.filter((candidate) => Number.isFinite(candidate.distance))
		.sort((left, right) => {
			if (left.distance !== right.distance) {
				return left.distance - right.distance;
			}
			return compareByPriorityAndLabel(left.element, right.element);
		})
		.slice(0, SELECTION_ENVIRONMENT_LIMIT)
		.map((candidate) => buildElementSummary(candidate.element, candidate.distance));

	return candidates.length > 0 ? candidates : undefined;
}
