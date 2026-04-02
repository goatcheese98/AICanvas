import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';

function areElementPointSetsEqual(left: unknown, right: unknown) {
	return (
		Array.isArray(left) &&
		Array.isArray(right) &&
		left.length === right.length &&
		left.every((entry, index) => {
			if (
				!Array.isArray(entry) ||
				!Array.isArray(right[index]) ||
				entry.length < 2 ||
				right[index].length < 2
			) {
				return false;
			}
			return entry[0] === right[index][0] && entry[1] === right[index][1];
		})
	);
}

export function areExcalidrawElementsEquivalent(
	left: readonly ExcalidrawElement[],
	right: readonly ExcalidrawElement[],
) {
	return (
		left.length === right.length &&
		left.every((element, index) => {
			const other = right[index];
			if (!other || element.id !== other.id || element.type !== other.type) {
				return false;
			}
			if (
				element.x !== other.x ||
				element.y !== other.y ||
				element.width !== other.width ||
				element.height !== other.height ||
				element.angle !== other.angle ||
				element.strokeWidth !== other.strokeWidth ||
				element.version !== other.version ||
				element.versionNonce !== other.versionNonce ||
				element.updated !== other.updated ||
				element.isDeleted !== other.isDeleted ||
				element.customData !== other.customData
			) {
				return false;
			}
			const leftPoints = (element as ExcalidrawElement & { points?: unknown }).points;
			const rightPoints = (other as ExcalidrawElement & { points?: unknown }).points;
			if (leftPoints || rightPoints) {
				return areElementPointSetsEqual(leftPoints, rightPoints);
			}
			return true;
		})
	);
}

function areSelectedElementIdsEquivalent(
	left: Partial<AppState>['selectedElementIds'],
	right: Partial<AppState>['selectedElementIds'],
) {
	const leftIds = left ?? {};
	const rightIds = right ?? {};
	const leftKeys = Object.keys(leftIds);
	const rightKeys = Object.keys(rightIds);
	if (leftKeys.length !== rightKeys.length) {
		return false;
	}
	return leftKeys.every((key) => leftIds[key] === rightIds[key]);
}

function areZoomValuesEquivalent(
	left: Partial<AppState>['zoom'],
	right: Partial<AppState>['zoom'],
) {
	if (left === right) {
		return true;
	}
	if (!left || !right) {
		return left === right;
	}
	return left.value === right.value;
}

export function areExcalidrawAppStatesEquivalent<T extends Partial<AppState>>(left: T, right: T) {
	if (left === right) {
		return true;
	}

	const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
	for (const key of keys) {
		if (key === 'selectedElementIds') {
			if (!areSelectedElementIdsEquivalent(left.selectedElementIds, right.selectedElementIds)) {
				return false;
			}
			continue;
		}

		if (key === 'zoom') {
			if (!areZoomValuesEquivalent(left.zoom, right.zoom)) {
				return false;
			}
			continue;
		}

		if (!Object.is(left[key as keyof T], right[key as keyof T])) {
			return false;
		}
	}

	return true;
}

export function areBinaryFilesEquivalent(left: BinaryFiles, right: BinaryFiles) {
	if (left === right) {
		return true;
	}

	const leftFiles = left ?? {};
	const rightFiles = right ?? {};
	const leftKeys = Object.keys(leftFiles);
	const rightKeys = Object.keys(rightFiles);
	if (leftKeys.length !== rightKeys.length) {
		return false;
	}

	return leftKeys.every((key) => leftFiles[key] === rightFiles[key]);
}
