import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIChatComposer } from './AIChatComposer';

describe('AIChatComposer', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders the command menu for slash-prefixed input', () => {
		render(
			<AIChatComposer
				chatError={null}
				selectionIndicator={null}
				textareaRef={createRef<HTMLTextAreaElement>()}
				input="/"
				disabled={false}
				onInputChange={vi.fn()}
				onSend={vi.fn()}
			/>,
		);

		expect(screen.getByRole('list', { name: 'Chat commands' })).toBeTruthy();
		expect(screen.getByText('/select')).toBeTruthy();
		expect(screen.getByText('/svg')).toBeTruthy();
	});

	it('accepts the highlighted command from the keyboard', () => {
		const onInputChange = vi.fn();
		render(
			<AIChatComposer
				chatError={null}
				selectionIndicator={null}
				textareaRef={createRef<HTMLTextAreaElement>()}
				input="/"
				disabled={false}
				onInputChange={onInputChange}
				onSend={vi.fn()}
			/>,
		);

		const textarea = screen.getAllByPlaceholderText(
			'Describe the result you want on the canvas...',
		)[0];
		fireEvent.keyDown(textarea, { key: 'ArrowDown' });
		fireEvent.keyDown(textarea, { key: 'Enter' });

		expect(onInputChange).toHaveBeenCalledWith('/selectall ');
	});
});
