import { FONT_FAMILY } from '@excalidraw/excalidraw';
import type { BinaryFileData } from '@excalidraw/excalidraw/types';
import type { TourSceneState } from './canvas-tour-scene-types';

const TOUR_ROUGH_TEXT_FONT = FONT_FAMILY.Nunito;
const TOUR_TITLE_FONT = FONT_FAMILY.Excalifont;

export const TOUR_IMAGE_FILE_ID = 'canvas-tour-lecture-image' as BinaryFileData['id'];

export const DEFAULT_TOUR_SCENE_STATE: TourSceneState = {
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
