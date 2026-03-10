import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import type { MarkdownNoteSettings } from '@ai-canvas/shared/types';
import { markdownUrlTransform, resolveMarkdownAssetSrc } from './markdown-media';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
	content: string;
	images?: Record<string, string>;
	settings: MarkdownNoteSettings;
	onCheckboxToggle?: (lineIndex: number) => void;
	className?: string;
}

const RENDERER_SURFACE = 'rounded-[10px] border border-stone-200';
const failedImageSrcCache = new Set<string>();

function getCheckboxLineIndex(node: { position?: { start?: { line?: number | null } | null } | null }): number {
	const lineNumber = node.position?.start?.line;
	if (typeof lineNumber !== 'number' || Number.isNaN(lineNumber)) return -1;
	return Math.max(0, lineNumber - 1);
}

export function normalizeDisplayMath(content: string) {
	const lines = content.split('\n');
	const normalized: string[] = [];
	let insideBlock = false;

	for (const line of lines) {
		const trimmed = line.trim();

		if (!insideBlock) {
			if (trimmed.startsWith('$$') && trimmed !== '$$') {
				const withoutOpening = trimmed.slice(2).trim();
				if (withoutOpening.endsWith('$$')) {
					normalized.push(line);
					continue;
				}

				insideBlock = true;
				normalized.push('$$');
				if (withoutOpening.length > 0) {
					normalized.push(withoutOpening);
				}
				continue;
			}

			normalized.push(line);
			continue;
		}

		if (trimmed.endsWith('$$') && trimmed !== '$$') {
			const withoutClosing = trimmed.slice(0, -2).trim();
			if (withoutClosing.length > 0) {
				normalized.push(withoutClosing);
			}
			normalized.push('$$');
			insideBlock = false;
			continue;
		}

		normalized.push(line);
	}

	return normalized.join('\n');
}

interface MarkdownImageProps {
	src: string;
	alt?: string;
	width?: number | string;
	height?: number | string;
	inlineSized: boolean;
	props?: Record<string, unknown>;
}

function MarkdownImage({ src, alt, width, height, inlineSized, props }: MarkdownImageProps) {
	const [failed, setFailed] = useState(() => failedImageSrcCache.has(src));

	useEffect(() => {
		setFailed(failedImageSrcCache.has(src));
	}, [src]);

	if (failed) {
		return (
			<span
				className={`inline-flex items-center rounded-[8px] border border-amber-200 bg-amber-50 px-2 py-1 text-[0.92em] text-amber-800 ${
					inlineSized ? 'my-0 inline-flex align-middle' : 'my-3'
				}`}
				title={src}
			>
				{alt || 'Image failed to load'}
			</span>
		);
	}

	return (
		<img
			src={src}
			alt={alt || 'Embedded image'}
			loading="lazy"
			width={width}
			height={height}
			className={inlineSized ? 'my-0 inline-block shrink-0 align-middle' : `my-3 block max-w-full ${RENDERER_SURFACE}`}
			onError={() => {
				failedImageSrcCache.add(src);
				setFailed(true);
			}}
			{...(props ?? {})}
		/>
	);
}

export function MarkdownRenderer({
	content,
	images,
	settings,
	onCheckboxToggle,
	className,
}: MarkdownRendererProps) {
	const normalizedContent = useMemo(() => normalizeDisplayMath(content), [content]);
	const typographyStyle = useMemo(
		() => ({
			fontFamily: settings.font,
			fontSize: `${settings.fontSize}px`,
			lineHeight: settings.lineHeight,
		}),
		[settings],
	);

	const components = useMemo(() => {
		return {
			pre: ({ children }: any) => (
				<pre
					className={`mb-4 overflow-x-auto ${RENDERER_SURFACE} bg-stone-100/90 px-4 py-3 text-[0.9em] text-stone-800`}
				>
					{children}
				</pre>
			),
			code: ({ inline, className, children, ...props }: any) => {
				const isInline = inline === true || (!className && typeof inline !== 'boolean');
				return isInline ? (
					<code
						className="rounded-[6px] border px-1.5 py-0.5 text-[0.92em] font-medium"
						style={{
							color: settings.inlineCodeColor,
							backgroundColor: 'rgba(148, 163, 184, 0.16)',
							borderColor: 'rgba(148, 163, 184, 0.3)',
						}}
						{...props}
					>
						{children}
					</code>
				) : (
					<code className={`font-medium text-stone-800 ${className ?? ''}`.trim()} {...props}>
						{children}
					</code>
				);
			},
			blockquote: ({ children }: any) => (
				<blockquote className="my-4 border-l-4 border-indigo-300 pl-4 italic text-stone-600">
					{children}
				</blockquote>
			),
			table: ({ children }: any) => (
				<div className="my-4 overflow-x-auto">
					<table
						className={`min-w-full border-collapse overflow-hidden text-stone-700 ${RENDERER_SURFACE} bg-white/80`}
					>
						{children}
					</table>
				</div>
			),
			th: ({ children }: any) => (
				<th className="border border-stone-200 bg-stone-100/80 px-3 py-2 text-left font-semibold text-stone-700">
					{children}
				</th>
			),
			td: ({ children }: any) => <td className="border border-stone-200 px-3 py-2 text-stone-700">{children}</td>,
			a: ({ href, children }: any) => (
				<a
					href={href}
					target="_blank"
					rel="noreferrer"
					className="text-indigo-600 underline decoration-indigo-300 underline-offset-2"
				>
					{children}
				</a>
			),
			img: ({ src, alt, width, height, ...props }: any) => {
				const resolvedSrc = resolveMarkdownAssetSrc(src, images);
				if (!resolvedSrc) return null;
				const inlineSized = width || height;
				return (
					<MarkdownImage
						src={resolvedSrc}
						alt={alt}
						width={width}
						height={height}
						inlineSized={Boolean(inlineSized)}
						props={props}
					/>
				);
			},
			input: ({ type, checked, node }: any) => {
				if (type !== 'checkbox') return <input type={type} checked={checked} readOnly />;
				const lineIndex = getCheckboxLineIndex(node);
				return (
					<input
						type="checkbox"
						checked={Boolean(checked)}
						readOnly={!onCheckboxToggle}
						onClick={(event) => event.stopPropagation()}
						onChange={() => {
							if (lineIndex >= 0) onCheckboxToggle?.(lineIndex);
						}}
						className="mr-2 h-4 w-4 accent-indigo-500"
					/>
				);
			},
			p: ({ children }: any) => <p className="mb-3 whitespace-break-spaces text-stone-700">{children}</p>,
			h1: ({ children }: any) => (
				<h1 className="mb-3 flex items-center gap-3 text-3xl font-bold text-stone-950">{children}</h1>
			),
			h2: ({ children }: any) => <h2 className="mb-3 mt-5 text-2xl font-semibold text-stone-900">{children}</h2>,
			h3: ({ children }: any) => <h3 className="mb-2 mt-4 text-xl font-semibold text-stone-900">{children}</h3>,
			ul: ({ children, className }: any) => (
				<ul
					className={
						className?.includes('contains-task-list')
							? 'mb-3 space-y-2 pl-0 text-stone-700'
							: 'mb-3 list-disc pl-6 text-stone-700'
					}
				>
					{children}
				</ul>
			),
			ol: ({ children }: any) => <ol className="mb-3 list-decimal pl-6 text-stone-700">{children}</ol>,
			li: ({ children, className }: any) => (
				<li
					className={
						className?.includes('task-list-item')
							? 'flex list-none items-center gap-2 whitespace-break-spaces text-stone-700'
							: 'mb-1 whitespace-break-spaces text-stone-700'
					}
				>
					{children}
				</li>
			),
			hr: () => <hr className="my-5 border-stone-200" />,
		};
	}, [images, onCheckboxToggle, settings.inlineCodeColor]);

	return (
		<div className={className ? `${className} text-stone-700` : 'text-stone-700'} style={typographyStyle}>
			<ReactMarkdown
				remarkPlugins={[remarkMath, remarkGfm]}
				rehypePlugins={[rehypeRaw, rehypeKatex]}
				urlTransform={markdownUrlTransform}
				components={components as any}
			>
				{normalizedContent}
			</ReactMarkdown>
		</div>
	);
}
