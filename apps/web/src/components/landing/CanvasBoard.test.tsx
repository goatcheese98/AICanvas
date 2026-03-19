import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasBoard } from './CanvasBoard';

describe('CanvasBoard', () => {
	afterEach(() => {
		cleanup();
	});

	const defaultProps = {
		email: '',
		waitlistMessage: null,
		waitlistStatus: 'idle' as const,
		onEmailChange: vi.fn(),
		onWaitlistSubmit: vi.fn(),
		activeChapterId: 'intro',
	};

	it('should render without crashing', () => {
		const { container } = render(<CanvasBoard {...defaultProps} />);
		expect(container.querySelector('.landing-zone-label')).toBeTruthy();
	});

	it('should render zone labels', () => {
		const { container } = render(<CanvasBoard {...defaultProps} />);
		const zones = container.querySelectorAll('.landing-zone-label');
		expect(zones.length).toBe(4);
	});

	it('should render intro card with data-chapter attribute', () => {
		const { container } = render(<CanvasBoard {...defaultProps} />);
		const introCard = container.querySelector('[data-chapter="intro"]');
		expect(introCard).toBeTruthy();
	});

	it('should render capture zone cards with data-chapter attribute', () => {
		const { container } = render(<CanvasBoard {...defaultProps} />);
		const captureCards = container.querySelectorAll('[data-chapter="capture"]');
		expect(captureCards.length).toBeGreaterThan(0);
	});

	it('should render research zone cards', () => {
		const { container } = render(<CanvasBoard {...defaultProps} />);
		const researchCards = container.querySelectorAll('[data-chapter="research"]');
		expect(researchCards.length).toBeGreaterThan(0);
	});

	it('should render plan zone cards', () => {
		const { container } = render(<CanvasBoard {...defaultProps} />);
		const planCards = container.querySelectorAll('[data-chapter="plan"]');
		expect(planCards.length).toBeGreaterThan(0);
	});

	it('should render polish zone cards', () => {
		const { container } = render(<CanvasBoard {...defaultProps} />);
		const polishCards = container.querySelectorAll('[data-chapter="polish"]');
		expect(polishCards.length).toBeGreaterThan(0);
	});

	it('should render waitlist section', () => {
		const { getByText } = render(<CanvasBoard {...defaultProps} />);
		expect(getByText('Join the waitlist')).toBeTruthy();
	});

	it('should render email input with provided value', () => {
		const { container } = render(<CanvasBoard {...defaultProps} email="test@example.com" />);
		const input = container.querySelector('input[type="email"]') as HTMLInputElement;
		expect(input?.value).toBe('test@example.com');
	});

	it('should show submitting state', () => {
		const { container } = render(<CanvasBoard {...defaultProps} waitlistStatus="submitting" />);
		const button = container.querySelector('button[type="submit"]') as HTMLButtonElement;
		expect(button?.disabled).toBe(true);
		expect(button?.textContent).toBe('Requesting...');
	});

	it('should display waitlist message', () => {
		const { getByText } = render(
			<CanvasBoard {...defaultProps} waitlistMessage="Success message" waitlistStatus="success" />,
		);
		expect(getByText('Success message')).toBeTruthy();
	});

	it('should set data-active attribute when activeChapterId is waitlist', () => {
		const { container } = render(<CanvasBoard {...defaultProps} activeChapterId="waitlist" />);
		const form = container.querySelector('.landing-board-waitlist-card');
		expect(form?.getAttribute('data-active')).toBe('true');
	});

	it('should set data-active attribute on intro card when activeChapterId is intro', () => {
		const { container } = render(<CanvasBoard {...defaultProps} activeChapterId="intro" />);
		const introCard = container.querySelector('.landing-board-intro-card');
		expect(introCard?.getAttribute('data-active')).toBe('true');
	});

	it('should set data-active attribute on capture cards when activeChapterId is capture', () => {
		const { container } = render(<CanvasBoard {...defaultProps} activeChapterId="capture" />);
		const captureCard = container.querySelector('.landing-board-cluster-card');
		expect(captureCard?.getAttribute('data-active')).toBe('true');
	});

	it('should set data-active attribute on research cards when activeChapterId is research', () => {
		const { container } = render(<CanvasBoard {...defaultProps} activeChapterId="research" />);
		const researchCard = container.querySelector('.landing-board-research-card');
		expect(researchCard?.getAttribute('data-active')).toBe('true');
	});

	it('should set data-active attribute on plan cards when activeChapterId is plan', () => {
		const { container } = render(<CanvasBoard {...defaultProps} activeChapterId="plan" />);
		const kanbanCard = container.querySelector('.landing-board-kanban-card');
		expect(kanbanCard?.getAttribute('data-active')).toBe('true');
	});

	it('should set data-active attribute on polish cards when activeChapterId is polish', () => {
		const { container } = render(<CanvasBoard {...defaultProps} activeChapterId="polish" />);
		const docCard = container.querySelector('.landing-board-doc-card');
		expect(docCard?.getAttribute('data-active')).toBe('true');
	});

	it('should render flow connectors', () => {
		const { container } = render(<CanvasBoard {...defaultProps} />);
		const connectors = container.querySelectorAll('.landing-flow-connector');
		expect(connectors.length).toBe(4);
	});

	it('should render ambient glows', () => {
		const { container } = render(<CanvasBoard {...defaultProps} />);
		const glows = container.querySelectorAll('.landing-ambient-glow');
		expect(glows.length).toBe(4);
	});

	it('should render sketch layer elements', () => {
		const { container } = render(<CanvasBoard {...defaultProps} />);
		expect(container.querySelector('.landing-sketch-layer')).toBeTruthy();
		expect(container.querySelectorAll('.landing-sketch-rect').length).toBeGreaterThan(0);
		expect(container.querySelectorAll('.landing-sketch-circle').length).toBeGreaterThan(0);
		expect(container.querySelectorAll('.landing-sketch-arrow').length).toBeGreaterThan(0);
		expect(container.querySelectorAll('.landing-sketch-wiggle').length).toBeGreaterThan(0);
		expect(container.querySelectorAll('.landing-sketch-dots').length).toBeGreaterThan(0);
	});

	it('should render web embed video card', () => {
		const { container } = render(<CanvasBoard {...defaultProps} />);
		const embedCard = container.querySelector('.landing-board-embed-card');
		expect(embedCard).toBeTruthy();
		expect(embedCard?.querySelector('.landing-embed-player')).toBeTruthy();
		expect(embedCard?.querySelector('.landing-embed-tutorial')).toBeTruthy();
	});

	it('should render rich text document card', () => {
		const { container } = render(<CanvasBoard {...defaultProps} />);
		const richDocCard = container.querySelector('.landing-board-richdoc-card');
		expect(richDocCard).toBeTruthy();
		expect(richDocCard?.querySelector('.landing-richdoc-content')).toBeTruthy();
		expect(richDocCard?.querySelector('.landing-richdoc-heading')).toBeTruthy();
		expect(richDocCard?.querySelector('.landing-richdoc-toolbar')).toBeTruthy();
	});

	it('should render improved prototype card with frames', () => {
		const { container } = render(<CanvasBoard {...defaultProps} />);
		const prototypeCard = container.querySelector('.landing-board-prototype-card');
		expect(prototypeCard).toBeTruthy();
		const frames = prototypeCard?.querySelectorAll('.landing-prototype-frame');
		expect(frames?.length).toBe(3);
	});
});
