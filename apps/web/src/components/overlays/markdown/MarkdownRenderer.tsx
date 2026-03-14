import {
	useEffect,
	useMemo,
	useState,
	type CSSProperties,
	type JSX,
} from 'react';
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown';
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

type MarkdownComponentProps<Tag extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[Tag] &
	ExtraProps;
type MarkdownCodeComponentProps = MarkdownComponentProps<'code'> & {
	inline?: boolean;
};
type MarkdownImageElementProps = Omit<
	MarkdownComponentProps<'img'>,
	'alt' | 'children' | 'height' | 'src' | 'width'
>;

const RENDERER_SURFACE = 'border border-stone-200';
const failedImageSrcCache = new Set<string>();
const SURFACE_RADIUS = '0.7em';
const INLINE_RADIUS = '0.42em';
const BLOCK_SPACING = '0.95em';
const COMPACT_SPACING = '0.55em';
const CELL_PADDING = '0.7em 0.95em';
const CHECKBOX_SIZE = '1.05em';
const HEADING_STYLES = {
	h1: { fontSize: '2em', lineHeight: 1.1, gap: '0.5em', marginBottom: '0.5em' },
	h2: { fontSize: '1.6em', lineHeight: 1.18, marginTop: '1.2em', marginBottom: '0.55em' },
	h3: { fontSize: '1.35em', lineHeight: 1.24, marginTop: '1em', marginBottom: '0.45em' },
	h4: { fontSize: '1.15em', lineHeight: 1.3, marginTop: '0.95em', marginBottom: '0.4em' },
	h5: { fontSize: '1em', lineHeight: 1.38, marginTop: '0.9em', marginBottom: '0.35em' },
	h6: { fontSize: '0.92em', lineHeight: 1.45, marginTop: '0.9em', marginBottom: '0.35em' },
} as const satisfies Record<string, CSSProperties>;

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
	width?: JSX.IntrinsicElements['img']['width'];
	height?: JSX.IntrinsicElements['img']['height'];
	inlineSized: boolean;
	props?: MarkdownImageElementProps;
}

function MarkdownImage({ src, alt, width, height, inlineSized, props }: MarkdownImageProps) {
	const [failed, setFailed] = useState(() => failedImageSrcCache.has(src));

	useEffect(() => {
		setFailed(failedImageSrcCache.has(src));
	}, [src]);

	if (failed) {
		return (
			<span
				className={`inline-flex items-center border border-amber-200 bg-amber-50 text-[0.92em] text-amber-800 ${inlineSized ? 'my-0 inline-flex align-middle' : 'my-3'
					}`}
				style={{
					borderRadius: INLINE_RADIUS,
					padding: '0.16em 0.52em',
					marginTop: inlineSized ? 0 : BLOCK_SPACING,
					marginBottom: inlineSized ? 0 : BLOCK_SPACING,
				}}
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
			className={
				inlineSized
					? 'my-0 inline-block shrink-0 align-middle'
					: `block max-w-full ${RENDERER_SURFACE}`
			}
			style={
				inlineSized
					? undefined
					: {
						borderRadius: SURFACE_RADIUS,
						marginTop: BLOCK_SPACING,
						marginBottom: BLOCK_SPACING,
					}
			}
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
			pre: ({ children }: MarkdownComponentProps<'pre'>) => (
				<pre
					className={`overflow-x-auto ${RENDERER_SURFACE} bg-stone-100/90 text-[0.9em] text-stone-800`}
					style={{
						borderRadius: SURFACE_RADIUS,
						marginBottom: '1.15em',
						padding: '0.85em 1em',
					}}
				>
					{children}
				</pre>
			),
			code: ({ inline, className, children, node: _node, ...props }: MarkdownCodeComponentProps) => {
				const isInline = inline === true || (!className && typeof inline !== 'boolean');
				return isInline ? (
					<code
							className="border text-[0.92em] font-medium"
							style={{
								color: settings.inlineCodeColor,
							backgroundColor: 'rgba(148, 163, 184, 0.16)',
							borderColor: 'rgba(148, 163, 184, 0.3)',
							borderRadius: INLINE_RADIUS,
							padding: '0.16em 0.42em',
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
			blockquote: ({ children }: MarkdownComponentProps<'blockquote'>) => (
				<blockquote
					className="border-indigo-300 italic text-stone-600"
					style={{
						borderLeftWidth: '0.22em',
						margin: '1.05em 0',
						paddingLeft: '0.95em',
					}}
				>
					{children}
				</blockquote>
			),
			table: ({ children }: MarkdownComponentProps<'table'>) => (
				<div className="overflow-x-auto" style={{ margin: '1.05em 0' }}>
					<table
						className={`min-w-full border-collapse overflow-hidden text-stone-700 ${RENDERER_SURFACE} bg-white/80`}
						style={{ borderRadius: SURFACE_RADIUS }}
					>
						{children}
					</table>
				</div>
			),
			th: ({ children }: MarkdownComponentProps<'th'>) => (
				<th
					className="border border-stone-200 bg-stone-100/80 text-left font-semibold text-stone-700"
					style={{ padding: CELL_PADDING }}
				>
					{children}
				</th>
			),
			td: ({ children }: MarkdownComponentProps<'td'>) => (
				<td className="border border-stone-200 text-stone-700" style={{ padding: CELL_PADDING }}>
					{children}
				</td>
			),
			a: ({ href, children }: MarkdownComponentProps<'a'>) => (
				<a
					href={href}
					target="_blank"
					rel="noreferrer"
					className="text-indigo-600 underline decoration-indigo-300 underline-offset-2"
					style={{ textUnderlineOffset: '0.14em' }}
				>
					{children}
				</a>
			),
			img: ({ src, alt, width, height, node: _node, ...props }: MarkdownComponentProps<'img'>) => {
				const resolvedSrc = resolveMarkdownAssetSrc(src, images);
				if (!resolvedSrc) return null;
				const inlineSized = width !== undefined || height !== undefined;
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
			input: ({ type, checked, node }: MarkdownComponentProps<'input'>) => {
				if (type !== 'checkbox') return <input type={type} checked={checked} readOnly />;
				const lineIndex = node ? getCheckboxLineIndex(node) : -1;
				return (
					<input
							type="checkbox"
							checked={Boolean(checked)}
							readOnly={!onCheckboxToggle}
						onClick={(event) => event.stopPropagation()}
						onChange={() => {
							if (lineIndex >= 0) onCheckboxToggle?.(lineIndex);
						}}
						className="accent-indigo-500"
						style={{
							width: CHECKBOX_SIZE,
							height: CHECKBOX_SIZE,
								marginRight: COMPACT_SPACING,
								flexShrink: 0,
							}}
						/>
				);
			},
			p: ({ children, style }: MarkdownComponentProps<'p'>) => (
				<p
					className="whitespace-break-spaces text-stone-700"
					style={{
						marginTop: 'var(--markdown-paragraph-margin-top, 0)',
						marginBottom: 'var(--markdown-paragraph-margin-bottom, 0.85em)',
						...(style ?? {}),
					}}
				>
					{children}
				</p>
			),
			h1: ({ children }: MarkdownComponentProps<'h1'>) => (
				<h1 className="flex items-center font-bold text-stone-950" style={HEADING_STYLES.h1}>
					{children}
				</h1>
			),
			h2: ({ children }: MarkdownComponentProps<'h2'>) => (
				<h2 className="font-semibold text-stone-900" style={HEADING_STYLES.h2}>
					{children}
				</h2>
			),
			h3: ({ children }: MarkdownComponentProps<'h3'>) => (
				<h3 className="font-semibold text-stone-900" style={HEADING_STYLES.h3}>
					{children}
				</h3>
			),
			h4: ({ children }: MarkdownComponentProps<'h4'>) => (
				<h4 className="font-semibold text-stone-900" style={HEADING_STYLES.h4}>
					{children}
				</h4>
			),
			h5: ({ children }: MarkdownComponentProps<'h5'>) => (
				<h5 className="font-semibold text-stone-900" style={HEADING_STYLES.h5}>
					{children}
				</h5>
			),
			h6: ({ children }: MarkdownComponentProps<'h6'>) => (
				<h6 className="font-semibold uppercase tracking-[0.08em] text-stone-700" style={HEADING_STYLES.h6}>
					{children}
				</h6>
			),
			ul: ({ children, className }: MarkdownComponentProps<'ul'>) => (
				<ul
					className={
						className?.includes('contains-task-list')
							? 'pl-0 text-stone-700'
							: 'list-disc text-stone-700'
					}
					style={{
						marginTop: 0,
						marginBottom: '0.9em',
						paddingLeft: className?.includes('contains-task-list') ? 0 : '1.35em',
					}}
				>
					{children}
				</ul>
			),
			ol: ({ children }: MarkdownComponentProps<'ol'>) => (
				<ol
					className="list-decimal text-stone-700"
					style={{ marginTop: 0, marginBottom: '0.9em', paddingLeft: '1.35em' }}
				>
					{children}
				</ol>
			),
			li: ({ children, className }: MarkdownComponentProps<'li'>) => (
				<li
					className={
						className?.includes('task-list-item')
							? 'flex list-none items-center whitespace-break-spaces text-stone-700'
							: 'whitespace-break-spaces text-stone-700'
					}
					style={
						className?.includes('task-list-item')
							? ({
								gap: COMPACT_SPACING,
								marginBottom: '0.7em',
								'--markdown-paragraph-margin-top': 0,
								'--markdown-paragraph-margin-bottom': 0,
							} as CSSProperties)
							: ({
								marginBottom: '0.45em',
								'--markdown-paragraph-margin-top': 0,
								'--markdown-paragraph-margin-bottom': 0,
							} as CSSProperties)
					}
				>
					{children}
				</li>
				),
			hr: () => <hr className="border-stone-200" style={{ margin: '1.35em 0' }} />,
		} satisfies Components;
	}, [images, onCheckboxToggle, settings.inlineCodeColor]);

	return (
		<div className={className ? `${className} text-stone-700` : 'text-stone-700'} style={typographyStyle}>
			<ReactMarkdown
				remarkPlugins={[remarkMath, remarkGfm]}
				rehypePlugins={[rehypeRaw, rehypeKatex]}
				urlTransform={markdownUrlTransform}
				components={components}
			>
					{normalizedContent}
			</ReactMarkdown>
		</div>
	);
}
