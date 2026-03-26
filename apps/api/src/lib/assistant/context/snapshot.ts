/**
 * Main snapshot orchestration for assistant context
 */

import type {
	AssistantCanvasMeta,
	AssistantContextMode,
	AssistantContextSnapshot,
	CanvasElement,
} from '@ai-canvas/shared/types';
import type { AppEnv } from '../../../types';
import { loadCanvasFromR2 } from '../../storage/canvas-storage';
import {
	buildSelectedContext,
	buildSelectionSummary,
	compareByPriorityAndLabel,
} from './context-builders';
import { getOverlayType, toElementId } from './element-parsers';
import { buildSelectionEnvironment, getSelectionBounds } from './geometry';
import { buildCanvasElementSummaries, buildCanvasSummary } from './summary-builders';

/** Input for building assistant context snapshot */
export interface BuildAssistantContextSnapshotInput {
	canvasId: string;
	contextMode: AssistantContextMode;
	selectedElementIds: string[];
	canvasMeta?: AssistantCanvasMeta;
}

/** Build the complete assistant context snapshot */
export async function buildAssistantContextSnapshot(
	bindings: AppEnv['Bindings'],
	userId: string,
	input: BuildAssistantContextSnapshotInput,
): Promise<AssistantContextSnapshot> {
	const canvas = await loadCanvasFromR2(bindings.R2, userId, input.canvasId);
	if (!canvas) {
		throw new Error('Canvas context not found');
	}

	const selectedIdSet = new Set(input.selectedElementIds);
	const elements = (canvas.elements ?? []) as CanvasElement[];
	const selectedElements = elements
		.filter((element) => {
			const id = toElementId(element);
			return id ? selectedIdSet.has(id) : false;
		})
		.sort(compareByPriorityAndLabel);
	const selectedContexts =
		input.contextMode === 'none' ? [] : selectedElements.map(buildSelectedContext);
	const selectedBounds = getSelectionBounds(selectedElements);
	const selectedOverlayTypes = Array.from(
		new Set(selectedElements.map((element) => getOverlayType(element)).filter(Boolean) as string[]),
	);

	return {
		canvasId: input.canvasId,
		totalElementCount: elements.length,
		selectedElementIds: input.selectedElementIds,
		selectedElementCount: selectedElements.length,
		selectedOverlayTypes,
		canvasMeta: input.canvasMeta,
		canvasSummary:
			input.contextMode === 'none'
				? undefined
				: buildCanvasSummary(elements, selectedElements.length),
		canvasElementSummaries:
			input.contextMode === 'all'
				? buildCanvasElementSummaries(elements, selectedIdSet)
				: undefined,
		selectionEnvironment:
			input.contextMode === 'none'
				? undefined
				: buildSelectionEnvironment(elements, selectedIdSet, selectedBounds),
		selectionSummary: buildSelectionSummary(selectedElements),
		selectedContexts,
	};
}

// Re-export types for convenience
export type { AssistantContextSnapshot, AssistantContextMode, AssistantCanvasMeta };
