import { describe, expect, it } from 'vitest';
import {
	HEAVY_OVERLAY_TYPES,
	LIGHT_OVERLAY_TYPES,
	getOverlayTypeIconName,
	getOverlayTypeLabel,
	isHeavyOverlayType,
	isLightOverlayType,
} from './resource-type-utils';

describe('resource-type-utils', () => {
	describe('isHeavyOverlayType', () => {
		it('returns true for kanban type', () => {
			expect(isHeavyOverlayType('kanban')).toBe(true);
		});

		it('returns true for newlex type', () => {
			expect(isHeavyOverlayType('newlex')).toBe(true);
		});

		it('returns false for markdown type', () => {
			expect(isHeavyOverlayType('markdown')).toBe(false);
		});

		it('returns false for web-embed type', () => {
			expect(isHeavyOverlayType('web-embed')).toBe(false);
		});

		it('returns true for prototype type', () => {
			expect(isHeavyOverlayType('prototype')).toBe(true);
		});

		it('returns false for unknown type', () => {
			expect(isHeavyOverlayType('unknown')).toBe(false);
		});

		it('returns false for non-string values', () => {
			expect(isHeavyOverlayType(null)).toBe(false);
			expect(isHeavyOverlayType(undefined)).toBe(false);
			expect(isHeavyOverlayType(123)).toBe(false);
			expect(isHeavyOverlayType({})).toBe(false);
		});
	});

	describe('isLightOverlayType', () => {
		it('returns true for markdown type', () => {
			expect(isLightOverlayType('markdown')).toBe(true);
		});

		it('returns true for web-embed type', () => {
			expect(isLightOverlayType('web-embed')).toBe(true);
		});

		it('returns false for kanban type', () => {
			expect(isLightOverlayType('kanban')).toBe(false);
		});

		it('returns false for newlex type', () => {
			expect(isLightOverlayType('newlex')).toBe(false);
		});

		it('returns false for prototype type', () => {
			expect(isLightOverlayType('prototype')).toBe(false);
		});

		it('returns false for unknown type', () => {
			expect(isLightOverlayType('unknown')).toBe(false);
		});

		it('returns false for non-string values', () => {
			expect(isLightOverlayType(null)).toBe(false);
			expect(isLightOverlayType(undefined)).toBe(false);
			expect(isLightOverlayType(123)).toBe(false);
		});
	});

	describe('getOverlayTypeLabel', () => {
		it('returns correct labels for all overlay types', () => {
			expect(getOverlayTypeLabel('kanban')).toBe('Kanban Board');
			expect(getOverlayTypeLabel('newlex')).toBe('Document');
			expect(getOverlayTypeLabel('markdown')).toBe('Note');
			expect(getOverlayTypeLabel('web-embed')).toBe('Web Embed');
		});

		it('returns Unknown for unexpected types', () => {
			expect(getOverlayTypeLabel('unknown' as never)).toBe('Unknown');
		});
	});

	describe('getOverlayTypeIconName', () => {
		it('returns correct icon names for all overlay types', () => {
			expect(getOverlayTypeIconName('kanban')).toBe('KanbanIcon');
			expect(getOverlayTypeIconName('newlex')).toBe('DocumentIcon');
			expect(getOverlayTypeIconName('markdown')).toBe('NoteIcon');
			expect(getOverlayTypeIconName('web-embed')).toBe('GlobeIcon');
		});

		it('returns FileIcon for unexpected types', () => {
			expect(getOverlayTypeIconName('unknown' as never)).toBe('FileIcon');
		});
	});

	describe('HEAVY_OVERLAY_TYPES', () => {
		it('contains kanban, newlex, and prototype', () => {
			expect(HEAVY_OVERLAY_TYPES).toContain('kanban');
			expect(HEAVY_OVERLAY_TYPES).toContain('newlex');
			expect(HEAVY_OVERLAY_TYPES).toContain('prototype');
			expect(HEAVY_OVERLAY_TYPES).not.toContain('markdown');
			expect(HEAVY_OVERLAY_TYPES).not.toContain('web-embed');
			expect(HEAVY_OVERLAY_TYPES).toHaveLength(3);
		});
	});

	describe('LIGHT_OVERLAY_TYPES', () => {
		it('contains only markdown and web-embed', () => {
			expect(LIGHT_OVERLAY_TYPES).toContain('markdown');
			expect(LIGHT_OVERLAY_TYPES).toContain('web-embed');
			expect(LIGHT_OVERLAY_TYPES).not.toContain('kanban');
			expect(LIGHT_OVERLAY_TYPES).not.toContain('newlex');
			expect(LIGHT_OVERLAY_TYPES).toHaveLength(2);
		});
	});
});
