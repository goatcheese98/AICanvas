import { describe, expect, it } from 'vitest';
import {
	buildConversationPrompt,
	buildD2Prompt,
	buildKanbanPrompt,
	buildMermaidPrompt,
	extractCodeBlock,
} from './parsing';

describe('assistant parsing helpers', () => {
	it('extracts fenced code blocks by language', () => {
		const text = ['before', '```mermaid', 'flowchart TD', '  A --> B', '```', 'after'].join('\n');
		expect(extractCodeBlock(text, 'mermaid')).toBe('flowchart TD\n  A --> B');
		expect(extractCodeBlock(text, 'd2')).toBeNull();
	});

	it('builds conversation prompts from history', () => {
		expect(
			buildConversationPrompt([
				{ role: 'user', text: 'hello' },
				{ role: 'assistant', text: 'world' },
			]),
		).toBe('USER: hello\n\nASSISTANT: world');
	});

	it('builds mode-specific prompts', () => {
		expect(buildMermaidPrompt('Map login flow')).toContain('Mermaid');
		expect(buildD2Prompt('Map login flow')).toContain('d2 code block');
		expect(buildKanbanPrompt('Plan launch')).toContain('JSON kanban operations');
	});
});
