import type { AssistantContextMode, GenerationMode } from '@ai-canvas/shared/types';
import { resolveAssistantContextMode } from './selection-context';

type ModeHint = Extract<GenerationMode, 'image' | 'sketch' | 'svg'>;

export type AIChatSlashCommandName = 'select' | 'selectall' | 'none' | 'raster' | 'vector' | 'svg';

export interface AIChatSlashCommandSpec {
	name: AIChatSlashCommandName;
	label: string;
	description: string;
	contextModeOverride?: AssistantContextMode;
	modeHintOverride?: ModeHint;
	aliases?: string[];
}

export interface AIChatCommandMenuState {
	query: string;
	replaceStart: number;
	replaceEnd: number;
	activeCommands: AIChatSlashCommandSpec[];
	suggestions: AIChatSlashCommandSpec[];
}

export interface ParsedAIChatCommandInput {
	isSlashCommand: boolean;
	command: AIChatSlashCommandName | null;
	commands: AIChatSlashCommandSpec[];
	prompt: string;
	contextModeOverride?: AssistantContextMode;
	modeHintOverride?: ModeHint;
}

export interface ResolvedAIChatRequest {
	command: AIChatSlashCommandName | null;
	commands: AIChatSlashCommandSpec[];
	prompt: string;
	contextMode: AssistantContextMode;
	modeHint?: ModeHint;
}

export const AI_CHAT_SLASH_COMMANDS: AIChatSlashCommandSpec[] = [
	{
		name: 'select',
		label: 'Use selection',
		description: 'Use only the current selection as context.',
		contextModeOverride: 'selected',
		aliases: ['selection'],
	},
	{
		name: 'selectall',
		label: 'Use whole canvas',
		description: 'Use the whole canvas as context.',
		contextModeOverride: 'all',
		aliases: ['canvas', 'all'],
	},
	{
		name: 'none',
		label: 'Ignore canvas',
		description: 'Send the prompt without canvas context.',
		contextModeOverride: 'none',
		aliases: ['clear'],
	},
	{
		name: 'raster',
		label: 'Raster image',
		description: 'Prefer a raster image result.',
		modeHintOverride: 'image',
		aliases: ['image'],
	},
	{
		name: 'vector',
		label: 'Vector sketch',
		description: 'Prefer a sketch-style vector result.',
		modeHintOverride: 'sketch',
		aliases: ['sketch'],
	},
	{
		name: 'svg',
		label: 'SVG illustration',
		description: 'Prefer an SVG result.',
		modeHintOverride: 'svg',
	},
];

function normalizeCommandToken(value: string): string {
	return value.toLowerCase();
}

function isWhitespace(character: string | undefined) {
	return character === ' ' || character === '\n' || character === '\t' || character === '\r';
}

function skipWhitespace(input: string, startIndex: number) {
	let index = startIndex;
	while (index < input.length && isWhitespace(input[index])) {
		index += 1;
	}
	return index;
}

function readTokenEnd(input: string, startIndex: number) {
	let index = startIndex;
	while (index < input.length && !isWhitespace(input[index])) {
		index += 1;
	}
	return index;
}

function getCommandSpec(token: string): AIChatSlashCommandSpec | undefined {
	const normalizedToken = normalizeCommandToken(token);
	return AI_CHAT_SLASH_COMMANDS.find((spec) => {
		if (spec.name === normalizedToken) {
			return true;
		}

		return spec.aliases?.some((alias) => normalizeCommandToken(alias) === normalizedToken) ?? false;
	});
}

function scanAIChatCommandPrefix(input: string) {
	const commands: AIChatSlashCommandSpec[] = [];
	let index = skipWhitespace(input, 0);

	while (index < input.length && input[index] === '/') {
		const tokenStart = index;
		const tokenEnd = readTokenEnd(input, tokenStart);
		const token = input.slice(tokenStart + 1, tokenEnd);
		const command = getCommandSpec(token);

		if (!command) {
			const remainderStart = skipWhitespace(input, tokenEnd);
			if (remainderStart >= input.length) {
				return {
					commands,
					nextIndex: tokenStart,
					pendingToken: {
						query: normalizeCommandToken(token),
						replaceStart: tokenStart,
						replaceEnd: tokenEnd,
					},
				};
			}

			return {
				commands,
				nextIndex: tokenStart,
			};
		}

		commands.push(command);
		index = skipWhitespace(input, tokenEnd);
	}

	return {
		commands,
		nextIndex: index,
	};
}

export function getAIChatCommandMenuState(input: string): AIChatCommandMenuState | null {
	const scanResult = scanAIChatCommandPrefix(input);
	if (!('pendingToken' in scanResult) || !scanResult.pendingToken) {
		return null;
	}

	const suggestions = AI_CHAT_SLASH_COMMANDS.filter((spec) => {
		if (spec.name.startsWith(scanResult.pendingToken.query)) {
			return true;
		}

		return (
			spec.aliases?.some((alias) =>
				normalizeCommandToken(alias).startsWith(scanResult.pendingToken.query),
			) ?? false
		);
	});

	return {
		query: scanResult.pendingToken.query,
		replaceStart: scanResult.pendingToken.replaceStart,
		replaceEnd: scanResult.pendingToken.replaceEnd,
		activeCommands: scanResult.commands,
		suggestions,
	};
}

export function getAIChatCommandSuggestions(input: string): AIChatSlashCommandSpec[] {
	return getAIChatCommandMenuState(input)?.suggestions ?? [];
}

export function applyAIChatCommandSuggestion(
	input: string,
	commandName: AIChatSlashCommandName,
): string {
	const command = AI_CHAT_SLASH_COMMANDS.find((spec) => spec.name === commandName);
	const menuState = getAIChatCommandMenuState(input);

	if (!command || !menuState) {
		return input;
	}

	const prefix = input.slice(0, menuState.replaceStart);
	const suffix = input.slice(menuState.replaceEnd).trimStart();
	return `${prefix}/${command.name}${suffix ? ` ${suffix}` : ' '}`;
}

export function parseAIChatCommandInput(input: string): ParsedAIChatCommandInput {
	const scanResult = scanAIChatCommandPrefix(input);
	const commands = scanResult.commands;
	const prompt = input.slice(scanResult.nextIndex).trim();
	const command = commands.at(-1)?.name ?? null;

	let contextModeOverride: AssistantContextMode | undefined;
	let modeHintOverride: ModeHint | undefined;

	for (const currentCommand of commands) {
		if (currentCommand.contextModeOverride) {
			contextModeOverride = currentCommand.contextModeOverride;
		}
		if (currentCommand.modeHintOverride) {
			modeHintOverride = currentCommand.modeHintOverride;
		}
	}

	return {
		isSlashCommand: commands.length > 0 || input.trimStart().startsWith('/'),
		command,
		commands,
		prompt,
		contextModeOverride,
		modeHintOverride,
	};
}

export function resolveAIChatRequest(input: string, selectionCount: number): ResolvedAIChatRequest {
	const parsed = parseAIChatCommandInput(input);
	const contextMode =
		parsed.contextModeOverride ??
		resolveAssistantContextMode({ prompt: parsed.prompt, selectionCount });

	return {
		command: parsed.command,
		commands: parsed.commands,
		prompt: parsed.prompt,
		contextMode,
		modeHint: parsed.modeHintOverride,
	};
}
