import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CopyButton } from './AIChatArtifactPrimitives';
import * as helpers from './ai-chat-helpers';

describe('CopyButton', () => {
	it('extends copied feedback to the latest click', async () => {
		vi.useFakeTimers();
		vi.spyOn(helpers, 'writeToClipboard').mockResolvedValue(undefined);

		render(<CopyButton value="hello" />);
		const button = screen.getByRole('button', { name: 'Copy' });

		await act(async () => {
			fireEvent.click(button);
		});
		expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();

		act(() => {
			vi.advanceTimersByTime(1000);
		});

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Copied' }));
		});

		act(() => {
			vi.advanceTimersByTime(1399);
		});
		expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();

		vi.useRealTimers();
	});
});
