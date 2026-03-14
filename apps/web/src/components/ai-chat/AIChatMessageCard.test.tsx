import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AssistantArtifact, AssistantMessage } from '@ai-canvas/shared/types';
import { MessageCard } from './AIChatMessageCard';

describe('AIChatMessageCard', () => {
	it('renders markdown artifacts and forwards insert actions', () => {
		const artifact: AssistantArtifact = {
			type: 'markdown',
			content: '# Build plan',
		};
		const onInsertArtifact = vi.fn();
		const message: AssistantMessage = {
			id: 'assistant-1',
			role: 'assistant',
			content: 'Here is the markdown version.',
			artifacts: [artifact],
			createdAt: '2026-03-14T10:00:00.000Z',
		};

		render(<MessageCard message={message} onInsertArtifact={onInsertArtifact} />);

		expect(screen.getByText('Here is the markdown version.')).toBeTruthy();
		expect(screen.getAllByText('Markdown')).toHaveLength(2);

		fireEvent.click(screen.getByRole('button', { name: 'Insert On Canvas' }));

		expect(onInsertArtifact).toHaveBeenCalledWith('assistant-1-markdown-0', artifact);
	});

	it('offers inline markdown insertion for assistant messages without structured artifacts', () => {
		const onInsertMarkdown = vi.fn();
		const message: AssistantMessage = {
			id: 'assistant-2',
			role: 'assistant',
			content: '## Summary\n\n- Point one',
			createdAt: '2026-03-14T10:05:00.000Z',
		};

		render(<MessageCard message={message} onInsertMarkdown={onInsertMarkdown} />);

		fireEvent.click(screen.getByRole('button', { name: 'Insert As Markdown' }));

		expect(onInsertMarkdown).toHaveBeenCalledWith(message);
	});
});
