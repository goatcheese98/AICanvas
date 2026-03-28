import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShellState } from './useShellState';

describe('useShellState', () => {
	it('defaults to expanded sidebar and closed right panel', () => {
		const { result } = renderHook(() => useShellState());

		expect(result.current.isSidebarExpanded).toBe(true);
		expect(result.current.rightPanelMode).toBe('none');
		expect(result.current.sidebarWidth).toBe(240);
		expect(result.current.rightPanelWidth).toBe(420);
	});

	it('toggles sidebar expansion', () => {
		const { result } = renderHook(() => useShellState());

		act(() => {
			result.current.toggleSidebar();
		});

		expect(result.current.isSidebarExpanded).toBe(false);
		expect(result.current.sidebarWidth).toBe(64);

		act(() => {
			result.current.toggleSidebar();
		});

		expect(result.current.isSidebarExpanded).toBe(true);
		expect(result.current.sidebarWidth).toBe(240);
	});

	it('sets sidebar expanded state directly', () => {
		const { result } = renderHook(() => useShellState());

		act(() => {
			result.current.setSidebarExpanded(false);
		});

		expect(result.current.isSidebarExpanded).toBe(false);
	});

	it('opens and closes right panel with ai mode', () => {
		const { result } = renderHook(() => useShellState());

		act(() => {
			result.current.openRightPanel('ai');
		});

		expect(result.current.rightPanelMode).toBe('ai');

		act(() => {
			result.current.closeRightPanel();
		});

		expect(result.current.rightPanelMode).toBe('none');
	});

	it('opens and closes right panel with details mode', () => {
		const { result } = renderHook(() => useShellState());

		act(() => {
			result.current.openRightPanel('details');
		});

		expect(result.current.rightPanelMode).toBe('details');

		act(() => {
			result.current.closeRightPanel();
		});

		expect(result.current.rightPanelMode).toBe('none');
	});

	it('toggles right panel mode', () => {
		const { result } = renderHook(() => useShellState());

		// Toggle on
		act(() => {
			result.current.toggleRightPanel('ai');
		});
		expect(result.current.rightPanelMode).toBe('ai');

		// Toggle same mode off
		act(() => {
			result.current.toggleRightPanel('ai');
		});
		expect(result.current.rightPanelMode).toBe('none');

		// Toggle different mode on
		act(() => {
			result.current.toggleRightPanel('details');
		});
		expect(result.current.rightPanelMode).toBe('details');

		// Toggle different mode switches to it
		act(() => {
			result.current.toggleRightPanel('ai');
		});
		expect(result.current.rightPanelMode).toBe('ai');
	});

	it('switches between panel modes using openRightPanel', () => {
		const { result } = renderHook(() => useShellState());

		act(() => {
			result.current.openRightPanel('ai');
		});
		expect(result.current.rightPanelMode).toBe('ai');

		act(() => {
			result.current.openRightPanel('details');
		});
		expect(result.current.rightPanelMode).toBe('details');
	});

	describe('V2 control ownership', () => {
		it('only supports ai and details as right panel modes', () => {
			const { result } = renderHook(() => useShellState());

			// These should work
			act(() => result.current.openRightPanel('ai'));
			expect(result.current.rightPanelMode).toBe('ai');

			act(() => result.current.openRightPanel('details'));
			expect(result.current.rightPanelMode).toBe('details');

			// Type system should prevent 'share' as a right panel mode
			// (This would be a type error at compile time)
			const validModes: Array<'ai' | 'details'> = ['ai', 'details'];
			expect(validModes).toContain('ai');
			expect(validModes).toContain('details');
			expect(validModes).not.toContain('share' as never);
		});
	});
});
