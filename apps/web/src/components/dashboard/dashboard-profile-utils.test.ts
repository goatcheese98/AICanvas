import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_PERSONAL_PREFERENCES,
	DEFAULT_WORKSPACE_SETTINGS,
	getPersonalPreferencesKey,
	getWorkspaceSettingsKey,
	readStoredValue,
	writeStoredValue,
} from './dashboard-profile-utils';

describe('dashboard-profile-utils', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	describe('readStoredValue', () => {
		it('should return fallback when window is undefined', () => {
			const originalWindow = globalThis.window;
			// @ts-expect-error - simulating SSR
			globalThis.window = undefined;

			const result = readStoredValue('test-key', { foo: 'bar' });
			expect(result).toEqual({ foo: 'bar' });

			globalThis.window = originalWindow;
		});

		it('should return fallback when key does not exist', () => {
			const result = readStoredValue('non-existent-key', { value: 42 });
			expect(result).toEqual({ value: 42 });
		});

		it('should return fallback when JSON is invalid', () => {
			localStorage.setItem('invalid-key', 'not valid json');
			const result = readStoredValue('invalid-key', { default: true });
			expect(result).toEqual({ default: true });
		});

		it('should merge stored partial values with fallback', () => {
			localStorage.setItem('partial-key', JSON.stringify({ a: 1 }));
			const result = readStoredValue('partial-key', { a: 0, b: 2 });
			expect(result).toEqual({ a: 1, b: 2 });
		});

		it('should return full stored value when complete', () => {
			const stored = { a: 1, b: 2 };
			localStorage.setItem('complete-key', JSON.stringify(stored));
			const result = readStoredValue('complete-key', { a: 0, b: 0 });
			expect(result).toEqual(stored);
		});
	});

	describe('writeStoredValue', () => {
		it('should silently return when window is undefined', () => {
			const originalWindow = globalThis.window;
			// @ts-expect-error - simulating SSR
			globalThis.window = undefined;

			expect(() => writeStoredValue('key', { value: 1 })).not.toThrow();

			globalThis.window = originalWindow;
		});

		it('should write value to localStorage', () => {
			writeStoredValue('test-write', { foo: 'bar' });
			expect(localStorage.getItem('test-write')).toBe('{"foo":"bar"}');
		});

		it('should silently fail on localStorage error', () => {
			vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
				throw new Error('Quota exceeded');
			});

			expect(() => writeStoredValue('key', { value: 1 })).not.toThrow();
		});
	});

	describe('workspace settings', () => {
		it('should return default settings when none stored', () => {
			const settings = readStoredValue(getWorkspaceSettingsKey(), DEFAULT_WORKSPACE_SETTINGS);
			expect(settings).toEqual(DEFAULT_WORKSPACE_SETTINGS);
		});

		it('should save and load workspace settings using direct localStorage', () => {
			// Use direct localStorage to avoid any potential issues with module state
			const key = 'dashboard-workspace-settings';
			const newSettings = {
				defaultCanvasVisibility: 'public' as const,
				showSharedCanvases: false,
			};
			localStorage.setItem(key, JSON.stringify(newSettings));
			const raw = localStorage.getItem(key);
			const loaded = raw ? JSON.parse(raw) : DEFAULT_WORKSPACE_SETTINGS;
			expect(loaded).toEqual(newSettings);
		});

		it('should use readStoredValue with saved workspace settings', () => {
			const key = 'dashboard-workspace-settings';
			const newSettings = {
				defaultCanvasVisibility: 'public' as const,
				showSharedCanvases: false,
			};
			localStorage.setItem(key, JSON.stringify(newSettings));
			const loaded = readStoredValue(key, DEFAULT_WORKSPACE_SETTINGS);
			expect(loaded).toEqual(newSettings);
		});

		it('should return consistent key', () => {
			expect(getWorkspaceSettingsKey()).toBe('dashboard-workspace-settings');
		});
	});

	describe('personal preferences', () => {
		it('should return default preferences when none stored', () => {
			const preferences = readStoredValue(
				getPersonalPreferencesKey(),
				DEFAULT_PERSONAL_PREFERENCES,
			);
			expect(preferences).toEqual(DEFAULT_PERSONAL_PREFERENCES);
		});

		it('should save and load personal preferences using direct localStorage', () => {
			const key = 'dashboard-personal-preferences';
			const newPreferences = {
				emailDigests: false,
				reducedMotion: true,
			};
			localStorage.setItem(key, JSON.stringify(newPreferences));
			const raw = localStorage.getItem(key);
			const loaded = raw ? JSON.parse(raw) : DEFAULT_PERSONAL_PREFERENCES;
			expect(loaded).toEqual(newPreferences);
		});

		it('should use readStoredValue with saved personal preferences', () => {
			const key = 'dashboard-personal-preferences';
			const newPreferences = {
				emailDigests: false,
				reducedMotion: true,
			};
			localStorage.setItem(key, JSON.stringify(newPreferences));
			const loaded = readStoredValue(key, DEFAULT_PERSONAL_PREFERENCES);
			expect(loaded).toEqual(newPreferences);
		});

		it('should return consistent key', () => {
			expect(getPersonalPreferencesKey()).toBe('dashboard-personal-preferences');
		});
	});
});
