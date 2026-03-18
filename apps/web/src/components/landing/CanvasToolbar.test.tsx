import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CanvasToolbar } from './CanvasToolbar';

describe('CanvasToolbar', () => {
	afterEach(() => {
		cleanup();
	});

	it('should render toolbar with hint text', () => {
		const { getByText } = render(<CanvasToolbar />);
		expect(getByText('Scroll to pan the story')).toBeTruthy();
	});

	it('should render toolbar with correct aria-hidden attribute', () => {
		const { container } = render(<CanvasToolbar />);
		const toolbar = container.querySelector('.landing-toolbar');
		expect(toolbar?.getAttribute('aria-hidden')).toBe('true');
	});

	it('should render toolbar buttons with keys', () => {
		const { container } = render(<CanvasToolbar />);
		const keys = container.querySelectorAll('.landing-toolbar-key');
		expect(keys.length).toBe(8);
	});
});
