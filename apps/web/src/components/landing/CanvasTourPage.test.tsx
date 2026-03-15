import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CanvasTourPage } from './CanvasTourPage';

let latestExcalidrawProps: Record<string, unknown> | null = null;

vi.mock('@excalidraw/excalidraw', async () => {
	const React = await import('react');

	return {
		FONT_FAMILY: {
			Nunito: 1,
			Excalifont: 4,
		},
		Excalidraw: (props: Record<string, unknown>) => {
			latestExcalidrawProps = props;

			React.useEffect(() => {
				const ready = props.excalidrawAPI as ((api: unknown) => void) | undefined;
				ready?.({
					addFiles: vi.fn(),
					getAppState: vi.fn(() => ({
						activeTool: { type: 'selection' },
						height: 900,
						scrollX: 0,
						scrollY: 0,
						selectedElementIds: {},
						viewBackgroundColor: '#f7f8fb',
						width: 1440,
						zoom: { value: 1 },
					})),
					getFiles: vi.fn(() => ({})),
					getSceneElements: vi.fn(() => []),
					setActiveTool: vi.fn(),
					updateScene: vi.fn(),
				});
			}, [props.excalidrawAPI]);

			return <div data-testid="mock-excalidraw-tour" />;
		},
		convertToExcalidrawElements: (elements: unknown) => elements,
	};
});

afterEach(() => {
	latestExcalidrawProps = null;
	cleanup();
});

describe('CanvasTourPage', () => {
	it('renders the experimental canvas tour first frame on top of a real Excalidraw surface', () => {
		render(<CanvasTourPage />);

		expect(screen.getByRole('link', { name: /roopstudio/i })).toBeTruthy();
		expect(screen.getByRole('link', { name: /back to landing/i }).getAttribute('href')).toBe('/');
		expect(screen.getByRole('link', { name: /^sign in$/i }).getAttribute('href')).toBe('/login');
		expect(
			screen.getByRole('heading', {
				name: /start with what you already have/i,
				level: 2,
			}),
		).toBeTruthy();
		expect(screen.getByText(/ask for a summary, explanation, or practice quiz/i)).toBeTruthy();
		expect(screen.getByTestId('mock-excalidraw-tour')).toBeTruthy();
		expect(screen.getByRole('button', { name: /guide mode/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /explore demo/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /hide grid/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /reset demo/i })).toBeTruthy();
	});

	it('configures Excalidraw as a visible demo surface with interaction disabled at the page layer', () => {
		render(<CanvasTourPage />);

		expect(latestExcalidrawProps).not.toBeNull();
		expect(latestExcalidrawProps?.detectScroll).toBe(false);
		expect(latestExcalidrawProps?.handleKeyboardGlobally).toBe(false);
		expect(latestExcalidrawProps?.gridModeEnabled).toBe(true);
		expect(latestExcalidrawProps?.isCollaborating).toBe(true);
		expect(latestExcalidrawProps?.initialData).toBeTruthy();
	});
});
