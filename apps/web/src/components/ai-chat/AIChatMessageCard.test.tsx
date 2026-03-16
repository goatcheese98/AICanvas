import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from '@clerk/clerk-react';
import type { AssistantArtifact, AssistantMessage } from '@ai-canvas/shared/types';
import * as api from '@/lib/api';
import { MessageCard } from './AIChatMessageCard';

vi.mock('@clerk/clerk-react', () => ({
	useAuth: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
	const original = await importOriginal<typeof import('@/lib/api')>();
	return {
		...original,
		getRequiredAuthHeaders: vi.fn(),
		fetchAssistantArtifactAsset: vi.fn(),
	};
});

describe('AIChatMessageCard', () => {
	it('renders an inline preview for stored image artifacts without auto-inserting them', async () => {
		const createObjectURL = vi.fn(() => 'blob:preview-image');
		const revokeObjectURL = vi.fn();
		Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
		Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
		vi.mocked(useAuth).mockReturnValue({
			getToken: vi.fn(async () => 'token'),
			isSignedIn: true,
		} as never);
		vi.mocked(api.getRequiredAuthHeaders).mockResolvedValue({
			Authorization: 'Bearer test-token',
		});
		vi.mocked(api.fetchAssistantArtifactAsset).mockResolvedValue({
			blob: new Blob(['preview'], { type: 'image/png' }),
			mimeType: 'image/png',
		});

		const artifact: AssistantArtifact = {
			type: 'image',
			content: JSON.stringify({
				kind: 'stored_asset',
				r2Key: 'assistant-assets/run-1/image.png',
				mimeType: 'image/png',
				provider: 'cloudflare',
				artifactId: 'artifact-1',
				runId: 'run-1',
			}),
		};
		const message: AssistantMessage = {
			id: 'assistant-image-1',
			role: 'assistant',
			content: 'Here is the generated image.',
			artifacts: [artifact],
			createdAt: '2026-03-15T10:00:00.000Z',
		};
		const onInsertArtifact = vi.fn();

		render(<MessageCard message={message} onInsertArtifact={onInsertArtifact} />);

		await waitFor(() => {
			expect(screen.getByAltText('Generated asset preview').getAttribute('src')).toBe(
				'blob:preview-image',
			);
		});
		expect(screen.getByRole('button', { name: 'Insert Image' })).toBeTruthy();
	});

	it('renders markdown artifacts and forwards insert actions', () => {
		vi.mocked(useAuth).mockReturnValue({
			getToken: vi.fn(async () => 'token'),
			isSignedIn: true,
		} as never);
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
		vi.mocked(useAuth).mockReturnValue({
			getToken: vi.fn(async () => 'token'),
			isSignedIn: true,
		} as never);
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

	it('renders header accessory content next to the message meta controls', () => {
		vi.mocked(useAuth).mockReturnValue({
			getToken: vi.fn(async () => 'token'),
			isSignedIn: true,
		} as never);
		const message: AssistantMessage = {
			id: 'assistant-3',
			role: 'assistant',
			content: '## Summary\n\n- Point one',
			createdAt: '2026-03-14T10:10:00.000Z',
		};

		const { container } = render(
			<MessageCard
				message={message}
				onInsertMarkdown={vi.fn()}
				headerAccessory={<div>Assistant activity trigger</div>}
			/>,
		);

		const scopedQueries = within(container);
		const time = scopedQueries.getByText('03:10 AM');
		const accessory = scopedQueries.getByText('Assistant activity trigger');

		expect(time.compareDocumentPosition(accessory)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	});
});
