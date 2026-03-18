import { describe, expect, it } from 'vitest';
import type { OverlayAction } from './canvas-ui-utils';
import {
	MAX_PANEL_WIDTH,
	MIN_PANEL_WIDTH,
	clampPanelWidth,
	getCollaborationStatusDotClass,
	getOverlayInsertionMessage,
	getProfileInfo,
	overlayActions,
} from './canvas-ui-utils';

describe('canvas-ui-utils', () => {
	describe('getProfileInfo', () => {
		it('should return default values when user is null', () => {
			const result = getProfileInfo(null);
			expect(result.profileName).toBe('You');
			expect(result.initials).toBe('Y');
			expect(result.profileEmail).toBe('Signed in');
		});

		it('should use fullName when available', () => {
			const user = {
				fullName: 'John Doe',
				username: null,
				firstName: null,
				primaryEmailAddress: null,
			} as unknown as Parameters<typeof getProfileInfo>[0];
			const result = getProfileInfo(user);
			expect(result.profileName).toBe('John Doe');
			expect(result.initials).toBe('JD');
		});

		it('should fall back to username when fullName is not available', () => {
			const user = {
				fullName: null,
				username: 'johndoe',
				firstName: null,
				primaryEmailAddress: null,
			} as unknown as Parameters<typeof getProfileInfo>[0];
			const result = getProfileInfo(user);
			expect(result.profileName).toBe('johndoe');
			expect(result.initials).toBe('J');
		});

		it('should fall back to firstName when fullName and username are not available', () => {
			const user = {
				fullName: null,
				username: null,
				firstName: 'John',
				primaryEmailAddress: null,
			} as unknown as Parameters<typeof getProfileInfo>[0];
			const result = getProfileInfo(user);
			expect(result.profileName).toBe('John');
			expect(result.initials).toBe('J');
		});

		it('should fall back to email prefix when other names are not available', () => {
			const user = {
				fullName: null,
				username: null,
				firstName: null,
				primaryEmailAddress: {
					emailAddress: 'john@example.com',
				},
			} as unknown as Parameters<typeof getProfileInfo>[0];
			const result = getProfileInfo(user);
			expect(result.profileName).toBe('john');
			expect(result.initials).toBe('J');
		});

		it('should use email from primaryEmailAddress', () => {
			const user = {
				fullName: 'John Doe',
				primaryEmailAddress: {
					emailAddress: 'john@example.com',
				},
			} as unknown as Parameters<typeof getProfileInfo>[0];
			const result = getProfileInfo(user);
			expect(result.profileEmail).toBe('john@example.com');
		});
	});

	describe('getCollaborationStatusDotClass', () => {
		it('should return bg-emerald-500 for connected status', () => {
			expect(getCollaborationStatusDotClass('connected')).toBe('bg-emerald-500');
		});

		it('should return bg-amber-500 for reconnecting status', () => {
			expect(getCollaborationStatusDotClass('reconnecting')).toBe('bg-amber-500');
		});

		it('should return bg-rose-500 for error status', () => {
			expect(getCollaborationStatusDotClass('error')).toBe('bg-rose-500');
		});

		it('should return bg-stone-300 for idle status', () => {
			expect(getCollaborationStatusDotClass('idle')).toBe('bg-stone-300');
		});

		it('should return bg-stone-300 for connecting status', () => {
			expect(getCollaborationStatusDotClass('connecting')).toBe('bg-stone-300');
		});
	});

	describe('clampPanelWidth', () => {
		it('should clamp width to max when viewport is large', () => {
			const result = clampPanelWidth(500, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH, 1200);
			expect(result).toBe(MAX_PANEL_WIDTH);
		});

		it('should return current width when within bounds', () => {
			const result = clampPanelWidth(300, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH, 1200);
			expect(result).toBe(300);
		});

		it('should clamp to viewport max when viewport is small', () => {
			const result = clampPanelWidth(400, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH, 300);
			// viewport - 48 = 252, but min is 280, so clamped to 280
			expect(result).toBe(280);
		});
	});

	describe('getOverlayInsertionMessage', () => {
		it('should return specific message for newlex type', () => {
			expect(getOverlayInsertionMessage('newlex')).toBe('Rich text note inserted');
		});

		it('should return specific message for prototype type', () => {
			expect(getOverlayInsertionMessage('prototype')).toBe('Prototype overlay inserted');
		});

		it('should return generic message with label for markdown type', () => {
			expect(getOverlayInsertionMessage('markdown')).toBe('Markdown inserted');
		});

		it('should return generic message with label for kanban type', () => {
			expect(getOverlayInsertionMessage('kanban')).toBe('Kanban inserted');
		});

		it('should return generic message with label for web-embed type', () => {
			expect(getOverlayInsertionMessage('web-embed')).toBe('Web Embed inserted');
		});
	});

	describe('overlayActions', () => {
		it('should contain all expected overlay types', () => {
			const types = overlayActions.map((a: OverlayAction) => a.type);
			expect(types).toContain('markdown');
			expect(types).toContain('newlex');
			expect(types).toContain('kanban');
			expect(types).toContain('web-embed');
			expect(types).toContain('prototype');
			expect(overlayActions).toHaveLength(5);
		});

		it('should have required properties for each action', () => {
			for (const action of overlayActions) {
				expect(action.type).toBeDefined();
				expect(action.label).toBeDefined();
				expect(action.description).toBeDefined();
				expect(typeof action.label).toBe('string');
				expect(typeof action.description).toBe('string');
			}
		});
	});
});
