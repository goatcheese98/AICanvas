import type { AssistantArtifact, AssistantMessage, CanvasElement } from '@ai-canvas/shared/types';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArtifactCard } from './AIChatArtifactCard';
import { CodeSnippet, CopyButton } from './AIChatArtifactPrimitives';
import { PANEL_BUTTON, PANEL_BUTTON_IDLE } from './ai-chat-constants';
import {
	buildArtifactKey,
	canInsertMessageAsMarkdown,
	canInsertMessageAsSvg,
} from './ai-chat-helpers';
import type {
	AssistantInsertionState,
	AssistantPatchApplyOptions,
	AssistantPatchApplyState,
	DiagramInsertInput,
	MarkdownPatchReviewState,
} from './ai-chat-types';
import { filterVisibleArtifacts } from './assistant-artifacts';

export function MessageCard({
	message,
	elements,
	onInsertArtifact,
	onVectorizeArtifact,
	insertionStates,
	onUndoInsertedArtifact,
	onInsertMarkdown,
	onInsertSvg,
	onInsertRenderedDiagram,
	patchStates,
	markdownPatchReviewStates,
	onChangeMarkdownAcceptedHunks,
	onApplyPatch,
	onUndoPatch,
	onReapplyPatch,
	headerAccessory,
	headerDetails,
}: {
	message: AssistantMessage;
	elements?: readonly CanvasElement[];
	onInsertArtifact?: (artifactKey: string, artifact: AssistantArtifact) => void;
	onVectorizeArtifact?: (artifactKey: string, artifact: AssistantArtifact) => void;
	insertionStates?: Record<string, AssistantInsertionState>;
	onUndoInsertedArtifact?: (artifactKey: string) => void;
	onInsertMarkdown?: (message: AssistantMessage) => void;
	onInsertSvg?: (message: AssistantMessage) => void;
	onInsertRenderedDiagram?: (artifactKey: string, input: DiagramInsertInput) => void;
	patchStates?: Record<string, AssistantPatchApplyState>;
	markdownPatchReviewStates?: Record<string, MarkdownPatchReviewState>;
	onChangeMarkdownAcceptedHunks?: (artifactKey: string, acceptedHunkIds: string[]) => void;
	onApplyPatch?: (
		artifactKey: string,
		artifact: AssistantArtifact,
		options?: AssistantPatchApplyOptions,
	) => void;
	onUndoPatch?: (artifactKey: string, artifact: AssistantArtifact) => void;
	onReapplyPatch?: (
		artifactKey: string,
		artifact: AssistantArtifact,
		options?: AssistantPatchApplyOptions,
	) => void;
	headerAccessory?: ReactNode;
	headerDetails?: ReactNode;
}) {
	const isUser = message.role === 'user';
	const visibleArtifacts = filterVisibleArtifacts(message.artifacts ?? []);
	const messageActions =
		!isUser &&
		((canInsertMessageAsSvg(message) && onInsertSvg) ||
			(canInsertMessageAsMarkdown(message) && onInsertMarkdown)) ? (
			<div className="flex flex-wrap gap-2">
				{canInsertMessageAsSvg(message) && onInsertSvg ? (
					<button
						type="button"
						onClick={() => onInsertSvg(message)}
						className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
					>
						Insert Native Vector
					</button>
				) : null}
				{canInsertMessageAsMarkdown(message) && onInsertMarkdown ? (
					<button
						type="button"
						onClick={() => onInsertMarkdown(message)}
						className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
					>
						Insert As Markdown
					</button>
				) : null}
			</div>
		) : null;

	return (
		<div
			className={`max-w-[92%] rounded-[14px] px-3.5 py-2.5 shadow-sm ${
				isUser
					? 'ml-auto border border-[#d7dafd] bg-[#f3f1ff] text-[#4d55cc] shadow-none'
					: 'mr-auto border border-stone-200 bg-white text-stone-900 shadow-none'
			}`}
		>
			<div className="mb-1.5 flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] opacity-70">
				<span>{isUser ? 'You' : (message.generationMode ?? 'Assistant')}</span>
				<div className="flex items-center gap-2">
					<span>
						{new Date(message.createdAt).toLocaleTimeString([], {
							hour: '2-digit',
							minute: '2-digit',
						})}
					</span>
					{!isUser && headerAccessory ? headerAccessory : null}
					{!isUser ? (
						<CopyButton value={message.content} label="Copy" className="h-7 px-2 text-[9px]" />
					) : null}
				</div>
			</div>
			{!isUser && headerDetails ? <div className="mb-3">{headerDetails}</div> : null}
			{isUser ? (
				<div className="whitespace-pre-wrap text-[13px] leading-relaxed">{message.content}</div>
			) : (
				<div className="text-[13px] leading-relaxed">
					<ReactMarkdown
						remarkPlugins={[remarkGfm]}
						components={{
							p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
							strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
							em: ({ children }) => <em className="italic">{children}</em>,
							ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4">{children}</ul>,
							ol: ({ children }) => (
								<ol className="mb-2 list-decimal space-y-0.5 pl-4">{children}</ol>
							),
							li: ({ children }) => <li className="text-[13px]">{children}</li>,
							h1: ({ children }) => <h1 className="mb-2 text-[15px] font-semibold">{children}</h1>,
							h2: ({ children }) => (
								<h2 className="mb-1.5 text-[13px] font-semibold">{children}</h2>
							),
							h3: ({ children }) => <h3 className="mb-1 text-[13px] font-medium">{children}</h3>,
							code: ({ node, className, children, ...props }) => {
								const isBlock =
									(node?.position?.start.line ?? 0) !== (node?.position?.end.line ?? 0);
								if (!isBlock) {
									return (
										<code
											className="rounded bg-stone-100 px-1 py-0.5 text-[11px] font-mono"
											{...props}
										>
											{children}
										</code>
									);
								}

								const language = className?.replace(/^language-/, '') ?? 'Code';
								const code = String(children).replace(/\n$/, '');
								return <CodeSnippet code={code} language={language} />;
							},
							pre: ({ children }) => <div className="mb-2">{children}</div>,
							blockquote: ({ children }) => (
								<blockquote className="border-l-2 border-stone-300 pl-3 italic text-stone-600">
									{children}
								</blockquote>
							),
							a: ({ href, children }) => (
								<a
									href={href}
									className="text-[#4d55cc] underline"
									target="_blank"
									rel="noopener noreferrer"
								>
									{children}
								</a>
							),
						}}
					>
						{message.content}
					</ReactMarkdown>
				</div>
			)}
			{visibleArtifacts.length > 0 ? (
				<div className="mt-3 space-y-3">
					{visibleArtifacts.map((artifact, index) => {
						const artifactKey = buildArtifactKey(message.id, artifact, index);
						return (
							<ArtifactCard
								key={artifactKey}
								artifact={artifact}
								artifactKey={artifactKey}
								elements={elements}
								onInsertArtifact={onInsertArtifact}
								onVectorizeArtifact={onVectorizeArtifact}
								insertionState={insertionStates?.[artifactKey]}
								onUndoInsertedArtifact={onUndoInsertedArtifact}
								onInsertRenderedDiagram={onInsertRenderedDiagram}
								patchApplyState={patchStates?.[artifactKey]}
								markdownReviewState={markdownPatchReviewStates?.[artifactKey]}
								onChangeMarkdownAcceptedHunks={onChangeMarkdownAcceptedHunks}
								onApplyPatch={onApplyPatch}
								onUndoPatch={onUndoPatch}
								onReapplyPatch={onReapplyPatch}
								generationMode={message.generationMode}
								hasVectorCompanionArtifact={visibleArtifacts.some(
									(candidate) => candidate.type === 'image-vector',
								)}
							/>
						);
					})}
				</div>
			) : null}
			{messageActions ? <div className="mt-3">{messageActions}</div> : null}
		</div>
	);
}
