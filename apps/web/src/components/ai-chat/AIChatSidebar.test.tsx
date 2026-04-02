import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIChatSidebar } from './AIChatSidebar';

describe('AIChatSidebar', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders recent threads in a top rail and forwards thread actions', () => {
		const onCreateThread = vi.fn();
		const onSelectThread = vi.fn();
		const onDeleteThread = vi.fn();

		render(
			<AIChatSidebar
				isHistoryCollapsed={false}
				threads={[
					{
						id: 'thread-1',
						canvasId: 'canvas-1',
						title: 'Launch planning',
						messages: [
							{
								id: 'msg-1',
								role: 'user',
								content: 'Outline the launch plan',
								createdAt: '2026-03-01T10:01:00.000Z',
							},
						],
						createdAt: '2026-03-01T10:00:00.000Z',
						updatedAt: '2026-03-01T10:15:00.000Z',
					},
					{
						id: 'thread-2',
						canvasId: 'canvas-1',
						title: 'Design review',
						messages: [
							{
								id: 'msg-2',
								role: 'user',
								content: 'Review the draft design',
								createdAt: '2026-03-02T11:01:00.000Z',
							},
						],
						createdAt: '2026-03-02T11:00:00.000Z',
						updatedAt: '2026-03-02T11:20:00.000Z',
					},
				]}
				currentThreadId="thread-2"
				onToggleCollapse={vi.fn()}
				onCreateThread={onCreateThread}
				onSelectThread={onSelectThread}
				onDeleteThread={onDeleteThread}
			/>,
		);

		expect(screen.getByRole('region', { name: 'Chat history' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'New Chat' })).toBeTruthy();
		expect(screen.getByRole('button', { name: /^Launch planning/ })).toBeTruthy();
		expect(screen.getByRole('button', { name: /^Design review/ })).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: /^Launch planning/ }));
		expect(onSelectThread).toHaveBeenCalledWith('thread-1');

		fireEvent.click(screen.getByRole('button', { name: 'Delete Launch planning' }));
		expect(onDeleteThread).toHaveBeenCalledWith('thread-1');

		fireEvent.click(screen.getByRole('button', { name: 'New Chat' }));
		expect(onCreateThread).toHaveBeenCalled();
	});

	it('can hide the thread rail without losing the creation action', () => {
		const onToggleCollapse = vi.fn();

		render(
			<AIChatSidebar
				isHistoryCollapsed
				threads={[]}
				currentThreadId={null}
				onToggleCollapse={onToggleCollapse}
				onCreateThread={vi.fn()}
				onSelectThread={vi.fn()}
				onDeleteThread={vi.fn()}
			/>,
		);

		expect(screen.getByRole('button', { name: 'Show chat history' })).toBeTruthy();
		expect(screen.getByText('Chat history is hidden.')).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: 'Show chat history' }));
		expect(onToggleCollapse).toHaveBeenCalled();
	});
});
