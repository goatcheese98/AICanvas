import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_PERSONAL_PREFERENCES,
	DEFAULT_WORKSPACE_SETTINGS,
} from './dashboard-profile-utils';
import { useDashboardProfileMenuState } from './useDashboardProfileMenuState';

describe('useDashboardProfileMenuState', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
	});

	it('should initialize with default values', () => {
		const { result } = renderHook(() => useDashboardProfileMenuState());

		expect(result.current.isMenuOpen).toBe(false);
		expect(result.current.activeView).toBe('menu');
		expect(result.current.workspaceSettings).toEqual(DEFAULT_WORKSPACE_SETTINGS);
		expect(result.current.personalPreferences).toEqual(DEFAULT_PERSONAL_PREFERENCES);
		expect(result.current.menuRef.current).toBeNull();
	});

	it('should open menu', () => {
		const { result } = renderHook(() => useDashboardProfileMenuState());

		act(() => {
			result.current.openMenu();
		});

		expect(result.current.isMenuOpen).toBe(true);
	});

	it('should close menu and reset active view', () => {
		const { result } = renderHook(() => useDashboardProfileMenuState());

		act(() => {
			result.current.openMenu();
			result.current.setActiveView('workspace');
		});

		expect(result.current.isMenuOpen).toBe(true);
		expect(result.current.activeView).toBe('workspace');

		act(() => {
			result.current.closeMenu();
		});

		expect(result.current.isMenuOpen).toBe(false);
		expect(result.current.activeView).toBe('menu');
	});

	it('should toggle menu', () => {
		const { result } = renderHook(() => useDashboardProfileMenuState());

		act(() => {
			result.current.toggleMenu();
		});

		expect(result.current.isMenuOpen).toBe(true);

		act(() => {
			result.current.setActiveView('preferences');
		});

		act(() => {
			result.current.toggleMenu();
		});

		expect(result.current.isMenuOpen).toBe(false);
		expect(result.current.activeView).toBe('menu');
	});

	it('should change active view', () => {
		const { result } = renderHook(() => useDashboardProfileMenuState());

		act(() => {
			result.current.setActiveView('workspace');
		});

		expect(result.current.activeView).toBe('workspace');

		act(() => {
			result.current.setActiveView('preferences');
		});

		expect(result.current.activeView).toBe('preferences');
	});

	it('should update workspace settings', () => {
		const { result } = renderHook(() => useDashboardProfileMenuState());

		act(() => {
			result.current.updateWorkspaceSettings((current) => ({
				...current,
				defaultCanvasVisibility: 'public',
			}));
		});

		expect(result.current.workspaceSettings.defaultCanvasVisibility).toBe('public');
	});

	it('should update personal preferences', () => {
		const { result } = renderHook(() => useDashboardProfileMenuState());

		act(() => {
			result.current.updatePersonalPreferences((current) => ({
				...current,
				emailDigests: false,
			}));
		});

		expect(result.current.personalPreferences.emailDigests).toBe(false);
	});

	it('should persist workspace settings to localStorage', () => {
		const { result } = renderHook(() => useDashboardProfileMenuState());

		act(() => {
			result.current.updateWorkspaceSettings((current) => ({
				...current,
				showSharedCanvases: false,
			}));
		});

		const stored = JSON.parse(localStorage.getItem('dashboard-workspace-settings') || '{}');
		expect(stored.showSharedCanvases).toBe(false);
	});

	it('should persist personal preferences to localStorage', () => {
		const { result } = renderHook(() => useDashboardProfileMenuState());

		act(() => {
			result.current.updatePersonalPreferences((current) => ({
				...current,
				reducedMotion: true,
			}));
		});

		const stored = JSON.parse(localStorage.getItem('dashboard-personal-preferences') || '{}');
		expect(stored.reducedMotion).toBe(true);
	});
});
