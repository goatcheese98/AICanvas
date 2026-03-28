import type { NewLexOverlayCustomData } from '@ai-canvas/shared/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LexicalNotePreviewCard } from './LexicalNotePreviewCard';

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
	} as Parameters<typeof LexicalNotePreviewCard>[0]['element'];
}

describe('LexicalNotePreviewCard', () => {
	it('renders the title when provided', () => {
		render(<LexicalNotePreviewCard element={createElement()} isSelected={false} />);

		expect(screen.getAllByText('Test Note')[0]).not.toBeNull();
	});

	it('shows "Untitled note" when title is not provided', () => {
		render(<LexicalNotePreviewCard element={createElement({ title: undefined })} isSelected={false} />);

		expect(screen.getAllByText('Untitled note')[0]).not.toBeNull();
	});

	it('renders a snippet of the content', () => {
		render(<LexicalNotePreviewCard element={createElement()} isSelected={false} />);

		expect(screen.getAllByText('This is a test note content.')[0]).not.toBeNull();
	});

	it('shows "Empty note" when there is no content', () => {
		render(
			<LexicalNotePreviewCard
				element={createElement({ lexicalState: '{"root":{"children":[]}}' })}
				isSelected={false}
			/>,
		);

		expect(screen.getAllByText('Empty note')[0]).not.toBeNull();
	});

	it('shows "Rich text" badge', () => {
		render(<LexicalNotePreviewCard element={createElement()} isSelected={false} />);

		expect(screen.getAllByText('Rich text')[0]).not.toBeNull();
	});

	it('shows comment count when comments exist', () => {
		render(
			<LexicalNotePreviewCard
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
			<LexicalNotePreviewCard
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

	it('shows "Double-click to edit" hint', () => {
		render(<LexicalNotePreviewCard element={createElement()} isSelected={false} />);

		expect(screen.getAllByText('Double-click to edit')[0]).not.toBeNull();
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

		render(<LexicalNotePreviewCard element={createElement({ lexicalState })} isSelected={false} />);

		const content = screen.getAllByText(/A\.\.\./)[0];
		expect(content).not.toBeNull();
		expect(content.textContent?.length).toBeLessThan(longText.length);
	});

	it('handles invalid lexical state gracefully', () => {
		render(
			<LexicalNotePreviewCard
				element={createElement({ lexicalState: 'invalid json' })}
				isSelected={false}
			/>,
		);

		expect(screen.getAllByText('Empty note')[0]).not.toBeNull();
	});
});
