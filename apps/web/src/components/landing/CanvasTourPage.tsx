import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Excalidraw, FONT_FAMILY, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type {
	BinaryFileData,
	BinaryFiles,
} from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { OverlayType } from '@ai-canvas/shared/types';
import { CanvasNotesLayer } from '@/components/canvas/CanvasNotesLayer';
import { createOverlayElementDraft } from '@/components/canvas/element-factories';
import { normalizeSceneElements } from '@/components/canvas/scene-element-normalizer';
import '@excalidraw/excalidraw/index.css';
import { canvasTourChapters, type CanvasTourGuideOverlay } from './canvas-tour-content';
import {
	getTourTool,
	useCanvasTourSceneController,
	type CameraTarget,
	type CanvasSceneSnapshot,
	type TourTool,
} from './useCanvasTourSceneController';
import './canvas-tour.css';

interface DemoScene {
	elements: ExcalidrawElement[];
	files: BinaryFiles;
}

interface RegisteredTourSceneSnapshot {
	sceneId: string;
	elements: ExcalidrawElement[];
	camera: CameraTarget;
	overlay: CanvasTourGuideOverlay;
	capturedAt: string;
}

interface RegisteredTourSceneLibrary {
	scenes: Record<string, RegisteredTourSceneSnapshot>;
	updatedAt: string;
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

const TOUR_ROUGH_TEXT_FONT = FONT_FAMILY.Nunito;
const TOUR_TITLE_FONT = FONT_FAMILY.Excalifont;
const TOUR_IMAGE_FILE_ID = 'canvas-tour-lecture-image' as BinaryFileData['id'];
const TOUR_REGISTERED_SCENE_STORAGE_KEY = 'ai-canvas:tour:registered-scenes:v2';
const IS_DEV = import.meta.env.DEV;

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
	looseTextBlocks: [
	],
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


function ToolbarSvg({
	children,
	viewBox = '0 0 24 24',
}: {
	children: ReactNode;
	viewBox?: string;
}) {
	return (
		<svg aria-hidden="true" focusable="false" viewBox={viewBox} fill="none">
			{children}
		</svg>
	);
}

function ToolbarIcon({ tool }: { tool: TourTool }) {
	switch (tool) {
		case 'hand':
			return (
				<ToolbarSvg>
					<g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
						<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" />
						<path d="M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5" />
						<path d="M14 5.5a1.5 1.5 0 0 1 3 0V12" />
						<path d="M17 7.5a1.5 1.5 0 0 1 3 0v8.5a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.01-2.7L3.7 13.6a1.5 1.5 0 0 1 .53-2.02a1.87 1.87 0 0 1 2.28.28L8 13Z" />
					</g>
				</ToolbarSvg>
			);
		case 'selection':
			return (
				<ToolbarSvg viewBox="0 0 22 22">
					<g stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
						<path d="M6 6l4.2 11.8c.1.2.2.2.3.2s.2 0 .3-.2l2.2-4.8 4.8-2c.1 0 .2-.1.2-.3s-.1-.2-.2-.3L6 6Z" />
						<path d="M13.5 13.5 18 18" />
					</g>
				</ToolbarSvg>
			);
		case 'rectangle':
			return (
				<ToolbarSvg>
					<rect
						x="4"
						y="4"
						width="16"
						height="16"
						rx="2"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
				</ToolbarSvg>
			);
		case 'diamond':
			return (
				<ToolbarSvg>
					<path
						d="M10.5 20.4 3.6 13.5a2.1 2.1 0 0 1 0-3l6.9-6.9a2.1 2.1 0 0 1 3 0l6.9 6.9a2.1 2.1 0 0 1 0 3l-6.9 6.9a2.1 2.1 0 0 1-3 0Z"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
				</ToolbarSvg>
			);
		case 'ellipse':
			return (
				<ToolbarSvg>
					<circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
				</ToolbarSvg>
			);
		case 'arrow':
			return (
				<ToolbarSvg>
					<g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
						<line x1="5" y1="12" x2="19" y2="12" />
						<line x1="15" y1="8" x2="19" y2="12" />
						<line x1="15" y1="16" x2="19" y2="12" />
					</g>
				</ToolbarSvg>
			);
		case 'line':
			return (
				<ToolbarSvg viewBox="0 0 20 20">
					<path d="M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
				</ToolbarSvg>
			);
		case 'freedraw':
			return (
				<ToolbarSvg viewBox="0 0 20 20">
					<g stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
						<path d="m7.6 15.7 7.8-7.8a2.35 2.35 0 1 0-3.3-3.3l-7.8 7.7a3.33 3.33 0 0 0-1 2.4v2h2c.9 0 1.7-.4 2.3-1Z" />
						<path d="m11.2 5.4 3.4 3.4" />
					</g>
				</ToolbarSvg>
			);
		case 'text':
			return (
				<ToolbarSvg>
					<g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
						<line x1="6" y1="5" x2="18" y2="5" />
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="8.5" y1="19" x2="15.5" y2="19" />
					</g>
				</ToolbarSvg>
			);
		case 'image':
			return (
				<ToolbarSvg viewBox="0 0 20 20">
					<g stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
						<rect x="2.6" y="2.6" width="14.8" height="14.8" rx="2.3" />
						<path d="M12.5 6.7h.01" />
						<path d="m3.8 12.5 3.1-3.1c.7-.7 1.6-.7 2.3 0l3.7 3.7" />
						<path d="m11.8 11.7.7-.7c.7-.7 1.6-.7 2.3 0l1.4 1.4" />
					</g>
				</ToolbarSvg>
			);
		case 'eraser':
			return (
				<ToolbarSvg>
					<g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
						<path d="M19 20H8.5l-4.2-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4L11.5 20" />
						<path d="m18 13.3-6.3-6.3" />
					</g>
				</ToolbarSvg>
			);
	}
}

const TOUR_TOOLS: Array<{ type: TourTool; label: string }> = [
	{ type: 'hand', label: 'Hand' },
	{ type: 'selection', label: 'Selection' },
	{ type: 'rectangle', label: 'Rectangle' },
	{ type: 'diamond', label: 'Diamond' },
	{ type: 'ellipse', label: 'Ellipse' },
	{ type: 'arrow', label: 'Arrow' },
	{ type: 'line', label: 'Line' },
	{ type: 'freedraw', label: 'Draw' },
	{ type: 'text', label: 'Text' },
	{ type: 'image', label: 'Image' },
	{ type: 'eraser', label: 'Eraser' },
];

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

function createSceneElements(imageId: string): DemoScene {
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

function loadRegisteredTourScenes(): RegisteredTourSceneLibrary | null {
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

		// Migrate the older single-scene snapshot to the first chapter id.
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

function persistRegisteredTourScenes(library: RegisteredTourSceneLibrary) {
	if (!IS_DEV || typeof window === 'undefined') {
		return;
	}

	window.localStorage.setItem(TOUR_REGISTERED_SCENE_STORAGE_KEY, JSON.stringify(library));
}

function clearRegisteredTourScenes() {
	if (!IS_DEV || typeof window === 'undefined') {
		return;
	}

	window.localStorage.removeItem(TOUR_REGISTERED_SCENE_STORAGE_KEY);
}

export function CanvasTourPage() {
	const imageId = TOUR_IMAGE_FILE_ID;
	const activeChapter = canvasTourChapters[0];
	const defaultSceneId = activeChapter?.id ?? 'canvas-tour-default';
	const defaultOverlay = activeChapter.overlay;
	const defaultScene = useMemo(() => {
		const result = createSceneElements(imageId);
		return { ...result, imageId };
	}, [imageId]);
	const [registeredSceneLibrary, setRegisteredSceneLibrary] =
		useState<RegisteredTourSceneLibrary | null>(() => loadRegisteredTourScenes());
	const initialRegisteredScene = registeredSceneLibrary?.scenes[defaultSceneId] ?? null;
	const [guideBaseline, setGuideBaseline] = useState(() => ({
		elements: initialRegisteredScene?.elements ?? defaultScene.elements,
		camera: initialRegisteredScene?.camera ?? activeChapter.camera,
	}));
	const [guideOverlay, setGuideOverlay] = useState<CanvasTourGuideOverlay>(
		initialRegisteredScene?.overlay ?? defaultOverlay,
	);
	const initialCamera = guideBaseline.camera;
	const [isGuideMode, setIsGuideMode] = useState(true);
	const [isGridVisible, setIsGridVisible] = useState(true);
	const [activeTool, setActiveTool] = useState<TourTool>('selection');
	const [devCaptureStatus, setDevCaptureStatus] = useState<string | null>(null);
	const [isRegistryOpen, setIsRegistryOpen] = useState(false);
	const [surfaceEpoch, setSurfaceEpoch] = useState(0);
	const [registrySceneId, setRegistrySceneId] = useState(defaultSceneId);
	const [registryCaptureMode, setRegistryCaptureMode] = useState<'full' | 'camera' | 'elements'>(
		'full',
	);
	const [overlayDraft, setOverlayDraft] = useState<CanvasTourGuideOverlay>(
		initialRegisteredScene?.overlay ?? defaultOverlay,
	);
	const getChapterById = (sceneId: string) =>
		canvasTourChapters.find((chapter) => chapter.id === sceneId) ?? activeChapter;

	const getDefaultSceneForId = (sceneId: string): RegisteredTourSceneSnapshot => {
		const chapter = getChapterById(sceneId);
		return {
			sceneId,
			elements: defaultScene.elements,
			camera: chapter.camera,
			overlay: chapter.overlay,
			capturedAt: new Date(0).toISOString(),
		};
	};

	const getRegisteredSceneForId = (sceneId: string) =>
		registeredSceneLibrary?.scenes[sceneId] ?? null;
	const {
		stageViewportRef,
		imageFileData,
		liveCamera,
		excalidrawMountKey,
		initialSurfaceData,
		handleExcalidrawApiReady,
		handleExcalidrawChange,
		handleToolSelect,
		getCurrentSceneSnapshot,
		applySceneSnapshot,
		buildGuideAppState,
		buildExploreAppState,
		createCameraFromAppState,
		setExploreSessionSnapshot,
		getExploreSessionSnapshot,
	} = useCanvasTourSceneController({
		imageId,
		defaultScene,
		guideBaseline,
		initialCamera,
		isGuideMode,
		surfaceEpoch,
		setActiveTool,
	});

	useEffect(() => {
		const nextOverlay = getRegisteredSceneForId(registrySceneId)?.overlay ?? getChapterById(registrySceneId).overlay;
		setOverlayDraft(nextOverlay);
	}, [registeredSceneLibrary, registrySceneId]);

	const resetDemo = () => {
		setExploreSessionSnapshot(null);
		setIsRegistryOpen(false);
		setIsGuideMode(true);
		setSurfaceEpoch((current) => current + 1);
		setActiveTool('selection');
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const enterGuideMode = () => {
		if (isGuideMode) return;
		setExploreSessionSnapshot(getCurrentSceneSnapshot());
		setIsGuideMode(true);
		setIsRegistryOpen(false);
		setSurfaceEpoch((current) => current + 1);
		setActiveTool('selection');
	};

	const enterExploreMode = () => {
		if (!isGuideMode) return;
		setIsGuideMode(false);
		setSurfaceEpoch((current) => current + 1);
		const exploreSession = getExploreSessionSnapshot();
		if (exploreSession) {
			const nextTool = getTourTool(exploreSession.appState.activeTool?.type);
			if (nextTool) {
				setActiveTool(nextTool);
			} else {
				setActiveTool('selection');
			}
			return;
		}
		setActiveTool('selection');
	};

	const registerCurrentLayout = () => {
		if (isGuideMode) {
			setDevCaptureStatus('Switch to Explore Demo before registering a layout.');
			return;
		}
		const snapshot = getCurrentSceneSnapshot();
		const camera = createCameraFromAppState(snapshot.appState);
		const previousScene = getRegisteredSceneForId(registrySceneId) ?? getDefaultSceneForId(registrySceneId);
		const nextScene: RegisteredTourSceneSnapshot = {
			sceneId: registrySceneId,
			elements: registryCaptureMode === 'camera' ? previousScene.elements : snapshot.elements,
			camera: registryCaptureMode === 'elements' ? previousScene.camera : camera,
			overlay: previousScene.overlay,
			capturedAt: new Date().toISOString(),
		};
		const nextLibrary: RegisteredTourSceneLibrary = {
			scenes: {
				...(registeredSceneLibrary?.scenes ?? {}),
				[registrySceneId]: nextScene,
			},
			updatedAt: nextScene.capturedAt,
		};
		persistRegisteredTourScenes(nextLibrary);
		setRegisteredSceneLibrary(nextLibrary);
		if (registrySceneId === activeChapter.id) {
			setGuideBaseline({
				elements: nextScene.elements,
				camera: nextScene.camera,
			});
			setGuideOverlay(nextScene.overlay);
		}
		const scopeLabel =
			registryCaptureMode === 'full'
				? 'scene + camera'
				: registryCaptureMode === 'camera'
					? 'camera'
					: 'elements';
		setDevCaptureStatus(
			`Registered ${scopeLabel} for ${getChapterById(registrySceneId).label.toLowerCase()}.`,
		);
	};

	const restoreRegisteredLayout = () => {
		const registered = getRegisteredSceneForId(registrySceneId);
		if (!registered) {
			setDevCaptureStatus(`No registered layout found for ${getChapterById(registrySceneId).label.toLowerCase()}.`);
			return;
		}
		if (registrySceneId === activeChapter.id) {
			setGuideBaseline({
				elements: registered.elements,
				camera: registered.camera,
			});
			setGuideOverlay(registered.overlay);
		}
		setOverlayDraft(registered.overlay);
		const registeredFiles = imageFileData ? { [imageFileData.id]: imageFileData } : {};
		const registeredSnapshot: CanvasSceneSnapshot = {
			elements: registered.elements,
			appState: buildExploreAppState(registered.camera),
			files: registeredFiles,
		};
		if (isGuideMode) {
			applySceneSnapshot(
				{
					elements: registered.elements,
					appState: buildGuideAppState(registered.camera),
					files: registeredFiles,
				},
				{ preserveSelection: false, cameraOverride: registered.camera },
			);
			setActiveTool('selection');
		} else {
			setExploreSessionSnapshot(registeredSnapshot);
			applySceneSnapshot(registeredSnapshot, { preserveSelection: true });
		}
		setDevCaptureStatus(`Loaded ${getChapterById(registrySceneId).label.toLowerCase()} layout.`);
	};

	const clearRegisteredLayout = () => {
		const nextScenes = { ...(registeredSceneLibrary?.scenes ?? {}) };
		delete nextScenes[registrySceneId];
		const hasScenes = Object.keys(nextScenes).length > 0;
		const nextLibrary = hasScenes
			? {
				scenes: nextScenes,
				updatedAt: new Date().toISOString(),
			}
			: null;
		if (nextLibrary) {
			persistRegisteredTourScenes(nextLibrary);
		} else {
			clearRegisteredTourScenes();
		}
		setRegisteredSceneLibrary(nextLibrary);
		if (registrySceneId === activeChapter.id) {
			setGuideBaseline({
				elements: defaultScene.elements,
				camera: activeChapter.camera,
			});
			setGuideOverlay(activeChapter.overlay);
		}
		setOverlayDraft(getChapterById(registrySceneId).overlay);
		if (isGuideMode && registrySceneId === activeChapter.id) {
			applySceneSnapshot(
				{
					elements: defaultScene.elements,
					appState: buildGuideAppState(activeChapter.camera),
					files: imageFileData ? { [imageFileData.id]: imageFileData } : {},
				},
				{ preserveSelection: false, cameraOverride: activeChapter.camera },
			);
			setActiveTool('selection');
		}
		setDevCaptureStatus(`Cleared ${getChapterById(registrySceneId).label.toLowerCase()} layout.`);
	};

	const saveOverlayDraft = () => {
		const previousScene = getRegisteredSceneForId(registrySceneId) ?? getDefaultSceneForId(registrySceneId);
		const nextScene: RegisteredTourSceneSnapshot = {
			...previousScene,
			overlay: overlayDraft,
			capturedAt: new Date().toISOString(),
		};
		const nextLibrary: RegisteredTourSceneLibrary = {
			scenes: {
				...(registeredSceneLibrary?.scenes ?? {}),
				[registrySceneId]: nextScene,
			},
			updatedAt: nextScene.capturedAt,
		};
		persistRegisteredTourScenes(nextLibrary);
		setRegisteredSceneLibrary(nextLibrary);
		if (registrySceneId === activeChapter.id) {
			setGuideOverlay(overlayDraft);
		}
		setDevCaptureStatus(`Saved overlay editor changes for ${getChapterById(registrySceneId).label.toLowerCase()}.`);
	};

	const applyOverlayDraft = () => {
		if (registrySceneId === activeChapter.id) {
			setGuideOverlay(overlayDraft);
			setDevCaptureStatus('Applied overlay draft to the active guide scene.');
			return;
		}
		setDevCaptureStatus('Overlay draft updated. Save it to register this scene.');
	};

	const copyRegisteredLayout = async () => {
		if (typeof window === 'undefined') return;
		const registered = getRegisteredSceneForId(registrySceneId);
		if (!registered) {
			setDevCaptureStatus(`No registered layout to copy for ${getChapterById(registrySceneId).label.toLowerCase()}.`);
			return;
		}
		try {
			await window.navigator.clipboard.writeText(JSON.stringify(registered, null, 2));
			setDevCaptureStatus('Copied registered layout JSON.');
		} catch {
			setDevCaptureStatus('Could not copy layout JSON.');
		}
	};

	const showRegistryControls = IS_DEV && !isGuideMode;
	const selectedRegistryChapter = getChapterById(registrySceneId);
	const selectedRegisteredScene = getRegisteredSceneForId(registrySceneId);
	const introOverlayStyle = {
		'--overlay-accent': guideOverlay.accentColor,
		left: `${guideOverlay.placement.leftRem}rem`,
		top: `${guideOverlay.placement.topRem}rem`,
		width: `min(${guideOverlay.placement.widthRem}rem, calc(100vw - 3rem))`,
	} as CSSProperties;

	return (
		<div className="canvas-tour-page">
			<div className="canvas-tour-stage">
				<div className="canvas-tour-stage-bar">
					<div className="canvas-tour-stage-brand">
						<div className="canvas-tour-stage-dots" aria-hidden="true">
							<span />
							<span />
							<span />
						</div>
						<a className="canvas-tour-stage-wordmark" href="/">
							RoopStudio
						</a>
					</div>
					<div className="canvas-tour-stage-actions">
						<div className="canvas-tour-toggle" role="tablist" aria-label="Canvas tour mode">
							<button
								type="button"
								className={isGuideMode ? 'canvas-tour-toggle-active' : ''}
								onClick={enterGuideMode}
							>
								Guide mode
							</button>
							<button
								type="button"
								className={!isGuideMode ? 'canvas-tour-toggle-active' : ''}
								onClick={enterExploreMode}
							>
								Explore demo
							</button>
						</div>
						<button
							type="button"
							className={`canvas-tour-reset ${isGridVisible ? 'canvas-tour-toggle-active' : ''}`}
							onClick={() => setIsGridVisible((current) => !current)}
						>
							{isGridVisible ? 'Hide grid' : 'Show grid'}
						</button>
						<button type="button" className="canvas-tour-reset" onClick={resetDemo}>
							Reset demo
						</button>
						{showRegistryControls ? (
							<button
								type="button"
								className={`canvas-tour-reset ${isRegistryOpen ? 'canvas-tour-toggle-active' : ''}`}
								onClick={() => setIsRegistryOpen((current) => !current)}
							>
								Layout tools
							</button>
						) : null}
						<a className="canvas-tour-stage-link" href="/">
							Back to landing
						</a>
					</div>
				</div>

				<div ref={stageViewportRef} className="canvas-tour-viewport">
					<div
						className={`canvas-tour-toolbar ${isGuideMode ? 'canvas-tour-toolbar-disabled' : ''}`}
						aria-label="Canvas tools"
						aria-disabled={isGuideMode}
					>
						<div className="canvas-tour-toolbar-group">
							{TOUR_TOOLS.map((tool) => (
								<button
									key={tool.type}
									type="button"
									className={`canvas-tour-toolbar-button ${activeTool === tool.type ? 'canvas-tour-toolbar-button-active' : ''
										}`}
									aria-label={tool.label}
									title={isGuideMode ? `${tool.label} (disabled in guide mode)` : tool.label}
									onClick={() => handleToolSelect(tool.type)}
									disabled={isGuideMode}
								>
									<ToolbarIcon tool={tool.type} />
								</button>
							))}
						</div>
					</div>
					<div className="canvas-tour-excalidraw">
						<Excalidraw
							key={excalidrawMountKey}
							excalidrawAPI={handleExcalidrawApiReady}
							initialData={initialSurfaceData}
							isCollaborating
							detectScroll={false}
							handleKeyboardGlobally={false}
							gridModeEnabled={isGridVisible}
							viewModeEnabled={isGuideMode}
							onChange={handleExcalidrawChange}
							UIOptions={{
								canvasActions: {
									loadScene: false,
									saveToActiveFile: false,
								},
							}}
						/>
					</div>
					<CanvasNotesLayer />
					{isGuideMode ? <div className="canvas-tour-interaction-mask" aria-hidden="true" /> : null}

					{isGuideMode ? (
						<div className="canvas-tour-intro-shell" style={introOverlayStyle}>
							<div className="canvas-tour-intro-trail" aria-hidden="true" />
							<div className="canvas-tour-intro-card">
								<p className="canvas-tour-intro-label">{guideOverlay.label}</p>
								<h2 className="canvas-tour-intro-title">{guideOverlay.title}</h2>
								<p className="canvas-tour-intro-copy">{guideOverlay.description}</p>
								<p className="canvas-tour-intro-hint">{guideOverlay.hint}</p>
							</div>
						</div>
					) : null}

					<div className="canvas-tour-ai canvas-tour-ai-visible canvas-tour-ai-idle">
						<p className="canvas-tour-ai-kicker">AI assistant</p>
						<p className="canvas-tour-ai-placeholder">{activeChapter.ai?.placeholder}</p>
					</div>

					{!isGuideMode ? (
						<div className="canvas-tour-explore-badge">Explore mode: drag items and inspect the demo.</div>
					) : null}

					{showRegistryControls && isRegistryOpen ? (
						<div className="canvas-tour-layout-panel">
							<div className="canvas-tour-layout-panel-header">
								<p className="canvas-tour-layout-panel-kicker">Layout tools</p>
								<p className="canvas-tour-layout-panel-copy">
									Scene-aware registry for presentation framing, guide stops, and future overlay authoring.
								</p>
							</div>

							<div className="canvas-tour-layout-section">
								<label className="canvas-tour-layout-field">
									<span>Target scene</span>
									<select
										value={registrySceneId}
										onChange={(event) => setRegistrySceneId(event.target.value)}
									>
										{canvasTourChapters.map((chapter) => (
											<option key={chapter.id} value={chapter.id}>
												{chapter.label} · {chapter.title}
											</option>
										))}
									</select>
								</label>
								<div className="canvas-tour-layout-stats">
									<div className="canvas-tour-layout-stat">
										<span>Live zoom</span>
										<strong>{liveCamera.zoom.toFixed(2)}x</strong>
									</div>
									<div className="canvas-tour-layout-stat">
										<span>Live center</span>
										<strong>{`${Math.round(liveCamera.x)}, ${Math.round(liveCamera.y)}`}</strong>
									</div>
									<div className="canvas-tour-layout-stat">
										<span>Saved zoom</span>
										<strong>{selectedRegisteredScene ? `${selectedRegisteredScene.camera.zoom.toFixed(2)}x` : 'Default'}</strong>
									</div>
									<div className="canvas-tour-layout-stat">
										<span>Saved at</span>
										<strong>
											{selectedRegisteredScene
												? new Date(selectedRegisteredScene.capturedAt).toLocaleTimeString()
												: 'Not saved'}
										</strong>
									</div>
								</div>
							</div>

							<div className="canvas-tour-layout-section">
								<p className="canvas-tour-layout-section-title">Capture scope</p>
								<div className="canvas-tour-layout-mode-toggle" role="tablist" aria-label="Capture scope">
									<button
										type="button"
										className={registryCaptureMode === 'full' ? 'canvas-tour-toggle-active' : ''}
										onClick={() => setRegistryCaptureMode('full')}
									>
										Scene + camera
									</button>
									<button
										type="button"
										className={registryCaptureMode === 'camera' ? 'canvas-tour-toggle-active' : ''}
										onClick={() => setRegistryCaptureMode('camera')}
									>
										Camera only
									</button>
									<button
										type="button"
										className={registryCaptureMode === 'elements' ? 'canvas-tour-toggle-active' : ''}
										onClick={() => setRegistryCaptureMode('elements')}
									>
										Elements only
									</button>
								</div>
								<p className="canvas-tour-layout-help">
									`Scene + camera` stores layout and zoom. `Camera only` updates framing for the selected
									scene. `Elements only` keeps the saved presentation framing intact.
								</p>
							</div>

							<div className="canvas-tour-layout-section">
								<p className="canvas-tour-layout-section-title">Guide overlay editor</p>
								<div className="canvas-tour-layout-form">
									<label className="canvas-tour-layout-field">
										<span>Overlay label</span>
										<input
											type="text"
											value={overlayDraft.label}
											onChange={(event) =>
												setOverlayDraft((current) => ({ ...current, label: event.target.value }))
											}
										/>
									</label>
									<label className="canvas-tour-layout-field">
										<span>Overlay title</span>
										<textarea
											rows={2}
											value={overlayDraft.title}
											onChange={(event) =>
												setOverlayDraft((current) => ({ ...current, title: event.target.value }))
											}
										/>
									</label>
									<label className="canvas-tour-layout-field">
										<span>Overlay description</span>
										<textarea
											rows={3}
											value={overlayDraft.description}
											onChange={(event) =>
												setOverlayDraft((current) => ({
													...current,
													description: event.target.value,
												}))
											}
										/>
									</label>
									<label className="canvas-tour-layout-field">
										<span>Overlay hint</span>
										<input
											type="text"
											value={overlayDraft.hint}
											onChange={(event) =>
												setOverlayDraft((current) => ({ ...current, hint: event.target.value }))
											}
										/>
									</label>
									<div className="canvas-tour-layout-overlay-grid">
										<label className="canvas-tour-layout-field">
											<span>Left</span>
											<input
												type="number"
												step="0.1"
												value={overlayDraft.placement.leftRem}
												onChange={(event) =>
													setOverlayDraft((current) => ({
														...current,
														placement: {
															...current.placement,
															leftRem: Number(event.target.value) || 0,
														},
													}))
												}
											/>
										</label>
										<label className="canvas-tour-layout-field">
											<span>Top</span>
											<input
												type="number"
												step="0.1"
												value={overlayDraft.placement.topRem}
												onChange={(event) =>
													setOverlayDraft((current) => ({
														...current,
														placement: {
															...current.placement,
															topRem: Number(event.target.value) || 0,
														},
													}))
												}
											/>
										</label>
										<label className="canvas-tour-layout-field">
											<span>Width</span>
											<input
												type="number"
												step="0.1"
												value={overlayDraft.placement.widthRem}
												onChange={(event) =>
													setOverlayDraft((current) => ({
														...current,
														placement: {
															...current.placement,
															widthRem: Number(event.target.value) || 0,
														},
													}))
												}
											/>
										</label>
										<label className="canvas-tour-layout-field">
											<span>Accent</span>
											<input
												type="color"
												value={overlayDraft.accentColor}
												onChange={(event) =>
													setOverlayDraft((current) => ({
														...current,
														accentColor: event.target.value,
													}))
												}
											/>
										</label>
									</div>
								</div>
								<div className="canvas-tour-layout-actions">
									<button type="button" className="canvas-tour-reset" onClick={applyOverlayDraft}>
										Preview overlay
									</button>
									<button type="button" className="canvas-tour-reset" onClick={saveOverlayDraft}>
										Save overlay
									</button>
								</div>
							</div>

							<div className="canvas-tour-layout-section">
								<p className="canvas-tour-layout-section-title">Scene actions</p>
								<div className="canvas-tour-layout-actions">
									<button type="button" className="canvas-tour-reset" onClick={registerCurrentLayout}>
										Register selected scene
									</button>
									<button type="button" className="canvas-tour-reset" onClick={restoreRegisteredLayout}>
										Load selected scene
									</button>
									<button type="button" className="canvas-tour-reset" onClick={copyRegisteredLayout}>
										Copy selected JSON
									</button>
									<button type="button" className="canvas-tour-reset" onClick={clearRegisteredLayout}>
										Clear selected scene
									</button>
								</div>
								<p className="canvas-tour-layout-meta">
									Editing target: <strong>{selectedRegistryChapter.title}</strong>
								</p>
							</div>

							{devCaptureStatus ? (
								<p className="canvas-tour-layout-status">{devCaptureStatus}</p>
							) : null}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
