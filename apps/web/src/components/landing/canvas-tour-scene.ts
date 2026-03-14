import { FONT_FAMILY, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { BinaryFileData, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { OverlayType } from '@ai-canvas/shared/types';
import { createOverlayElementDraft } from '@/components/canvas/element-factories';

export interface DemoScene {
	elements: ExcalidrawElement[];
	files: BinaryFiles;
}

interface TourBoundElement {
	id: string;
	type: 'arrow' | 'text';
}

interface TourBindableNode {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	boundElements: TourBoundElement[];
	container: ExcalidrawElement;
	elements: ExcalidrawElement[];
}

type TourNodeKey =
	| 'attention'
	| 'prompt'
	| 'hallucination'
	| 'ragPipeline'
	| 'question'
	| 'retriever'
	| 'generator'
	| 'studyNote'
	| 'checklistNote';

type TourAnchorSide = 'left' | 'right' | 'top' | 'bottom';

interface TourAnchorConfig {
	side: TourAnchorSide;
	focus?: number;
}

interface TourTextConfig {
	x: number;
	y: number;
	text: string;
	strokeColor: string;
	fontSize: number;
	fontFamily: number;
	widthPadding?: number;
	heightPadding?: number;
}

interface TourLooseShapeConfig {
	type: 'ellipse' | 'rectangle';
	x: number;
	y: number;
	width: number;
	height: number;
	strokeColor: string;
	backgroundColor: string;
	strokeWidth: number;
	roundness?: ExcalidrawElement['roundness'];
	roughness?: number;
	opacity?: number;
}

interface TourCardConfig {
	x: number;
	y: number;
	label: string;
	backgroundColor: string;
	containerStrokeColor: string;
	width: number;
	height: number;
	fontSize?: number;
	fontFamily?: number;
}

interface TourNoteConfig {
	left: number;
	top: number;
	width: number;
	height: number;
	backgroundColor: string;
	strokeColor: string;
	strokeWidth: number;
	roundness: ExcalidrawElement['roundness'];
	customData: Record<string, unknown>;
}

interface TourArrowConfig {
	source: TourNodeKey;
	target: TourNodeKey;
	sourceAnchor: TourAnchorConfig;
	targetAnchor: TourAnchorConfig;
	strokeColor?: string;
}

const TOUR_ROUGH_TEXT_FONT = FONT_FAMILY.Nunito;
const TOUR_TITLE_FONT = FONT_FAMILY.Excalifont;

export const TOUR_IMAGE_FILE_ID = 'canvas-tour-lecture-image' as BinaryFileData['id'];

const DEFAULT_TOUR_SCENE_STATE: {
	textBlocks: TourTextConfig[];
	looseTextBlocks: TourTextConfig[];
	looseShapes: TourLooseShapeConfig[];
	cards: Record<Exclude<TourNodeKey, 'studyNote' | 'checklistNote'>, TourCardConfig>;
	notes: Record<'studyNote' | 'checklistNote', TourNoteConfig>;
	lectureClipLabel: TourTextConfig;
	lectureClipImage: { x: number; y: number; width: number; height: number; angle: number };
	ragFlowLabel: TourTextConfig;
	summaryLabel: TourTextConfig;
	arrows: TourArrowConfig[];
} = {
	textBlocks: [
		{
			x: 432,
			y: 116,
			text: 'LLM Midterm Prep',
			strokeColor: '#1f2430',
			fontSize: 40,
			fontFamily: TOUR_TITLE_FONT,
			widthPadding: 52,
			heightPadding: 12,
		},
		{
			x: 424,
			y: 176,
			text: 'Midterm 1 · lectures 3–7 · transformers, RAG, eval',
			strokeColor: '#667085',
			fontSize: 18,
			fontFamily: TOUR_ROUGH_TEXT_FONT,
			widthPadding: 64,
			heightPadding: 14,
		},
		{
			x: 456,
			y: 252,
			text: 'Professor said retrieval will show up on short answers.',
			strokeColor: '#697386',
			fontSize: 18,
			fontFamily: TOUR_ROUGH_TEXT_FONT,
			widthPadding: 56,
			heightPadding: 12,
		},
		{
			x: 1184,
			y: 134,
			text: 'Questions to revisit',
			strokeColor: '#768091',
			fontSize: 16,
			fontFamily: TOUR_ROUGH_TEXT_FONT,
			widthPadding: 30,
			heightPadding: 10,
		},
		{
			x: 1186,
			y: 168,
			text: 'Need better example for precision vs recall.',
			strokeColor: '#7a8290',
			fontSize: 16,
			fontFamily: TOUR_ROUGH_TEXT_FONT,
			widthPadding: 54,
			heightPadding: 12,
		},
		{
			x: 1188,
			y: 202,
			text: 'Chapter 5 attention math still fuzzy.',
			strokeColor: '#7a8290',
			fontSize: 16,
			fontFamily: TOUR_ROUGH_TEXT_FONT,
			widthPadding: 46,
			heightPadding: 12,
		},
	],
	looseTextBlocks: [],
	looseShapes: [
		{
			type: 'ellipse',
			x: 1112,
			y: 286,
			width: 16,
			height: 16,
			strokeColor: '#cbd5e1',
			backgroundColor: '#ffffff',
			strokeWidth: 1,
			roughness: 0.8,
			opacity: 80,
		},
		{
			type: 'rectangle',
			x: 786,
			y: 922,
			width: 34,
			height: 14,
			strokeColor: '#d8dde8',
			backgroundColor: '#f8fafc',
			strokeWidth: 1,
			roundness: { type: 3, value: 8 },
			roughness: 0.7,
			opacity: 72,
		},
	],
	cards: {
		attention: {
			x: 458,
			y: 350,
			label: 'Attention vs self-attention',
			backgroundColor: '#d6eadc',
			containerStrokeColor: '#90b79f',
			width: 300,
			height: 136,
		},
		prompt: {
			x: 836,
			y: 360,
			label: 'Prompting vs fine-tuning',
			backgroundColor: '#f7e694',
			containerStrokeColor: '#d8bf62',
			width: 314,
			height: 132,
		},
		hallucination: {
			x: 458,
			y: 544,
			label: 'What causes hallucinations?',
			backgroundColor: '#beddff',
			containerStrokeColor: '#8db0d6',
			width: 326,
			height: 144,
		},
		ragPipeline: {
			x: 876,
			y: 560,
			label: 'RAG pipeline',
			backgroundColor: '#f5c897',
			containerStrokeColor: '#d3a26a',
			width: 228,
			height: 128,
		},
		question: {
			x: 532,
			y: 892,
			label: 'User Question',
			backgroundColor: '#E5F0FF',
			containerStrokeColor: '#9AB8F2',
			width: 188,
			height: 78,
		},
		retriever: {
			x: 908,
			y: 810,
			label: 'Retriever',
			backgroundColor: '#FDE9B4',
			containerStrokeColor: '#E3C15B',
			width: 154,
			height: 76,
		},
		generator: {
			x: 866,
			y: 1004,
			label: 'LLM Generator',
			backgroundColor: '#E7F3EC',
			containerStrokeColor: '#9FBCA7',
			width: 204,
			height: 80,
		},
	},
	notes: {
		studyNote: {
			left: 1290,
			top: 304,
			width: 500,
			height: 466,
			backgroundColor: '#fffaf0',
			strokeColor: '#dfbd60',
			strokeWidth: 3,
			roundness: { type: 3, value: 30 },
			customData: {
				title: 'Study',
				editorMode: 'hybrid',
				content: `# Midterm study guide

Still rough. Need to merge lecture notes with textbook examples.

## Core concepts
- Transformer = token embeddings + positional information + stacked attention layers
- RAG retrieves external context before generation
- Fine-tuning updates weights; prompting does not

## Examples to remember
- Retrieval assistant for course notes
- Hallucinated citation example from lecture 6
`,
				settings: {
					fontSize: 16,
					lineHeight: 1.58,
					autoHideToolbar: true,
					font: '"DM Sans", system-ui, sans-serif',
				},
			},
		},
		checklistNote: {
			left: 1162,
			top: 860,
			width: 354,
			height: 228,
			backgroundColor: '#f6f8ff',
			strokeColor: '#8fb3ff',
			strokeWidth: 4,
			roundness: { type: 1 },
			customData: {
				title: 'To do',
				editorMode: 'hybrid',
				content: `# Before the exam

- [ ] Clean notes
- [ ] Group examples
- [ ] Make 5 practice questions
`,
				settings: {
					fontSize: 15,
					lineHeight: 1.5,
					autoHideToolbar: true,
					font: '"DM Sans", system-ui, sans-serif',
				},
			},
		},
	},
	lectureClipLabel: {
		x: 106,
		y: 708,
		text: 'Lecture clip: View from front row',
		strokeColor: '#7a8290',
		fontSize: 18,
		fontFamily: TOUR_ROUGH_TEXT_FONT,
		widthPadding: 42,
		heightPadding: 14,
	},
	lectureClipImage: {
		x: 78,
		y: 762,
		width: 320,
		height: 240,
		angle: -0.015,
	},
	ragFlowLabel: {
		x: 856,
		y: 780,
		text: 'My RAG Flow Sketches',
		strokeColor: '#6c7485',
		fontSize: 16,
		fontFamily: TOUR_ROUGH_TEXT_FONT,
		widthPadding: 24,
		heightPadding: 10,
	},
	summaryLabel: {
		x: 404,
		y: 1088,
		text: 'Exam covers decoder-only models, retrieval flow,\nand evaluation basics.',
		strokeColor: '#7a8290',
		fontSize: 17,
		fontFamily: TOUR_ROUGH_TEXT_FONT,
		widthPadding: 58,
		heightPadding: 14,
	},
	arrows: [
		{
			source: 'attention',
			target: 'prompt',
			sourceAnchor: { side: 'right', focus: 0 },
			targetAnchor: { side: 'left', focus: 0 },
		},
		{
			source: 'prompt',
			target: 'ragPipeline',
			sourceAnchor: { side: 'bottom', focus: -0.18 },
			targetAnchor: { side: 'top', focus: 0.02 },
		},
		{
			source: 'question',
			target: 'retriever',
			sourceAnchor: { side: 'right', focus: 0.08 },
			targetAnchor: { side: 'left', focus: -0.15 },
		},
		{
			source: 'retriever',
			target: 'generator',
			sourceAnchor: { side: 'bottom', focus: 0.06 },
			targetAnchor: { side: 'top', focus: -0.02 },
		},
	],
};

function createOverlayElement({
	type,
	left,
	top,
	width,
	height,
	backgroundColor,
	strokeColor,
	strokeWidth,
	roundness,
	customData,
}: {
	type: OverlayType;
	left: number;
	top: number;
	width: number;
	height: number;
	backgroundColor?: string;
	strokeColor?: string;
	strokeWidth?: number;
	roundness?: ExcalidrawElement['roundness'];
	customData?: Record<string, unknown>;
}) {
	const center = {
		x: left + width / 2,
		y: top + height / 2,
	};
	const boundElements: TourBoundElement[] = [];
	const draft = createOverlayElementDraft(type, center, customData) as unknown as ExcalidrawElement;
	const element = {
		...draft,
		x: left,
		y: top,
		width,
		height,
		backgroundColor: backgroundColor ?? draft.backgroundColor,
		strokeColor: strokeColor ?? draft.strokeColor,
		strokeWidth: strokeWidth ?? draft.strokeWidth,
		roundness: roundness ?? draft.roundness,
		boundElements,
	} as ExcalidrawElement;

	return {
		id: element.id,
		x: left,
		y: top,
		width,
		height,
		boundElements,
		container: element,
		elements: [element],
	} satisfies TourBindableNode;
}

function createRawElements(definitions: Record<string, unknown>[]) {
	return convertToExcalidrawElements(definitions as never) as ExcalidrawElement[];
}

function createLooseShape({
	type,
	x,
	y,
	width,
	height,
	strokeColor,
	backgroundColor,
	strokeWidth,
	roundness = null,
	roughness = 0.8,
	opacity = 100,
}: TourLooseShapeConfig) {
	const [shape] = createRawElements([
		{
			type,
			x,
			y,
			width,
			height,
			strokeColor,
			backgroundColor,
			strokeWidth,
			roughness,
			opacity,
			fillStyle: 'solid',
			roundness,
		},
	]);

	return shape;
}

function createCanvasImageElement(input: {
	fileId: BinaryFileData['id'];
	x: number;
	y: number;
	width: number;
	height: number;
	angle?: number;
}) {
	return {
		id: crypto.randomUUID(),
		type: 'image' as const,
		fileId: input.fileId,
		status: 'saved' as const,
		scale: [1, 1] as [number, number],
		crop: null,
		x: input.x,
		y: input.y,
		width: input.width,
		height: input.height,
		angle: input.angle ?? 0,
		strokeColor: 'transparent',
		backgroundColor: 'transparent',
		fillStyle: 'solid' as const,
		strokeWidth: 0,
		strokeStyle: 'solid' as const,
		roughness: 0,
		opacity: 100,
		roundness: null,
		seed: Math.floor(Math.random() * 100000),
		version: 1,
		versionNonce: Math.floor(Math.random() * 2 ** 31),
		isDeleted: false,
		groupIds: [],
		frameId: null,
		boundElements: null,
		updated: Date.now(),
		link: null,
		locked: false,
		index: `a${Date.now()}` as any,
	} as const;
}

function createFreeText({
	x,
	y,
	text,
	strokeColor,
	fontSize,
	fontFamily,
	widthPadding = 28,
	heightPadding = 8,
}: {
	x: number;
	y: number;
	text: string;
	strokeColor: string;
	fontSize: number;
	fontFamily: number;
	widthPadding?: number;
	heightPadding?: number;
}) {
	const [textElement] = createRawElements([
		{
			type: 'text',
			x,
			y,
			text,
			strokeColor,
			fontSize,
			fontFamily,
		},
	]);

	return {
		...textElement,
		x: x - widthPadding / 2,
		width: (typeof textElement.width === 'number' ? textElement.width : 0) + widthPadding,
		height: (typeof textElement.height === 'number' ? textElement.height : 0) + heightPadding,
		autoResize: true,
		originalText: text,
	} as ExcalidrawElement;
}

function createBoundCard({
	id,
	x,
	y,
	label,
	backgroundColor,
	minWidth,
	minHeight,
	fontSize = 20,
	fontFamily = TOUR_ROUGH_TEXT_FONT,
	strokeColor = '#253041',
	containerStrokeColor,
	width: explicitWidth,
	height: explicitHeight,
}: {
	id?: string;
	x: number;
	y: number;
	label: string;
	backgroundColor: string;
	minWidth: number;
	minHeight: number;
	fontSize?: number;
	fontFamily?: number;
	strokeColor?: string;
	containerStrokeColor?: string;
	width?: number;
	height?: number;
}) {
	const [textElement] = createRawElements([
		{
			type: 'text',
			x: 0,
			y: 0,
			text: label,
			strokeColor,
			fontSize,
			fontFamily,
		},
	]);

	const horizontalPadding = 28;
	const verticalPadding = 22;
	const measuredWidth = typeof textElement.width === 'number' ? textElement.width : minWidth - 56;
	const measuredHeight = typeof textElement.height === 'number' ? textElement.height : fontSize * 1.4;
	const width = typeof explicitWidth === 'number'
		? Math.max(explicitWidth, minWidth)
		: Math.max(minWidth, measuredWidth + horizontalPadding * 2);
	const height = typeof explicitHeight === 'number'
		? Math.max(explicitHeight, minHeight)
		: Math.max(minHeight, measuredHeight + verticalPadding * 2);

	const [containerElement] = createRawElements([
		{
			type: 'rectangle',
			id,
			x,
			y,
			width,
			height,
			backgroundColor,
			strokeColor: containerStrokeColor ?? strokeColor,
			strokeWidth: 2,
			roughness: 0.9,
			roundness: { type: 3 },
		},
	]);

	const boundElements: TourBoundElement[] = [{ id: textElement.id, type: 'text' }];

	const container = {
		...containerElement,
		boundElements,
	} as ExcalidrawElement;

	const boundText = {
		...textElement,
		x: x + horizontalPadding,
		y: y + height / 2 - measuredHeight / 2,
		width: width - horizontalPadding * 2,
		containerId: container.id,
		textAlign: 'center',
		verticalAlign: 'middle',
		autoResize: false,
		originalText: label,
	} as ExcalidrawElement;

	return {
		id: container.id,
		x,
		y,
		width,
		height,
		boundElements,
		container,
		elements: [container, boundText],
	} satisfies TourBindableNode;
}

function createArrowBetween({
	source,
	target,
	sourceAnchor,
	targetAnchor,
	strokeColor = '#7d77fb',
}: {
	source: TourBindableNode;
	target: TourBindableNode;
	sourceAnchor: TourAnchorConfig;
	targetAnchor: TourAnchorConfig;
	strokeColor?: string;
}) {
	const id = crypto.randomUUID();

	const getAnchorPoint = (node: TourBindableNode, anchor: TourAnchorConfig) => {
		const focus = anchor.focus ?? 0;
		switch (anchor.side) {
			case 'left':
				return {
					x: node.x,
					y: node.y + node.height / 2 + (node.height / 2) * focus,
				};
			case 'right':
				return {
					x: node.x + node.width,
					y: node.y + node.height / 2 + (node.height / 2) * focus,
				};
			case 'top':
				return {
					x: node.x + node.width / 2 + (node.width / 2) * focus,
					y: node.y,
				};
			case 'bottom':
				return {
					x: node.x + node.width / 2 + (node.width / 2) * focus,
					y: node.y + node.height,
				};
		}
	};

	const getBindingFocus = (anchor: TourAnchorConfig) => anchor.focus ?? 0;
	const startPoint = getAnchorPoint(source, sourceAnchor);
	const endPoint = getAnchorPoint(target, targetAnchor);
	const [arrowElement] = createRawElements([
		{
			type: 'arrow',
			id,
			x: startPoint.x,
			y: startPoint.y,
			points: [
				[0, 0],
				[endPoint.x - startPoint.x, endPoint.y - startPoint.y],
			],
			strokeColor,
			strokeWidth: 3,
			roughness: 1.1,
			startArrowhead: null,
			endArrowhead: 'arrow',
			startBinding: { elementId: source.id, focus: getBindingFocus(sourceAnchor), gap: 0 },
			endBinding: { elementId: target.id, focus: getBindingFocus(targetAnchor), gap: 0 },
		},
	]);

	source.boundElements.push({ id, type: 'arrow' });
	target.boundElements.push({ id, type: 'arrow' });

	return arrowElement;
}

export function createCanvasTourScene(imageId: string): DemoScene {
	const createCardFromConfig = (config: TourCardConfig) => {
		const { width, height, ...rest } = config;
		return createBoundCard({
			...rest,
			minWidth: width,
			minHeight: height,
		});
	};

	const nodes: Record<TourNodeKey, TourBindableNode> = {
		attention: createCardFromConfig(DEFAULT_TOUR_SCENE_STATE.cards.attention),
		prompt: createCardFromConfig(DEFAULT_TOUR_SCENE_STATE.cards.prompt),
		hallucination: createCardFromConfig(DEFAULT_TOUR_SCENE_STATE.cards.hallucination),
		ragPipeline: createCardFromConfig(DEFAULT_TOUR_SCENE_STATE.cards.ragPipeline),
		question: createCardFromConfig(DEFAULT_TOUR_SCENE_STATE.cards.question),
		retriever: createCardFromConfig(DEFAULT_TOUR_SCENE_STATE.cards.retriever),
		generator: createCardFromConfig(DEFAULT_TOUR_SCENE_STATE.cards.generator),
		studyNote: createOverlayElement({
			type: 'markdown',
			...DEFAULT_TOUR_SCENE_STATE.notes.studyNote,
		}),
		checklistNote: createOverlayElement({
			type: 'markdown',
			...DEFAULT_TOUR_SCENE_STATE.notes.checklistNote,
		}),
	};

	const rawElements = [
		...DEFAULT_TOUR_SCENE_STATE.textBlocks.map((textBlock) => createFreeText(textBlock)),
		...DEFAULT_TOUR_SCENE_STATE.looseShapes.map((shape) => createLooseShape(shape)),
		...DEFAULT_TOUR_SCENE_STATE.looseTextBlocks.map((textBlock) => createFreeText(textBlock)),
		...nodes.attention.elements,
		...nodes.prompt.elements,
		...nodes.hallucination.elements,
		...nodes.ragPipeline.elements,
		...DEFAULT_TOUR_SCENE_STATE.arrows
			.slice(0, 2)
			.map((arrow) =>
				createArrowBetween({
					source: nodes[arrow.source],
					target: nodes[arrow.target],
					sourceAnchor: arrow.sourceAnchor,
					targetAnchor: arrow.targetAnchor,
					strokeColor: arrow.strokeColor,
				}),
			),
		createFreeText(DEFAULT_TOUR_SCENE_STATE.lectureClipLabel),
		createCanvasImageElement({
			fileId: imageId as any,
			...DEFAULT_TOUR_SCENE_STATE.lectureClipImage,
		}),
		createFreeText(DEFAULT_TOUR_SCENE_STATE.ragFlowLabel),
		...nodes.question.elements,
		...nodes.retriever.elements,
		...DEFAULT_TOUR_SCENE_STATE.arrows
			.slice(2)
			.map((arrow) =>
				createArrowBetween({
					source: nodes[arrow.source],
					target: nodes[arrow.target],
					sourceAnchor: arrow.sourceAnchor,
					targetAnchor: arrow.targetAnchor,
					strokeColor: arrow.strokeColor,
				}),
			),
		...nodes.generator.elements,
		...nodes.studyNote.elements,
		...nodes.checklistNote.elements,
		createFreeText(DEFAULT_TOUR_SCENE_STATE.summaryLabel),
	] as ExcalidrawElement[];

	return {
		elements: rawElements,
		files: {},
	};
}
