import type { CollaborationSessionStatus } from '@/hooks/collaboration-utils';
import type { OverlayType } from '@ai-canvas/shared/types';

export interface OverlayAction {
	type: OverlayType;
	label: string;
	description: string;
}

export const MIN_PANEL_WIDTH = 280;
export const MAX_PANEL_WIDTH = 420;
export const MIN_CHAT_WIDTH = 620;
export const MAX_CHAT_WIDTH = 1080;
export const MIN_CHAT_HEIGHT = 300;
export const MAX_CHAT_HEIGHT_RATIO = 0.88;

export const overlayActions: ReadonlyArray<OverlayAction> = [
	{ type: 'markdown', label: 'Markdown', description: 'Note with formatting and images' },
	{ type: 'newlex', label: 'Rich Text', description: 'Lexical editor with comments' },
	{ type: 'kanban', label: 'Kanban', description: 'Board for planning work' },
	{ type: 'web-embed', label: 'Web Embed', description: 'Inline site or prototype' },
	{ type: 'prototype', label: 'Prototype', description: 'Live React or JS app with preview' },
];

// Minimal user interface matching what we need from Clerk
interface UserInfo {
	fullName: string | null;
	username: string | null;
	firstName: string | null;
	primaryEmailAddress: { emailAddress: string } | null;
	imageUrl?: string;
}

export interface ProfileInfo {
	initials: string;
	profileName: string;
	profileEmail: string;
}

export function getProfileInfo(user: UserInfo | null | undefined): ProfileInfo {
	const profileName =
		user?.fullName ||
		user?.username ||
		user?.firstName ||
		user?.primaryEmailAddress?.emailAddress.split('@')[0] ||
		'You';

	const initials = (() => {
		const name =
			user?.fullName ||
			user?.username ||
			user?.firstName ||
			user?.primaryEmailAddress?.emailAddress.split('@')[0] ||
			'You';
		return (
			name
				.split(/\s+/)
				.slice(0, 2)
				.map((part: string) => part[0]?.toUpperCase() ?? '')
				.join('') || 'Y'
		);
	})();

	const profileEmail = user?.primaryEmailAddress?.emailAddress ?? 'Signed in';

	return { initials, profileName, profileEmail };
}

export function getCollaborationStatusDotClass(sessionStatus: CollaborationSessionStatus): string {
	switch (sessionStatus) {
		case 'connected':
			return 'bg-emerald-500';
		case 'reconnecting':
			return 'bg-amber-500';
		case 'error':
			return 'bg-rose-500';
		default:
			return 'bg-stone-300';
	}
}

export function clampPanelWidth(
	width: number,
	min: number,
	max: number,
	viewportWidth: number,
): number {
	const viewportMax = Math.max(min, Math.min(max, viewportWidth - 48));
	return Math.min(width, viewportMax);
}

export function getOverlayInsertionMessage(type: OverlayType): string {
	switch (type) {
		case 'newlex':
			return 'Rich text note inserted';
		case 'prototype':
			return 'Prototype overlay inserted';
		default: {
			const action = overlayActions.find((a) => a.type === type);
			return `${action?.label ?? 'Overlay'} inserted`;
		}
	}
}
