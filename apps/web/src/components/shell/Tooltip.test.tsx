// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Tooltip } from './Tooltip';

afterEach(() => {
	cleanup();
});

describe('Tooltip', () => {
	it('renders children without tooltip initially', () => {
		render(
			<Tooltip content="Tooltip text">
				<button type="button">Hover me</button>
			</Tooltip>,
		);

		expect(screen.getByText('Hover me')).toBeTruthy();
		// Tooltip content should be in DOM (hidden by CSS until hover)
		expect(screen.getByText('Tooltip text')).toBeTruthy();
	});

	it('renders with different positions', () => {
		const { rerender } = render(
			<Tooltip content="Top tooltip" position="top">
				<button type="button">Button</button>
			</Tooltip>,
		);
		expect(screen.getByText('Button')).toBeTruthy();

		rerender(
			<Tooltip content="Bottom tooltip" position="bottom">
				<button type="button">Button</button>
			</Tooltip>,
		);
		expect(screen.getByText('Button')).toBeTruthy();

		rerender(
			<Tooltip content="Left tooltip" position="left">
				<button type="button">Button</button>
			</Tooltip>,
		);
		expect(screen.getByText('Button')).toBeTruthy();

		rerender(
			<Tooltip content="Right tooltip" position="right">
				<button type="button">Button</button>
			</Tooltip>,
		);
		expect(screen.getByText('Button')).toBeTruthy();
	});

	it('renders complex content', () => {
		render(
			<Tooltip content={<span data-testid="complex">Complex content</span>}>
				<button type="button">Hover me</button>
			</Tooltip>,
		);

		expect(screen.getByTestId('complex')).toBeTruthy();
	});

	it('applies custom className', () => {
		const { container } = render(
			<Tooltip content="Tooltip" className="custom-class">
				<button type="button">Button</button>
			</Tooltip>,
		);

		expect((container.firstChild as HTMLElement)?.classList.contains('custom-class')).toBe(true);
	});
});
