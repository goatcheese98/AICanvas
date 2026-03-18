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
		expect(container.querySelector('.landing-board-marker-capture')).toBeTruthy();
	});

	it('should render board markers', () => {
		const { getByText } = render(<CanvasBoard {...defaultProps} />);
		expect(getByText('rough capture')).toBeTruthy();
		expect(getByText('research wall')).toBeTruthy();
		expect(getByText('planning lane')).toBeTruthy();
		expect(getByText('polished outputs')).toBeTruthy();
		expect(getByText('early access')).toBeTruthy();
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

	it('should not set data-active attribute when activeChapterId is not waitlist', () => {
		const { container } = render(<CanvasBoard {...defaultProps} activeChapterId="intro" />);
		const form = container.querySelector('.landing-board-waitlist-card');
		expect(form?.hasAttribute('data-active')).toBe(false);
	});
});
