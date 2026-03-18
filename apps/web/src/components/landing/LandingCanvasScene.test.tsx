import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LandingCanvasScene } from './LandingCanvasScene';
import type { LandingStoryChapter } from './landing-content';

describe('LandingCanvasScene', () => {
	afterEach(() => {
		cleanup();
	});

	const mockChapter: LandingStoryChapter = {
		id: 'test',
		eyebrow: 'Test Eyebrow',
		title: 'Test Title',
		description: 'Test Description',
		label: 'Test Label',
		detail: 'Test Detail',
		metricLabel: 'Test Metric',
		metricValue: 'Test Value',
		bullets: ['bullet1', 'bullet2'],
		camera: { x: 0, y: 0, scale: 1 },
	};

	const defaultProps = {
		activeChapter: mockChapter,
		activeProgressChapterId: 'test',
		boardStyle: { transform: 'translate(0, 0)' },
		chapters: [mockChapter],
		email: '',
		waitlistMessage: null,
		waitlistStatus: 'idle' as const,
		onEmailChange: vi.fn(),
		onWaitlistSubmit: vi.fn(),
	};

	it('should render active chapter info in HUD', () => {
		const { getByText } = render(<LandingCanvasScene {...defaultProps} />);
		expect(getByText('Test Eyebrow')).toBeTruthy();
		expect(getByText('Test Title')).toBeTruthy();
		expect(getByText('Test Description')).toBeTruthy();
	});

	it('should render footer label', () => {
		const { container } = render(<LandingCanvasScene {...defaultProps} />);
		const label = container.querySelector('.landing-canvas-footer-label');
		expect(label?.textContent).toBe('Test Label');
	});

	it('should render pips for each chapter', () => {
		const chapters: LandingStoryChapter[] = [
			{ ...mockChapter, id: 'ch1' },
			{ ...mockChapter, id: 'ch2' },
			{ ...mockChapter, id: 'ch3' },
		];
		const { container } = render(<LandingCanvasScene {...defaultProps} chapters={chapters} />);
		const pips = container.querySelectorAll('.landing-canvas-pips > span');
		expect(pips.length).toBe(3);
	});

	it('should mark active pip correctly', () => {
		const chapters: LandingStoryChapter[] = [
			{ ...mockChapter, id: 'ch1' },
			{ ...mockChapter, id: 'ch2' },
		];
		const { container } = render(
			<LandingCanvasScene {...defaultProps} chapters={chapters} activeProgressChapterId="ch2" />,
		);
		const pips = container.querySelectorAll('.landing-canvas-pips > span');
		expect(pips[0].hasAttribute('data-active')).toBe(false);
		expect(pips[1].getAttribute('data-active')).toBe('true');
	});
});
