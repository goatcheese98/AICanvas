import { createOverlayElementDraft } from '@/components/canvas/element-factories';
import type { OverlayType } from '@ai-canvas/shared/types';
import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import { FONT_FAMILY } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { BinaryFileData } from '@excalidraw/excalidraw/types';
import type {
	TourAnchorConfig,
	TourBindableNode,
	TourCardConfig,
	TourLooseShapeConfig,
	TourNodeKey,
	TourTextConfig,
} from './canvas-tour-scene-types';

const TOUR_ROUGH_TEXT_FONT = FONT_FAMILY.Nunito;

function createRawElements(definitions: Record<string, unknown>[]) {
	return convertToExcalidrawElements(definitions as never) as ExcalidrawElement[];
}

export function createOverlayElement({
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
}): TourBindableNode {
	const center = {
		x: left + width / 2,
		y: top + height / 2,
	};
	const boundElements: { id: string; type: 'arrow' | 'text' }[] = [];
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
	};
}

export function createLooseShape({
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
}: TourLooseShapeConfig): ExcalidrawElement {
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

export function createCanvasImageElement(input: {
	fileId: BinaryFileData['id'];
	x: number;
	y: number;
	width: number;
	height: number;
	angle?: number;
}): ExcalidrawElement {
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
		index: `a${Date.now()}` as ExcalidrawElement['index'],
	} as const;
}

export function createFreeText({
	x,
	y,
	text,
	strokeColor,
	fontSize,
	fontFamily,
	widthPadding = 28,
	heightPadding = 8,
}: TourTextConfig): ExcalidrawElement {
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
}): TourBindableNode {
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
	const measuredHeight =
		typeof textElement.height === 'number' ? textElement.height : fontSize * 1.4;
	const width =
		typeof explicitWidth === 'number'
			? Math.max(explicitWidth, minWidth)
			: Math.max(minWidth, measuredWidth + horizontalPadding * 2);
	const height =
		typeof explicitHeight === 'number'
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

	const boundElements: { id: string; type: 'arrow' | 'text' }[] = [
		{ id: textElement.id, type: 'text' },
	];

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
	};
}

export function createArrowBetween({
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
}): ExcalidrawElement {
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

export function createCardFromConfig(config: TourCardConfig): TourBindableNode {
	const { width, height, ...rest } = config;
	return createBoundCard({
		...rest,
		minWidth: width,
		minHeight: height,
	});
}

function createSceneNodes(
	cards: Record<Exclude<TourNodeKey, 'studyNote' | 'checklistNote'>, TourCardConfig>,
	notes: Record<
		'studyNote' | 'checklistNote',
		{
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
	>,
): Record<TourNodeKey, TourBindableNode> {
	return {
		attention: createCardFromConfig(cards.attention),
		prompt: createCardFromConfig(cards.prompt),
		hallucination: createCardFromConfig(cards.hallucination),
		ragPipeline: createCardFromConfig(cards.ragPipeline),
		question: createCardFromConfig(cards.question),
		retriever: createCardFromConfig(cards.retriever),
		generator: createCardFromConfig(cards.generator),
		studyNote: createOverlayElement({
			type: 'markdown',
			...notes.studyNote,
			left: notes.studyNote.left,
			top: notes.studyNote.top,
			width: notes.studyNote.width,
			height: notes.studyNote.height,
		}),
		checklistNote: createOverlayElement({
			type: 'markdown',
			...notes.checklistNote,
			left: notes.checklistNote.left,
			top: notes.checklistNote.top,
			width: notes.checklistNote.width,
			height: notes.checklistNote.height,
		}),
	};
}
