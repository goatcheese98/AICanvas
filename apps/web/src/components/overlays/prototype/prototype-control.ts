import { normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type { PrototypeOverlayCustomData, PrototypeOverlayFile } from '@ai-canvas/shared/types';

type PrototypeStudioCommand =
	| { type: 'set_title'; title: string }
	| { type: 'set_active_file'; path: string }
	| { type: 'write_file'; path: string; code: string }
	| { type: 'create_file'; path: string; code?: string; activate?: boolean; hidden?: boolean }
	| { type: 'rename_file'; from: string; to: string }
	| { type: 'delete_file'; path: string }
	| { type: 'replace_files'; files: Record<string, PrototypeOverlayFile>; activeFile?: string }
	| { type: 'set_dependencies'; dependencies: Record<string, string> }
	| { type: 'set_preview_visibility'; visible: boolean }
	| { type: 'set_editor_visibility'; visible: boolean };

function withActiveFile(
	files: Record<string, PrototypeOverlayFile>,
	activeFile: string | undefined,
) {
	return Object.fromEntries(
		Object.entries(files).map(([path, file]) => [
			path,
			{
				...file,
				active: path === activeFile,
			},
		]),
	);
}

function getFallbackActiveFile(files: Record<string, PrototypeOverlayFile>) {
	return (
		Object.entries(files).find(([, file]) => file.active)?.[0] ??
		Object.keys(files).find((path) => !files[path]?.hidden) ??
		Object.keys(files)[0]
	);
}

function normalizeStudioState(state: PrototypeOverlayCustomData) {
	const normalized = normalizePrototypeOverlay(state);
	return {
		...normalized,
		files: withActiveFile(normalized.files, normalized.activeFile),
	};
}

export function applyPrototypeStudioCommand(
	input: PrototypeOverlayCustomData,
	command: PrototypeStudioCommand,
): PrototypeOverlayCustomData {
	const state = normalizeStudioState(input);

	switch (command.type) {
		case 'set_title':
			return normalizeStudioState({
				...state,
				title: command.title.slice(0, 32),
			});
		case 'set_active_file': {
			if (!state.files[command.path]) {
				return state;
			}

			return normalizeStudioState({
				...state,
				activeFile: command.path,
				files: withActiveFile(state.files, command.path),
			});
		}
		case 'write_file': {
			if (state.files[command.path]?.readOnly) {
				return state;
			}

			const nextFiles = {
				...state.files,
				[command.path]: {
					...(state.files[command.path] ?? {}),
					code: command.code,
				},
			};
			const activeFile = state.files[command.path] ? state.activeFile : command.path;
			return normalizeStudioState({
				...state,
				files: withActiveFile(nextFiles, activeFile),
				activeFile,
			});
		}
		case 'create_file': {
			if (state.files[command.path]) {
				return state;
			}

			const nextFiles = {
				...state.files,
				[command.path]: {
					code: command.code ?? '',
					hidden: command.hidden,
				},
			};
			const activeFile = command.activate ? command.path : state.activeFile;
			return normalizeStudioState({
				...state,
				files: withActiveFile(nextFiles, activeFile),
				activeFile,
			});
		}
		case 'rename_file': {
			if (
				!state.files[command.from] ||
				state.files[command.from]?.readOnly ||
				command.from === command.to ||
				state.files[command.to]
			) {
				return state;
			}

			const nextFiles = { ...state.files };
			nextFiles[command.to] = {
				...(nextFiles[command.to] ?? {}),
				...nextFiles[command.from],
			};
			delete nextFiles[command.from];
			const activeFile = state.activeFile === command.from ? command.to : state.activeFile;
			return normalizeStudioState({
				...state,
				files: withActiveFile(nextFiles, activeFile),
				activeFile,
			});
		}
		case 'delete_file': {
			if (!state.files[command.path] || state.files[command.path]?.readOnly) {
				return state;
			}

			const nextFiles = { ...state.files };
			delete nextFiles[command.path];
			const activeFile =
				state.activeFile === command.path ? getFallbackActiveFile(nextFiles) : state.activeFile;
			return normalizeStudioState({
				...state,
				files: withActiveFile(nextFiles, activeFile),
				activeFile,
			});
		}
		case 'replace_files':
			return normalizeStudioState({
				...state,
				files: command.files,
				activeFile: command.activeFile ?? getFallbackActiveFile(command.files),
			});
		case 'set_dependencies':
			return normalizeStudioState({
				...state,
				dependencies: command.dependencies,
			});
		case 'set_preview_visibility':
			return normalizeStudioState({
				...state,
				showPreview: command.visible,
			});
		case 'set_editor_visibility':
			return normalizeStudioState({
				...state,
				showEditor: command.visible,
			});
		default:
			return state;
	}
}

export function applyPrototypeStudioCommands(
	input: PrototypeOverlayCustomData,
	commands: PrototypeStudioCommand[],
) {
	return commands.reduce(applyPrototypeStudioCommand, input);
}

export function listPrototypeFiles(
	input: PrototypeOverlayCustomData,
	options?: { includeHidden?: boolean },
) {
	const normalized = normalizeStudioState(input);
	return Object.keys(normalized.files).filter(
		(path) => options?.includeHidden || !normalized.files[path]?.hidden,
	);
}
