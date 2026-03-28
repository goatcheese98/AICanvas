import type { NewLexOverlayCustomData } from '@ai-canvas/shared/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LexicalPreviewCard } from './LexicalPreviewCard';

function createElement(customData?: Partial<NewLexOverlayCustomData>) {
	return {
		id: 'lexical-element',
		type: 'rectangle',
		x: 0,
		y: 0,
		width: 500,
		height: 400,
		angle: 0,
		backgroundColor: '#ffffff',
		strokeColor: '#111827',
		strokeWidth: 1,
		strokeStyle: 'solid',
		fillStyle: 'solid',
		roughness: 0,
		opacity: 100,
		groupIds: [],
		frameId: null,
		roundness: null,
		boundElements: null,
		updated: 1,
		link: null,
		locked: false,
		version: 1,
		versionNonce: 1,
		isDeleted: false,
		seed: 1,
		index: 'a0' as never,
		customData: {
			type: 'newlex',
			title: 'Test Note',
			lexicalState:
				'{"root":{"children":[{"children":[{"text":"This is a test note content."}],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
			comments: [],
			commentsPanelOpen: false,
			version: 1,
			...customData,
		},
	} as Parameters<typeof LexicalPreviewCard>[0]['element'];
}

describe('LexicalPreviewCard', () => {
	it('renders the title when provided', () => {
		render(<LexicalPreviewCard element={createElement()} isSelected={false} />);

		expect(screen.getAllByText('Test Note')[0]).not.toBeNull();
	});

	it('prefers resource snapshot metadata when present', () => {
		render(
			<LexicalPreviewCard
				element={createElement({
					title: 'Legacy note title',
					resourceSnapshot: {
						resourceType: 'document',
						resourceId: 'document-1',
						title: 'Snapshot note title',
						snapshotVersion: 1,
						display: {
							badge: 'New',
							subtitle: 'Document',
							summary: 'Empty note',
						},
					},
				})}
				isSelected={false}
			/>,
		);

		expect(screen.getAllByText('Snapshot note title')[0]).not.toBeNull();
		expect(screen.getAllByText('New')[0]).not.toBeNull();
		expect(screen.getAllByText('Empty note')[0]).not.toBeNull();
		expect(screen.queryByText('Legacy note title')).toBeNull();
	});

	it('shows "Untitled note" when title is not provided', () => {
		render(<LexicalPreviewCard element={createElement({ title: undefined })} isSelected={false} />);

		expect(screen.getAllByText('Untitled note')[0]).not.toBeNull();
	});

	it('renders a snippet of the content', () => {
		render(<LexicalPreviewCard element={createElement()} isSelected={false} />);

		expect(screen.getAllByText('This is a test note content.')[0]).not.toBeNull();
	});

	it('shows "Empty note" when there is no content', () => {
		render(
			<LexicalPreviewCard
				element={createElement({ lexicalState: '{"root":{"children":[]}}' })}
				isSelected={false}
			/>,
		);

		expect(screen.getAllByText('Empty note')[0]).not.toBeNull();
	});

	it('shows "Rich text" badge', () => {
		render(<LexicalPreviewCard element={createElement()} isSelected={false} />);

		expect(screen.getAllByText('Rich text')[0]).not.toBeNull();
	});

	it('shows comment count when comments exist', () => {
		render(
			<LexicalPreviewCard
				element={createElement({
					comments: [
						{
							id: 'thread-1',
							author: 'User',
							comment: 'Test comment',
							anchorText: 'Test',
							createdAt: 1,
							resolved: false,
							collapsed: false,
							replies: [],
						},
					],
				})}
				isSelected={false}
			/>,
		);

		expect(screen.getAllByText('1 comment')[0]).not.toBeNull();
	});

	it('shows plural form for multiple comments', () => {
		render(
			<LexicalPreviewCard
				element={createElement({
					comments: [
						{
							id: 'thread-1',
							author: 'User',
							comment: 'First comment',
							anchorText: 'Test',
							createdAt: 1,
							resolved: false,
							collapsed: false,
							replies: [],
						},
						{
							id: 'thread-2',
							author: 'User',
							comment: 'Second comment',
							anchorText: 'Test',
							createdAt: 2,
							resolved: false,
							collapsed: false,
							replies: [],
						},
					],
				})}
				isSelected={false}
			/>,
		);

		expect(screen.getAllByText('2 comments')[0]).not.toBeNull();
	});

	it('shows "Double-click to open" hint', () => {
		render(<LexicalPreviewCard element={createElement()} isSelected={false} />);

		expect(screen.getAllByText('Double-click to open')[0]).not.toBeNull();
	});

	it('truncates long content', () => {
		const longText = 'A'.repeat(500);
		const lexicalState = JSON.stringify({
			root: {
				children: [
					{
						children: [{ text: longText }],
						type: 'paragraph',
						version: 1,
					},
				],
				type: 'root',
				version: 1,
			},
		});

		render(<LexicalPreviewCard element={createElement({ lexicalState })} isSelected={false} />);

		const content = screen.getAllByText(/A\.\.\./)[0];
		expect(content).not.toBeNull();
		expect(content.textContent?.length).toBeLessThan(longText.length);
	});

	it('handles invalid lexical state gracefully', () => {
		render(
			<LexicalPreviewCard
				element={createElement({ lexicalState: 'invalid json' })}
				isSelected={false}
			/>,
		);

		expect(screen.getAllByText('Empty note')[0]).not.toBeNull();
	});

	it('handles long titles gracefully', () => {
		const longTitle = 'A'.repeat(200);
		render(<LexicalPreviewCard element={createElement({ title: longTitle })} isSelected={false} />);

		// Should render without crashing
		expect(screen.getAllByText(longTitle)[0]).not.toBeNull();
	});

	it('extracts text from nested lexical nodes', () => {
		const lexicalState = JSON.stringify({
			root: {
				children: [
					{
						children: [{ text: 'First paragraph. ' }],
						type: 'paragraph',
						version: 1,
					},
					{
						children: [{ text: 'Second paragraph.' }],
						type: 'paragraph',
						version: 1,
					},
				],
				type: 'root',
				version: 1,
			},
		});

		render(<LexicalPreviewCard element={createElement({ lexicalState })} isSelected={false} />);

		expect(screen.getAllByText('First paragraph. Second paragraph.')[0]).not.toBeNull();
	});

	it('handles empty lexical state', () => {
		render(<LexicalPreviewCard element={createElement({ lexicalState: '' })} isSelected={false} />);

		expect(screen.getAllByText('Empty note')[0]).not.toBeNull();
	});

	it('handles null comments array', () => {
		render(
			<LexicalPreviewCard element={createElement({ comments: undefined })} isSelected={false} />,
		);

		// Should render without comment count
		expect(screen.getAllByText('Double-click to open')[0]).not.toBeNull();
	});
});
