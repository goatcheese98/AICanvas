import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MarkdownOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

type MarkdownElement = ExcalidrawElement & {
	customData: MarkdownOverlayCustomData;
};

interface MarkdownNoteProps {
	element: MarkdownElement;
	isSelected: boolean;
	onChange: (
		elementId: string,
		content: string,
		images?: Record<string, string>,
		settings?: MarkdownOverlayCustomData['settings'],
	) => void;
	onEditingChange?: (isEditing: boolean) => void;
}

export function MarkdownNote({
	element,
	isSelected,
	onChange,
	onEditingChange,
}: MarkdownNoteProps) {
	const [content, setContent] = useState(element.customData.content);
	const [isEditing, setIsEditing] = useState(false);

	useEffect(() => {
		setContent(element.customData.content);
	}, [element.customData.content]);

	useEffect(() => {
		onEditingChange?.(isEditing);
		return () => onEditingChange?.(false);
	}, [isEditing, onEditingChange]);

	useEffect(() => {
		if (!isEditing) return;
		const timeout = window.setTimeout(() => {
			onChange(element.id, content, element.customData.images, element.customData.settings);
		}, 200);
		return () => window.clearTimeout(timeout);
	}, [content, element.customData.images, element.customData.settings, element.id, isEditing, onChange]);

	const frameStyle = useMemo(
		() => ({
			background: element.customData.settings?.background || '#fffefc',
			fontFamily: element.customData.settings?.font || 'Georgia, serif',
			fontSize: `${element.customData.settings?.fontSize ?? 15}px`,
			lineHeight: element.customData.settings?.lineHeight ?? 1.65,
		}),
		[element.customData.settings],
	);

	return (
		<div className="flex h-full flex-col overflow-hidden rounded-2xl border border-stone-300 bg-stone-50/95 shadow-lg">
			<div className="flex items-center justify-between border-b border-stone-200 bg-stone-100/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
				<span>Markdown</span>
				<div className="flex items-center gap-2">
					{isSelected && (
						<button
							type="button"
							className="rounded-full border border-stone-300 px-2 py-1 text-[10px] text-stone-700"
							onClick={() => setIsEditing((current) => !current)}
						>
							{isEditing ? 'Preview' : 'Edit'}
						</button>
					)}
				</div>
			</div>

			<div
				className="min-h-0 flex-1"
				style={frameStyle}
				onDoubleClick={() => {
					if (isSelected) setIsEditing(true);
				}}
			>
				{isEditing ? (
					<textarea
						value={content}
						onChange={(event) => setContent(event.target.value)}
						className="h-full w-full resize-none border-0 bg-transparent p-4 text-stone-900 outline-none"
						placeholder="Write markdown..."
					/>
				) : (
					<div className="markdown-body h-full overflow-auto p-4 text-stone-800">
						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							components={{
								h1: ({ ...props }) => <h1 className="mb-3 text-2xl font-bold text-stone-900" {...props} />,
								h2: ({ ...props }) => <h2 className="mb-2 mt-4 text-xl font-semibold text-stone-900" {...props} />,
								p: ({ ...props }) => <p className="mb-3 leading-relaxed" {...props} />,
								ul: ({ ...props }) => <ul className="mb-3 list-disc pl-6" {...props} />,
								ol: ({ ...props }) => <ol className="mb-3 list-decimal pl-6" {...props} />,
								code: ({ className, children, ...props }) => {
									const inline = !className;
									if (inline) {
										return (
											<code
												className="rounded bg-stone-200 px-1 py-0.5 text-[0.9em] text-stone-900"
												{...props}
											>
												{children}
											</code>
										);
									}

									return (
										<pre className="mb-3 overflow-auto rounded-xl bg-stone-900 p-3 text-stone-100">
											<code {...props}>{children}</code>
										</pre>
									);
								},
								blockquote: ({ ...props }) => (
									<blockquote className="mb-3 border-l-4 border-amber-500 pl-4 italic text-stone-600" {...props} />
								),
							}}
						>
							{content || '*Empty note*'}
						</ReactMarkdown>
					</div>
				)}
			</div>
		</div>
	);
}
