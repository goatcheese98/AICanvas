import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MarkdownNoteSettings } from '@ai-canvas/shared/types';
import { MarkdownRenderer, normalizeDisplayMath } from './MarkdownRenderer';

const TEST_MARKDOWN_SETTINGS: MarkdownNoteSettings = {
	font: 'Nunito, "Segoe UI Emoji", sans-serif',
	fontSize: 15,
	background: '#fffefc',
	lineHeight: 1.65,
	inlineCodeColor: '#7c3aed',
	showEmptyLines: true,
	autoHideToolbar: false,
};

describe('MarkdownRenderer', () => {
	it('renders plain lists and task lists with separate list styling', () => {
		const { container } = render(
			<MarkdownRenderer
				content={`## Bullets

- First
- Second

## Tasks
- [ ] Draft
- [x] Ship`}
				settings={TEST_MARKDOWN_SETTINGS}
			/>,
		);

		const lists = Array.from(container.querySelectorAll('ul'));
		expect(lists).toHaveLength(2);
		expect(lists[0]?.className).toContain('list-disc');
		expect(lists[1]?.className).toContain('pl-0');
		expect(lists[1]?.className).not.toContain('list-disc');

		const taskItems = Array.from(container.querySelectorAll('li')).slice(-2);
		expect(taskItems.every((item) => item.className.includes('list-none'))).toBe(true);
	});

	it('renders raw html images with explicit sizing inline', () => {
		const { container } = render(
			<MarkdownRenderer
				content={`# <img src="https://cdn.jsdelivr.net/gh/dcurtis/markdown-mark/svg/markdown-mark.svg" alt="Markdown icon" width="28" height="28" /> New Note`}
				settings={TEST_MARKDOWN_SETTINGS}
			/>,
		);

		const image = container.querySelector('img');
		expect(image).not.toBeNull();
		expect(image?.getAttribute('width')).toBe('28');
		expect(image?.getAttribute('height')).toBe('28');
		expect(image?.className).toContain('inline-block');
		expect(image?.className).not.toContain('max-w-full');
	});

	it('styles inline code with the configured accent color', () => {
		const { container } = render(
			<MarkdownRenderer
				content={'Use `inline` code and <code>html-inline</code> too.'}
				settings={{
					...TEST_MARKDOWN_SETTINGS,
					inlineCodeColor: '#2563eb',
				}}
			/>,
		);

		const codeNodes = Array.from(container.querySelectorAll('code'));
		expect(codeNodes).toHaveLength(2);
		expect(codeNodes[0]?.getAttribute('style')).toContain('color: rgb(37, 99, 235)');
		expect(codeNodes[0]?.getAttribute('style')).toContain('background-color: rgba(148, 163, 184, 0.16)');
		expect(codeNodes[1]?.getAttribute('style')).toContain('color: rgb(37, 99, 235)');
	});

	it('renders inline and single-line block math through katex', () => {
		const { container } = render(
			<MarkdownRenderer
				content={`Inline math $A = \\pi r^2$.

$$e^{i\\pi} + 1 = 0$$`}
				settings={TEST_MARKDOWN_SETTINGS}
			/>,
		);

		expect(container.textContent).not.toContain('$$');
		expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(2);
	});

	it('renders multiline matrix math without swallowing following markdown', () => {
		const { container } = render(
			<MarkdownRenderer
				content={`## Matrix

$$\\begin{pmatrix}
a & b \\\\
c & d
\\end{pmatrix}
\\times
\\begin{pmatrix}
x \\\\
y
\\end{pmatrix}
=
\\begin{pmatrix}
ax + by \\\\
cx + dy
\\end{pmatrix}$$

## Technical Note

Follow-up paragraph.`}
				settings={TEST_MARKDOWN_SETTINGS}
			/>,
		);

		expect(container.querySelector('.katex-display')).not.toBeNull();
		expect(container.textContent).toContain('Technical Note');
		expect(container.textContent).toContain('Follow-up paragraph.');
	});

	it('keeps markdown links inside tables interactive', () => {
		render(
			<MarkdownRenderer
				content={`| Resource | Link |
| -------- | ---- |
| Markdown Guide | [CommonMark](https://commonmark.org/) |`}
				settings={TEST_MARKDOWN_SETTINGS}
			/>,
		);

		const link = screen.getByRole('link', { name: 'CommonMark' });
		expect(link.getAttribute('href')).toBe('https://commonmark.org/');
		expect(link.getAttribute('target')).toBe('_blank');
	});

	it('normalizes multiline display math without touching single-line equations', () => {
		const normalized = normalizeDisplayMath(`$$\\begin{pmatrix}
a & b \\\\
c & d
\\end{pmatrix}$$

$$e^{i\\pi} + 1 = 0$$`);

		expect(normalized).toContain('$$\n\\begin{pmatrix}');
		expect(normalized).toContain('\\end{pmatrix}\n$$');
		expect(normalized).toContain('$$e^{i\\pi} + 1 = 0$$');
	});

	it('replaces broken images with a stable text fallback after load failure', () => {
		const { container } = render(
			<MarkdownRenderer
				content={`<img src="https://example.invalid/broken.png" alt="Broken preview image" width="240" />`}
				settings={TEST_MARKDOWN_SETTINGS}
			/>,
		);

		const image = container.querySelector('img');
		expect(image).not.toBeNull();

		fireEvent.error(image as HTMLImageElement);

		expect(container.querySelector('img')).toBeNull();
		expect(screen.getByText('Broken preview image')).not.toBeNull();
	});
});
