import type { MarkdownNoteSettings } from '@ai-canvas/shared/types';
import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { markdownUrlTransform } from './markdown-media';
import { createMarkdownComponents } from './markdown-renderer-components';
import { normalizeDisplayMath } from './markdown-renderer-utils';
import 'katex/dist/katex.min.css';

// ===== Constants =====
const REMARK_PLUGINS = [remarkMath, remarkGfm];
const REHYPE_PLUGINS = [rehypeRaw, rehypeKatex];

// ===== Types =====
export interface MarkdownRendererProps {
	content: string;
	images?: Record<string, string>;
	settings: MarkdownNoteSettings;
	onCheckboxToggle?: (lineIndex: number) => void;
	className?: string;
}

// ===== Component =====
export const MarkdownRenderer = memo(function MarkdownRenderer({
	content,
	images,
	settings,
	onCheckboxToggle,
	className,
}: MarkdownRendererProps) {
	// Normalize content for multiline display math
	const normalizedContent = useMemo(() => normalizeDisplayMath(content), [content]);

	// Typography settings from user preferences
	const typographyStyle = useMemo(
		() => ({
			fontFamily: settings.font,
			fontSize: `${settings.fontSize}px`,
			lineHeight: settings.lineHeight,
		}),
		[settings.font, settings.fontSize, settings.lineHeight],
	);

	// Memoized markdown components to prevent unnecessary re-renders
	const components = useMemo(
		() =>
			createMarkdownComponents({
				images,
				settings,
				onCheckboxToggle,
			}),
		[images, settings, onCheckboxToggle],
	);

	return (
		<div
			className={className ? `${className} text-stone-700` : 'text-stone-700'}
			style={typographyStyle}
		>
			<ReactMarkdown
				remarkPlugins={REMARK_PLUGINS}
				rehypePlugins={REHYPE_PLUGINS}
				urlTransform={markdownUrlTransform}
				components={components}
			>
				{normalizedContent}
			</ReactMarkdown>
		</div>
	);
});

// ===== Re-exports for backward compatibility =====
export { normalizeDisplayMath } from './markdown-renderer-utils';
