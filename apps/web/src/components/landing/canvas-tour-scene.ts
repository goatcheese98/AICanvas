import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { BinaryFileData } from '@excalidraw/excalidraw/types';
import { DEFAULT_TOUR_SCENE_STATE } from './canvas-tour-scene-data';
import type { DemoScene, TourBindableNode, TourNodeKey } from './canvas-tour-scene-types';
export type { DemoScene, TourNodeKey } from './canvas-tour-scene-types';
export { TOUR_IMAGE_FILE_ID } from './canvas-tour-scene-data';
import {
	createArrowBetween,
	createCanvasImageElement,
	createCardFromConfig,
	createFreeText,
	createLooseShape,
	createOverlayElement,
} from './canvas-tour-scene-utils';

export function createCanvasTourScene(imageId: string): DemoScene {
	// Create all card nodes
	const cardNodes: Record<Exclude<TourNodeKey, 'studyNote' | 'checklistNote'>, TourBindableNode> = {
		attention: createCardFromConfig(DEFAULT_TOUR_SCENE_STATE.cards.attention),
		prompt: createCardFromConfig(DEFAULT_TOUR_SCENE_STATE.cards.prompt),
		hallucination: createCardFromConfig(DEFAULT_TOUR_SCENE_STATE.cards.hallucination),
		ragPipeline: createCardFromConfig(DEFAULT_TOUR_SCENE_STATE.cards.ragPipeline),
		question: createCardFromConfig(DEFAULT_TOUR_SCENE_STATE.cards.question),
		retriever: createCardFromConfig(DEFAULT_TOUR_SCENE_STATE.cards.retriever),
		generator: createCardFromConfig(DEFAULT_TOUR_SCENE_STATE.cards.generator),
	};

	// Create note overlays
	const studyNote = createOverlayElement({
		type: 'markdown',
		left: DEFAULT_TOUR_SCENE_STATE.notes.studyNote.left,
		top: DEFAULT_TOUR_SCENE_STATE.notes.studyNote.top,
		width: DEFAULT_TOUR_SCENE_STATE.notes.studyNote.width,
		height: DEFAULT_TOUR_SCENE_STATE.notes.studyNote.height,
		backgroundColor: DEFAULT_TOUR_SCENE_STATE.notes.studyNote.backgroundColor,
		strokeColor: DEFAULT_TOUR_SCENE_STATE.notes.studyNote.strokeColor,
		strokeWidth: DEFAULT_TOUR_SCENE_STATE.notes.studyNote.strokeWidth,
		roundness: DEFAULT_TOUR_SCENE_STATE.notes.studyNote.roundness,
		customData: DEFAULT_TOUR_SCENE_STATE.notes.studyNote.customData,
	});

	const checklistNote = createOverlayElement({
		type: 'markdown',
		left: DEFAULT_TOUR_SCENE_STATE.notes.checklistNote.left,
		top: DEFAULT_TOUR_SCENE_STATE.notes.checklistNote.top,
		width: DEFAULT_TOUR_SCENE_STATE.notes.checklistNote.width,
		height: DEFAULT_TOUR_SCENE_STATE.notes.checklistNote.height,
		backgroundColor: DEFAULT_TOUR_SCENE_STATE.notes.checklistNote.backgroundColor,
		strokeColor: DEFAULT_TOUR_SCENE_STATE.notes.checklistNote.strokeColor,
		strokeWidth: DEFAULT_TOUR_SCENE_STATE.notes.checklistNote.strokeWidth,
		roundness: DEFAULT_TOUR_SCENE_STATE.notes.checklistNote.roundness,
		customData: DEFAULT_TOUR_SCENE_STATE.notes.checklistNote.customData,
	});

	// Combine all nodes for arrow creation
	const nodes: Record<TourNodeKey, TourBindableNode> = {
		...cardNodes,
		studyNote,
		checklistNote,
	};

	// Build scene elements in render order
	const rawElements: ExcalidrawElement[] = [
		// Text blocks
		...DEFAULT_TOUR_SCENE_STATE.textBlocks.map((textBlock) => createFreeText(textBlock)),

		// Loose shapes
		...DEFAULT_TOUR_SCENE_STATE.looseShapes.map((shape) => createLooseShape(shape)),

		// Loose text blocks
		...DEFAULT_TOUR_SCENE_STATE.looseTextBlocks.map((textBlock) => createFreeText(textBlock)),

		// Card elements
		...cardNodes.attention.elements,
		...cardNodes.prompt.elements,
		...cardNodes.hallucination.elements,
		...cardNodes.ragPipeline.elements,

		// First set of arrows (connecting cards)
		...DEFAULT_TOUR_SCENE_STATE.arrows.slice(0, 2).map((arrow) =>
			createArrowBetween({
				source: nodes[arrow.source],
				target: nodes[arrow.target],
				sourceAnchor: arrow.sourceAnchor,
				targetAnchor: arrow.targetAnchor,
				strokeColor: arrow.strokeColor,
			}),
		),

		// Lecture clip section
		createFreeText(DEFAULT_TOUR_SCENE_STATE.lectureClipLabel),
		createCanvasImageElement({
			fileId: imageId as BinaryFileData['id'],
			...DEFAULT_TOUR_SCENE_STATE.lectureClipImage,
		}),

		// RAG flow section
		createFreeText(DEFAULT_TOUR_SCENE_STATE.ragFlowLabel),
		...cardNodes.question.elements,
		...cardNodes.retriever.elements,

		// Second set of arrows (RAG flow)
		...DEFAULT_TOUR_SCENE_STATE.arrows.slice(2).map((arrow) =>
			createArrowBetween({
				source: nodes[arrow.source],
				target: nodes[arrow.target],
				sourceAnchor: arrow.sourceAnchor,
				targetAnchor: arrow.targetAnchor,
				strokeColor: arrow.strokeColor,
			}),
		),

		// Generator and notes
		...cardNodes.generator.elements,
		...studyNote.elements,
		...checklistNote.elements,

		// Summary label
		createFreeText(DEFAULT_TOUR_SCENE_STATE.summaryLabel),
	] as ExcalidrawElement[];

	return {
		elements: rawElements,
		files: {},
	};
}
