import { FONT_FAMILY } from '@excalidraw/excalidraw';
import type { CSSProperties } from 'react';

type FillStyle = 'solid' | 'hachure' | 'cross-hatch';
type StrokeStyle = 'solid' | 'dashed' | 'dotted';

interface SurfaceStyleInput {
	backgroundColor?: string;
	strokeColor?: string;
	strokeWidth?: number;
	strokeStyle?: StrokeStyle;
	fillStyle?: FillStyle;
	opacity?: number;
	includeStroke?: boolean;
}

const DEFAULT_BG = '#ffffff';
const DEFAULT_STROKE = '#000000';
const DEFAULT_PROPORTIONAL_RADIUS = 0.25;
const DEFAULT_ADAPTIVE_RADIUS = 32;

export const EXCALIDRAW_FONT_OPTIONS = [
	{ id: 'excalifont', label: 'Excalifont', family: FONT_FAMILY.Excalifont },
	{ id: 'comic-shanns', label: 'Comic Shanns', family: FONT_FAMILY['Comic Shanns'] },
	{ id: 'lilita-one', label: 'Lilita One', family: FONT_FAMILY['Lilita One'] },
	{ id: 'nunito', label: 'Nunito', family: FONT_FAMILY.Nunito },
] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function parseHex(hex: string): { r: number; g: number; b: number } | null {
	const normalized = hex.trim();
	if (!normalized.startsWith('#')) return null;
	if (normalized.length === 4) {
		const r = Number.parseInt(normalized[1] + normalized[1], 16);
		const g = Number.parseInt(normalized[2] + normalized[2], 16);
		const b = Number.parseInt(normalized[3] + normalized[3], 16);
		return { r, g, b };
	}
	if (normalized.length === 7) {
		const r = Number.parseInt(normalized.slice(1, 3), 16);
		const g = Number.parseInt(normalized.slice(3, 5), 16);
		const b = Number.parseInt(normalized.slice(5, 7), 16);
		return { r, g, b };
	}
	return null;
}

function parseRgb(input: string): { r: number; g: number; b: number; a?: number } | null {
	const match = input
		.trim()
		.match(/^rgba?\(\s*([.\d]+)\s*,\s*([.\d]+)\s*,\s*([.\d]+)\s*(?:,\s*([.\d]+)\s*)?\)$/i);
	if (!match) return null;
	const r = clamp(Number(match[1]), 0, 255);
	const g = clamp(Number(match[2]), 0, 255);
	const b = clamp(Number(match[3]), 0, 255);
	const a = match[4] === undefined ? undefined : clamp(Number(match[4]), 0, 1);
	return { r, g, b, a };
}

export function applyColorOpacity(color: string | undefined, alpha: number): string {
	if (!color || color === 'transparent') return 'transparent';
	const normalizedAlpha = clamp(alpha, 0, 1);
	const hex = parseHex(color);
	if (hex) {
		return `rgba(${hex.r}, ${hex.g}, ${hex.b}, ${normalizedAlpha})`;
	}
	const rgb = parseRgb(color);
	if (rgb) {
		const nextAlpha = rgb.a === undefined ? normalizedAlpha : clamp(rgb.a * normalizedAlpha, 0, 1);
		return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${nextAlpha})`;
	}
	return color;
}

export function getExcalidrawSurfaceStyle({
	backgroundColor = DEFAULT_BG,
	strokeColor = DEFAULT_STROKE,
	strokeWidth = 1,
	strokeStyle = 'solid',
	fillStyle = 'solid',
	opacity = 100,
	includeStroke = true,
}: SurfaceStyleInput): CSSProperties {
	const alpha = clamp(opacity / 100, 0, 1);
	const fillColor = applyColorOpacity(backgroundColor, alpha);
	const borderColor = applyColorOpacity(strokeColor, alpha);
	const normalizedStrokeWidth = Math.max(0, strokeWidth);
	const patternedBaseColor = applyColorOpacity(backgroundColor, Math.max(alpha * 0.16, 0.08));
	const hatchLineWidth = clamp(1 + normalizedStrokeWidth * 0.18, 1, 3);
	const hatchGap = clamp(10 + normalizedStrokeWidth * 0.8, 8, 18);

	const style: CSSProperties = {
		backgroundColor: 'transparent',
		backgroundImage: 'none',
		border:
			includeStroke && normalizedStrokeWidth > 0 && borderColor !== 'transparent'
				? `${normalizedStrokeWidth}px ${strokeStyle} ${borderColor}`
				: 'none',
	};

	if (fillColor === 'transparent') return style;

	if (fillStyle === 'hachure') {
		style.backgroundColor = patternedBaseColor;
		style.backgroundImage = `repeating-linear-gradient(45deg, ${fillColor} 0 ${hatchLineWidth}px, ${patternedBaseColor} ${hatchLineWidth}px ${hatchGap}px)`;
		return style;
	}

	if (fillStyle === 'cross-hatch') {
		style.backgroundColor = patternedBaseColor;
		style.backgroundImage = [
			`repeating-linear-gradient(45deg, ${fillColor} 0 ${hatchLineWidth}px, transparent ${hatchLineWidth}px ${hatchGap}px)`,
			`repeating-linear-gradient(-45deg, ${fillColor} 0 ${hatchLineWidth}px, transparent ${hatchLineWidth}px ${hatchGap}px)`,
		].join(', ');
		return style;
	}

	style.backgroundColor = fillColor;
	return style;
}

export function getExcalidrawFontFamily(fontFamily?: number): string | undefined {
	switch (fontFamily) {
		case FONT_FAMILY.Virgil:
			return 'Virgil, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
		case FONT_FAMILY.Helvetica:
			return 'Helvetica, Arial, "Segoe UI Emoji", sans-serif';
		case FONT_FAMILY.Cascadia:
			return 'Cascadia, "Cascadia Code", Menlo, monospace';
		case FONT_FAMILY.Excalifont:
			return 'Excalifont, Xiaolai, "Segoe UI Emoji", sans-serif';
		case FONT_FAMILY.Nunito:
			return 'Nunito, "Segoe UI Emoji", sans-serif';
		case FONT_FAMILY['Lilita One']:
			return '"Lilita One", "Segoe UI Emoji", sans-serif';
		case FONT_FAMILY['Comic Shanns']:
			return '"Comic Shanns", "Segoe UI Emoji", cursive';
		case FONT_FAMILY['Liberation Sans']:
			return '"Liberation Sans", Arial, "Segoe UI Emoji", sans-serif';
		default:
			return undefined;
	}
}

export function getExcalidrawFontFamilyById(fontId?: string): string | undefined {
	const option = EXCALIDRAW_FONT_OPTIONS.find((candidate) => candidate.id === fontId);
	return option ? getExcalidrawFontFamily(option.family) : undefined;
}

export function getExcalidrawCornerRadius(
	width: number,
	height: number,
	roundness?: { type: number; value?: number } | null,
): number {
	if (!roundness) return 0;
	const shortestSide = Math.min(Math.abs(width), Math.abs(height));
	if (shortestSide <= 0) return 0;

	if (roundness.type === 1 || roundness.type === 2) {
		return shortestSide * DEFAULT_PROPORTIONAL_RADIUS;
	}

	if (roundness.type === 3) {
		const fixedRadius = roundness.value ?? DEFAULT_ADAPTIVE_RADIUS;
		const cutoff = fixedRadius / DEFAULT_PROPORTIONAL_RADIUS;
		if (shortestSide <= cutoff) {
			return shortestSide * DEFAULT_PROPORTIONAL_RADIUS;
		}
		return fixedRadius;
	}

	return 0;
}
