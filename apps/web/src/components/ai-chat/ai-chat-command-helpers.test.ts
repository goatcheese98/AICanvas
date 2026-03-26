import { describe, expect, it } from 'vitest';
import {
	applyAIChatCommandSuggestion,
	getAIChatCommandMenuState,
	parseAIChatCommandInput,
	resolveAIChatRequest,
} from './ai-chat-command-helpers';

describe('ai-chat-command-helpers', () => {
	it('shows command suggestions for a pending slash token', () => {
		const menuState = getAIChatCommandMenuState('/sel');

		expect(menuState).not.toBeNull();
		expect(menuState?.query).toBe('sel');
		expect(menuState?.suggestions.map((command) => command.name)).toEqual(['select', 'selectall']);
	});

	it('replaces the pending command token when a suggestion is applied', () => {
		expect(applyAIChatCommandSuggestion('/select /sv', 'svg')).toBe('/select /svg ');
	});

	it('parses stacked slash commands and strips them from the prompt', () => {
		expect(parseAIChatCommandInput('/select /svg make this a badge')).toMatchObject({
			isSlashCommand: true,
			command: 'svg',
			prompt: 'make this a badge',
			contextModeOverride: 'selected',
			modeHintOverride: 'svg',
		});
	});

	it('treats unknown slash prefixes as normal prompt text', () => {
		expect(parseAIChatCommandInput('/api/assistant route notes')).toMatchObject({
			isSlashCommand: true,
			command: null,
			commands: [],
			prompt: '/api/assistant route notes',
		});
	});

	it('falls back to automatic context resolution when no context command is present', () => {
		expect(resolveAIChatRequest('/svg diagram the release flow', 2)).toMatchObject({
			command: 'svg',
			prompt: 'diagram the release flow',
			contextMode: 'selected',
			modeHint: 'svg',
		});
	});
});
