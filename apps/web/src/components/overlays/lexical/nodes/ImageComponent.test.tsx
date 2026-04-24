import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImageComponent from './ImageComponent';

const mockEditor = {
	getEditorState: () => ({
		read: (callback: () => boolean) => callback(),
	}),
	isEditable: () => true,
	registerCommand: vi.fn(() => () => {}),
	update: vi.fn((callback: () => void) => callback()),
};

vi.mock('@lexical/react/LexicalComposerContext', () => ({
	useLexicalComposerContext: () => [mockEditor],
}));

vi.mock('@lexical/react/useLexicalNodeSelection', () => ({
	useLexicalNodeSelection: () => [true, vi.fn(), vi.fn()],
}));

vi.mock('@lexical/utils', () => ({
	mergeRegister:
		(...cleanups: Array<() => void>) =>
		() => {
			for (const cleanup of cleanups) {
				cleanup();
			}
		},
}));

vi.mock('lexical', () => ({
	$getNodeByKey: vi.fn(() => ({ setWidthAndHeight: vi.fn() })),
	$getSelection: vi.fn(() => ({ has: vi.fn(() => true) })),
	$isNodeSelection: vi.fn(() => true),
	COMMAND_PRIORITY_LOW: 1,
	KEY_ESCAPE_COMMAND: 'KEY_ESCAPE_COMMAND',
	DecoratorNode: class {
		__key?: string;

		constructor(key?: string) {
			this.__key = key;
		}

		exportJSON() {
			return {};
		}
	},
}));

vi.mock('./ImageNode', () => ({
	$isImageNode: vi.fn(() => true),
}));

class MockImage {
	onload: null | (() => void) = null;
	onerror: null | (() => void) = null;
	naturalHeight = 80;
	naturalWidth = 120;

	set src(_value: string) {
		queueMicrotask(() => {
			this.onload?.();
		});
	}
}

describe('ImageComponent', () => {
	beforeEach(() => {
		vi.stubGlobal('Image', MockImage);
	});

	it('removes resize listeners if the component unmounts during a drag', async () => {
		const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
		const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

		const { container, unmount, findByRole } = render(
			<ImageComponent
				altText="Example image"
				height={80}
				maxWidth={320}
				nodeKey="node-1"
				onResize={() => {}}
				resizable
				src="https://example.com/image.png"
				width={120}
			/>,
		);

		const image = await findByRole('img', { name: 'Example image' });
		Object.defineProperty(image, 'offsetWidth', { configurable: true, value: 120 });
		Object.defineProperty(image, 'offsetHeight', { configurable: true, value: 80 });
		image.getBoundingClientRect = () =>
			({
				width: 120,
				height: 80,
				top: 0,
				left: 0,
				right: 120,
				bottom: 80,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			}) as DOMRect;

		const handle = container.querySelector('.canvas-image-resize-handle');
		expect(handle).not.toBeNull();

		await act(async () => {
			fireEvent.pointerDown(handle as Element, { clientX: 100, clientY: 100 });
		});

		expect(addEventListenerSpy.mock.calls.some(([type]) => type === 'pointermove')).toBe(true);
		expect(addEventListenerSpy.mock.calls.some(([type]) => type === 'pointerup')).toBe(true);

		unmount();

		expect(removeEventListenerSpy.mock.calls.some(([type]) => type === 'pointermove')).toBe(true);
		expect(removeEventListenerSpy.mock.calls.some(([type]) => type === 'pointerup')).toBe(true);
	});
});
