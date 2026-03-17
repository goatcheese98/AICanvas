import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { describe, expect, it } from 'vitest';
import type { TypedOverlayCanvasElement } from './overlay-definition-types';
import {
	applyOverlayUpdateByType,
	collectOverlayElements,
	getOverlayZIndex,
} from './overlay-registry';

describe('overlay-registry', () => {
	it('collects only overlay elements', () => {
		const elements = [
			{
				id: 'md-1',
				type: 'rectangle',
				x: 10,
				y: 20,
				width: 300,
				height: 200,
				angle: 0,
				customData: {
					type: 'markdown',
					content: 'hello',
				},
			},
			{
				id: 'shape-1',
				type: 'rectangle',
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				angle: 0,
			},
		] as unknown as ExcalidrawElement[];

		const overlays = collectOverlayElements(elements);

		expect(overlays).toHaveLength(1);
		expect(overlays[0]?.id).toBe('md-1');
	});

	it('skips deleted overlay elements', () => {
		const elements = [
			{
				id: 'md-deleted',
				type: 'rectangle',
				x: 0,
				y: 0,
				width: 200,
				height: 140,
				angle: 0,
				isDeleted: true,
				customData: {
					type: 'markdown',
					content: 'ghost',
				},
			},
			{
				id: 'md-live',
				type: 'rectangle',
				x: 10,
				y: 20,
				width: 300,
				height: 200,
				angle: 0,
				customData: {
					type: 'markdown',
					content: 'live',
				},
			},
		] as unknown as ExcalidrawElement[];

		const overlays = collectOverlayElements(elements);

		expect(overlays).toHaveLength(1);
		expect(overlays[0]?.id).toBe('md-live');
	});

	it('applies markdown updates and bumps element version', () => {
		const element = {
			id: 'md-1',
			type: 'rectangle',
			x: 10,
			y: 20,
			width: 300,
			height: 200,
			angle: 0,
			version: 2,
			versionNonce: 7,
			customData: {
				type: 'markdown',
				content: 'old',
				images: { a: 'b' },
			},
		} as unknown as TypedOverlayCanvasElement;

		const updated = applyOverlayUpdateByType('markdown', element, {
			content: 'new',
			images: { c: 'd' },
		});

		expect(updated.version).toBe(3);
		expect(updated.customData).toMatchObject({
			type: 'markdown',
			content: 'new',
			images: { c: 'd' },
		});
	});

	it('applies markdown element style updates alongside custom data updates', () => {
		const element = {
			id: 'md-style',
			type: 'rectangle',
			x: 10,
			y: 20,
			width: 300,
			height: 200,
			angle: 0,
			backgroundColor: '#ffffff',
			strokeColor: 'transparent',
			version: 4,
			versionNonce: 11,
			customData: {
				type: 'markdown',
				content: 'styled',
				settings: {
					font: 'Excalifont',
					fontSize: 15,
					background: '#ffffff',
					lineHeight: 1.6,
					inlineCodeColor: '#7c3aed',
					showEmptyLines: true,
					autoHideToolbar: false,
				},
			},
		} as unknown as TypedOverlayCanvasElement;

		const updated = applyOverlayUpdateByType('markdown', element, {
			content: 'styled',
			settings: {
				font: 'Excalifont',
				fontSize: 15,
				background: '#fce8e6',
				lineHeight: 1.6,
				inlineCodeColor: '#7c3aed',
				showEmptyLines: true,
				autoHideToolbar: false,
			},
			elementStyle: {
				backgroundColor: '#fce8e6',
				strokeColor: '#1e1e1e',
			},
		});

		expect(updated.backgroundColor).toBe('#fce8e6');
		expect(updated.strokeColor).toBe('#1e1e1e');
		expect(updated.customData.settings.background).toBe('#fce8e6');
	});

	it('applies kanban updates by replacing custom data payload', () => {
		const element = {
			id: 'kanban-1',
			type: 'rectangle',
			x: 10,
			y: 20,
			width: 300,
			height: 200,
			angle: 0,
			version: 1,
			versionNonce: 5,
			customData: {
				type: 'kanban',
				title: 'Old',
				columns: [],
			},
		} as unknown as TypedOverlayCanvasElement;

		const updated = applyOverlayUpdateByType('kanban', element, {
			type: 'kanban',
			title: 'New',
			columns: [{ id: 'todo', title: 'Todo', cards: [] }],
			bgTheme: 'parchment',
			fontId: 'excalifont',
			fontSize: 13,
		});

		expect(updated.version).toBe(2);
		expect(updated.customData.title).toBe('New');
		expect(updated.customData.columns).toHaveLength(1);
	});

	it('applies prototype updates by merging file state and visibility flags', () => {
		const element = {
			id: 'prototype-1',
			type: 'rectangle',
			x: 10,
			y: 20,
			width: 300,
			height: 200,
			angle: 0,
			version: 3,
			versionNonce: 9,
			customData: {
				type: 'prototype',
				title: 'Prototype',
				template: 'react',
				files: {
					'/App.js': { code: 'export default function App() { return null; }', active: true },
				},
				dependencies: {},
				preview: {
					eyebrow: 'PulseBoard',
					title: 'Prototype',
					description: 'Preview',
					accent: '#2563eb',
					background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
					badges: ['React'],
					metrics: [{ label: 'Revenue', value: '$128k' }],
				},
				activeFile: '/App.js',
				showEditor: true,
				showPreview: true,
			},
		} as unknown as TypedOverlayCanvasElement;

		const updated = applyOverlayUpdateByType('prototype', element, {
			title: 'Prototype v2',
			showPreview: false,
			preview: {
				eyebrow: 'PulseBoard',
				title: 'Prototype v2',
				description: 'Updated preview',
				accent: '#2563eb',
				background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
				badges: ['React', 'Dashboard'],
				metrics: [{ label: 'Revenue', value: '$144k' }],
			},
			files: {
				'/App.js': {
					code: 'export default function App() { return <div>Hi</div>; }',
					active: true,
				},
			},
			activeFile: '/App.js',
		});

		expect(updated.version).toBe(4);
		expect(updated.customData.title).toBe('Prototype v2');
		expect(updated.customData.showPreview).toBe(false);
		expect(updated.customData.preview?.title).toBe('Prototype v2');
		expect(updated.customData.files['/App.js']).toBeUndefined();
		expect(updated.customData.files['/App.jsx']?.code).toContain('Hi');
		expect(updated.customData.activeFile).toBe('/App.jsx');
	});

	it('calculates z-index with selection and editing promotion', () => {
		expect(getOverlayZIndex(false, false, 2)).toBe(20);
		expect(getOverlayZIndex(true, false, 2)).toBe(10020);
		expect(getOverlayZIndex(true, true, 2)).toBe(20020);
	});
});
