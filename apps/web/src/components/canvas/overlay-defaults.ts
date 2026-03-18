import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';

export function createDefaultKanbanColumns(): KanbanOverlayCustomData['columns'] {
	return [
		{
			id: crypto.randomUUID(),
			title: 'To Do',
			color: '#6965db',
			cards: [
				{
					id: crypto.randomUUID(),
					title: 'Capture the goal',
					description: 'Write down what this board is helping you ship before you add more cards.',
					priority: 'medium' as const,
					labels: ['setup'],
					checklist: [
						{ id: crypto.randomUUID(), text: 'Name the outcome', done: false },
						{ id: crypto.randomUUID(), text: 'Note the deadline', done: false },
					],
				},
				{
					id: crypto.randomUUID(),
					title: 'List the next actions',
					description: 'Break the work into concrete cards so the first move is obvious.',
					priority: 'low' as const,
					labels: ['planning'],
					checklist: [],
				},
			],
		},
		{
			id: crypto.randomUUID(),
			title: 'In Progress',
			color: '#c28a42',
			cards: [
				{
					id: crypto.randomUUID(),
					title: 'Shape the first pass',
					description: 'Use this lane for the card you are actively moving right now.',
					priority: 'high' as const,
					labels: ['focus'],
					checklist: [
						{ id: crypto.randomUUID(), text: 'Finish the rough draft', done: true },
						{ id: crypto.randomUUID(), text: 'Review the flow', done: false },
					],
				},
			],
		},
		{
			id: crypto.randomUUID(),
			title: 'Done',
			color: '#557768',
			cards: [
				{
					id: crypto.randomUUID(),
					title: 'Board ready',
					description: 'Keep a finished card here so new boards do not feel empty.',
					priority: 'low' as const,
					labels: ['starter'],
					checklist: [{ id: crypto.randomUUID(), text: 'Starter template loaded', done: true }],
				},
			],
		},
	];
}

export const DEFAULT_MARKDOWN_CONTENT = `# <img src="https://cdn.jsdelivr.net/gh/dcurtis/markdown-mark/svg/markdown-mark.svg" alt="Markdown icon" width="28" height="28" /> New Note

Double-click to edit this note.

## Bullet List
- First list item
- Second list item

## Checklist
- [ ] Draft the content
- [x] Review the layout

## Code Example
\`\`\`javascript
const example = "Hello World";
console.log(example);
\`\`\`

## Links Table
| Resource | Link |
| -------- | ---- |
| Markdown Guide | [CommonMark](https://commonmark.org/) |
| GFM Spec | [GitHub Flavored Markdown](https://github.github.com/gfm/) |

> Tip: switch between Raw, Hybrid, and Preview to explore the note.`;
