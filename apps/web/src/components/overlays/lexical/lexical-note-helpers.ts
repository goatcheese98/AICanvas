import type { NewLexCommentReply, NewLexCommentThread } from '@ai-canvas/shared/types';

export const DEFAULT_NEWLEX_CONTENT =
	'{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}';
export const CONTENT_COMMIT_DEBOUNCE_MS = 350;
export const NOTE_FONT_STACK =
	'"Segoe UI Variable", "SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
export const MAX_NEWLEX_TITLE_LENGTH = 32;
export const DEFAULT_NEWLEX_TITLE = 'Rich Text';
export const MIN_EXPANDED_EDITOR_WIDTH = 1120;
export const MIN_EXPANDED_EDITOR_WITH_COMMENTS_WIDTH = 1420;

export function formatTimestamp(timestamp: number) {
	return new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	}).format(new Date(timestamp));
}

export function createCommentThread(comment: string, anchorText = ''): NewLexCommentThread {
	return {
		id: crypto.randomUUID(),
		author: 'You',
		comment,
		commentDeleted: false,
		anchorText,
		createdAt: Date.now(),
		resolved: false,
		collapsed: false,
		replies: [],
	};
}

export function createReply(message: string): NewLexCommentReply {
	return {
		id: crypto.randomUUID(),
		author: 'You',
		message,
		createdAt: Date.now(),
		deleted: false,
	};
}

export function serializeComments(comments: NewLexCommentThread[]) {
	return JSON.stringify(comments);
}

export function shouldShowLexicalDebugPanel() {
	if (!import.meta.env.DEV || typeof window === 'undefined') return false;
	const url = new URL(window.location.href);
	return (
		url.searchParams.get('debugLexical') === '1' ||
		window.localStorage.getItem('ai-canvas:debug:lexical') === '1'
	);
}
