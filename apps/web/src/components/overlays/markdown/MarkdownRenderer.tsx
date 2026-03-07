import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
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

function getCheckboxLineIndexes(content: string) {
	return content
		.split('\n')
		.map((line, index) => (/^\s*[-*+]\s\[(?: |x)\]\s/i.test(line) ? index : -1))
		.filter((index) => index >= 0);
}

export function MarkdownRenderer({
	content,
	images,
	settings,
	onCheckboxToggle,
	className,
}: MarkdownRendererProps) {
	const checkboxLineIndexes = useMemo(() => getCheckboxLineIndexes(content), [content]);
	const typographyStyle = useMemo(
		() => ({
			fontFamily: settings.font,
			fontSize: `${settings.fontSize}px`,
			lineHeight: settings.lineHeight,
		}),
		[settings],
	);

	const components = useMemo(() => {
		let checkboxIndex = 0;

		return {
			pre: ({ children }: any) => (
				<pre className={`mb-4 overflow-x-auto ${RENDERER_SURFACE} bg-stone-950 px-4 py-3 text-[0.9em] text-stone-100`}>
					{children}
				</pre>
			),
			code: ({ inline, children, ...props }: any) =>
				inline ? (
					<code
						className="rounded-[6px] bg-stone-900/10 px-1.5 py-0.5 text-[0.92em] text-stone-800"
						{...props}
					>
						{children}
					</code>
				) : (
					<code {...props}>{children}</code>
				),
			blockquote: ({ children }: any) => (
				<blockquote className="my-4 border-l-4 border-indigo-300 pl-4 italic text-stone-600">
					{children}
				</blockquote>
			),
			table: ({ children }: any) => (
				<div className="my-4 overflow-x-auto">
					<table className={`min-w-full border-collapse overflow-hidden ${RENDERER_SURFACE} bg-white/80`}>
						{children}
					</table>
				</div>
			),
			th: ({ children }: any) => (
				<th className="border border-stone-200 bg-stone-100/80 px-3 py-2 text-left font-semibold">
					{children}
				</th>
			),
			td: ({ children }: any) => <td className="border border-stone-200 px-3 py-2">{children}</td>,
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
			img: ({ src, alt }: any) => {
				const resolvedSrc = resolveMarkdownAssetSrc(src, images);
				if (!resolvedSrc) return null;
				return (
					<img
						src={resolvedSrc}
						alt={alt || 'Embedded image'}
						loading="lazy"
						className={`my-3 block max-w-full ${RENDERER_SURFACE}`}
					/>
				);
			},
			input: ({ type, checked }: any) => {
				if (type !== 'checkbox') return <input type={type} checked={checked} readOnly />;
				const lineIndex = checkboxLineIndexes[checkboxIndex] ?? -1;
				checkboxIndex += 1;
				return (
					<input
						type="checkbox"
						checked={Boolean(checked)}
						readOnly={!onCheckboxToggle}
						onChange={() => {
							if (lineIndex >= 0) onCheckboxToggle?.(lineIndex);
						}}
						className="mr-2 h-4 w-4 accent-indigo-500"
					/>
				);
			},
			p: ({ children }: any) => <p className="mb-3 whitespace-break-spaces text-stone-700">{children}</p>,
			h1: ({ children }: any) => <h1 className="mb-3 text-3xl font-bold text-stone-950">{children}</h1>,
			h2: ({ children }: any) => <h2 className="mb-3 mt-5 text-2xl font-semibold text-stone-900">{children}</h2>,
			h3: ({ children }: any) => <h3 className="mb-2 mt-4 text-xl font-semibold text-stone-900">{children}</h3>,
			ul: ({ children }: any) => <ul className="mb-3 list-disc pl-6">{children}</ul>,
			ol: ({ children }: any) => <ol className="mb-3 list-decimal pl-6">{children}</ol>,
			li: ({ children }: any) => <li className="mb-1 whitespace-break-spaces">{children}</li>,
			hr: () => <hr className="my-5 border-stone-200" />,
		};
	}, [checkboxLineIndexes, images, onCheckboxToggle]);

	return (
		<div className={className} style={typographyStyle}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkMath]}
				rehypePlugins={[rehypeKatex]}
				urlTransform={markdownUrlTransform}
				components={components as any}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
