import type { OverlayType } from '../types/overlay';

export const OVERLAY_TYPES: readonly OverlayType[] = [
	'markdown',
	'newlex',
	'kanban',
	'web-embed',
] as const;

export const COLLAB_COLORS = [
	'#FF6B6B',
	'#4ECDC4',
	'#45B7D1',
	'#96CEB4',
	'#FFEAA7',
	'#DDA0DD',
	'#98D8C8',
	'#F7DC6F',
] as const;

export const CANVAS_DEFAULTS = {
	AUTO_SAVE_INTERVAL_MS: 5000,
	SCENE_THROTTLE_MS: 100,
	CURSOR_THROTTLE_MS: 50,
	MAX_CANVAS_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
	OVERLAY_HOVER_PROMOTE_MS: 3000,
	DRAG_THRESHOLD_PX: 1,
} as const;
