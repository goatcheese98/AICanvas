import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WebEmbed } from './WebEmbed';

describe('WebEmbed', () => {
	it('removes PiP drag listeners if the component unmounts mid-drag', async () => {
		const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
		const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

		const { unmount } = render(
			<WebEmbed
				element={
					{
						id: 'embed-1',
						type: 'rectangle',
						x: 0,
						y: 0,
						width: 640,
						height: 360,
						angle: 0,
						strokeColor: '#000000',
						backgroundColor: '#ffffff',
						fillStyle: 'solid',
						strokeWidth: 1,
						strokeStyle: 'solid',
						roughness: 0,
						opacity: 100,
						groupIds: [],
						frameId: null,
						roundness: null,
						boundElements: null,
						updated: 1,
						link: null,
						locked: false,
						version: 1,
						versionNonce: 1,
						isDeleted: false,
						seed: 1,
						index: 'a0' as never,
						customData: {
							type: 'web-embed',
							url: 'https://example.com',
						},
					} as never
				}
				isSelected
				onChange={vi.fn()}
			/>,
		);

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'PiP' }));
		});

		const dragSurface = document.body.querySelector('.cursor-move');
		expect(dragSurface).not.toBeNull();

		await act(async () => {
			fireEvent.mouseDown(dragSurface as Element, { clientX: 100, clientY: 120 });
		});

		expect(addEventListenerSpy.mock.calls.some(([type]) => String(type) === 'mousemove')).toBe(true);
		expect(addEventListenerSpy.mock.calls.some(([type]) => String(type) === 'mouseup')).toBe(true);

		unmount();

		expect(removeEventListenerSpy.mock.calls.some(([type]) => String(type) === 'mousemove')).toBe(true);
		expect(removeEventListenerSpy.mock.calls.some(([type]) => String(type) === 'mouseup')).toBe(true);
	});
});
