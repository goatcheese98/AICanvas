import { useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { AssistantArtifact, AssistantMessage, GenerationMode } from '@ai-canvas/shared/types';
import { api, getRequiredAuthHeaders } from '@/lib/api';
import { useAppStore } from '@/stores/store';
import {
	createOverlayElementDraft,
	getViewportSceneCenter,
} from '@/components/canvas/element-factories';
import { buildKanbanFromArtifact, buildMarkdownArtifactContent } from './assistant-artifacts';

const generationModes: Array<{ value: GenerationMode; label: string }> = [
	{ value: 'chat', label: 'Chat' },
	{ value: 'mermaid', label: 'Mermaid' },
	{ value: 'd2', label: 'D2' },
	{ value: 'kanban', label: 'Kanban' },
	{ value: 'image', label: 'Image' },
	{ value: 'sketch', label: 'Sketch' },
];

const PANEL_BUTTON =
	'inline-flex h-9 items-center justify-center rounded-[8px] border px-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors';
const PANEL_BUTTON_IDLE =
	'border-stone-300 bg-white text-stone-700 hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]';
const PANEL_BUTTON_ACTIVE = 'border-[#d7dafd] bg-[#eef0ff] text-[#4d55cc]';

let convertToExcalidrawElementsLoader: Promise<
	typeof import('@excalidraw/excalidraw')['convertToExcalidrawElements']
> | null = null;

async function getConvertToExcalidrawElements() {
	if (!convertToExcalidrawElementsLoader) {
		convertToExcalidrawElementsLoader = import('@excalidraw/excalidraw').then(
			(module) => module.convertToExcalidrawElements,
		);
	}
	return convertToExcalidrawElementsLoader;
}

function ArtifactCard({
	artifact,
	onInsert,
}: {
	artifact: AssistantArtifact;
	onInsert?: (artifact: AssistantArtifact) => void;
}) {
	switch (artifact.type) {
		case 'mermaid':
		case 'd2':
			return (
				<div className="rounded-[10px] border border-stone-200 bg-stone-50 p-3">
					<div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
						{artifact.type}
					</div>
					<pre className="overflow-auto whitespace-pre-wrap text-xs text-stone-800">{artifact.content}</pre>
					{onInsert && (
						<button
							type="button"
							onClick={() => onInsert(artifact)}
							className={`mt-3 ${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
						>
							Insert On Canvas
						</button>
					)}
				</div>
			);
		case 'kanban-ops':
			return (
				<div className="rounded-[10px] border border-indigo-200 bg-indigo-50 p-3">
					<div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-600">
						Kanban Ops
					</div>
					<pre className="overflow-auto whitespace-pre-wrap text-xs text-indigo-950">{artifact.content}</pre>
					{onInsert && (
						<button
							type="button"
							onClick={() => onInsert(artifact)}
							className="mt-3 inline-flex h-9 items-center justify-center rounded-[8px] border border-indigo-300 bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-700 transition-colors hover:border-indigo-400 hover:bg-indigo-100"
						>
							Insert On Canvas
						</button>
					)}
				</div>
			);
		case 'image':
			return (
				<div className="rounded-[10px] border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
					Image artifact placeholder: {artifact.content}
				</div>
			);
	}
}

function MessageCard({
	message,
	onInsertArtifact,
}: {
	message: AssistantMessage;
	onInsertArtifact?: (artifact: AssistantArtifact) => void;
}) {
	const isUser = message.role === 'user';

	return (
		<div
			className={`rounded-[10px] px-4 py-3 shadow-sm ${
				isUser ? 'ml-8 bg-stone-900 text-white' : 'mr-8 border border-stone-200 bg-white text-stone-900'
			}`}
		>
			<div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
				<span>{isUser ? 'You' : message.generationMode ?? 'Assistant'}</span>
				<span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
			</div>
			<div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
			{message.artifacts && message.artifacts.length > 0 && (
				<div className="mt-3 space-y-3">
					{message.artifacts.map((artifact, index) => (
						<ArtifactCard
							key={`${message.id}-${artifact.type}-${index}`}
							artifact={artifact}
							onInsert={onInsertArtifact}
						/>
					))}
				</div>
			)}
		</div>
	);
}

export function AIChatPanel() {
	const { getToken, isSignedIn } = useAuth();
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const messages = useAppStore((s) => s.messages);
	const isChatLoading = useAppStore((s) => s.isChatLoading);
	const chatError = useAppStore((s) => s.chatError);
	const contextMode = useAppStore((s) => s.contextMode);
	const generationMode = useAppStore((s) => s.generationMode);
	const addMessage = useAppStore((s) => s.addMessage);
	const clearMessages = useAppStore((s) => s.clearMessages);
	const setIsChatLoading = useAppStore((s) => s.setIsChatLoading);
	const setChatError = useAppStore((s) => s.setChatError);
	const setContextMode = useAppStore((s) => s.setContextMode);
	const setGenerationMode = useAppStore((s) => s.setGenerationMode);
	const [input, setInput] = useState('');

	const disabled = useMemo(() => !input.trim() || isChatLoading, [input, isChatLoading]);

	const insertArtifactOnCanvas = async (artifact: AssistantArtifact) => {
		if (!excalidrawApi) {
			setChatError('Canvas is not ready yet.');
			return;
		}

		const convertToExcalidrawElements = await getConvertToExcalidrawElements();
		const sceneCenter = getViewportSceneCenter(excalidrawApi.getAppState());
		const currentElements = excalidrawApi.getSceneElements();

		switch (artifact.type) {
			case 'kanban-ops': {
				const draft = createOverlayElementDraft(
					'kanban',
					sceneCenter,
					buildKanbanFromArtifact(artifact) as unknown as Record<string, unknown>,
				);
				const converted = convertToExcalidrawElements([draft as never]);
				excalidrawApi.updateScene({ elements: [...currentElements, ...converted] });
				break;
			}
			case 'mermaid':
			case 'd2': {
				const draft = createOverlayElementDraft('markdown', sceneCenter, {
					content: buildMarkdownArtifactContent(artifact),
				});
				const converted = convertToExcalidrawElements([draft as never]);
				excalidrawApi.updateScene({ elements: [...currentElements, ...converted] });
				break;
			}
			default:
				setChatError('This artifact type is not insertable yet.');
		}
	};

	const sendMessage = async () => {
		const text = input.trim();
		if (!text || isChatLoading) return;

		setChatError(null);
		setIsChatLoading(true);

		const userMessage: AssistantMessage = {
			id: crypto.randomUUID(),
			role: 'user',
			content: text,
			generationMode,
			createdAt: new Date().toISOString(),
		};
		addMessage(userMessage);
		setInput('');

		try {
			if (!isSignedIn) {
				throw new Error('Sign in is required before using the assistant.');
			}
			const headers = await getRequiredAuthHeaders(getToken);

			const response = await api.api.assistant.chat.$post(
				{
					json: {
						message: text,
						contextMode,
						generationMode,
					},
				},
				{ headers },
			);

			if (!response.ok) {
				const body = await response.text();
				throw new Error(body || `Assistant request failed with status ${response.status}`);
			}

			const assistantMessage = await response.json();
			addMessage(assistantMessage);
		} catch (error) {
			setChatError(error instanceof Error ? error.message : 'Assistant request failed');
		} finally {
			setIsChatLoading(false);
		}
	};

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] border border-stone-200 bg-stone-50 shadow-xl">
			<div className="border-b border-stone-200 bg-white px-4 py-3">
				<div className="flex items-center justify-between gap-2">
					<div>
						<div className="text-sm font-semibold text-stone-900">AI Assistant</div>
						<div className="text-xs text-stone-500">Chat, Mermaid, D2, and Kanban drafts</div>
					</div>
					<button
						type="button"
						onClick={clearMessages}
						className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
					>
						Clear
					</button>
				</div>
				<div className="mt-3 flex gap-2">
					<select
						value={generationMode}
						onChange={(event) => setGenerationMode(event.target.value as GenerationMode)}
						className={`h-9 rounded-[8px] border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700 ${PANEL_BUTTON_IDLE}`}
					>
						{generationModes.map((mode) => (
							<option key={mode.value} value={mode.value}>
								{mode.label}
							</option>
						))}
					</select>
					<select
						value={contextMode}
						onChange={(event) => setContextMode(event.target.value as 'all' | 'selected')}
						className={`h-9 rounded-[8px] border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700 ${PANEL_BUTTON_IDLE}`}
					>
						<option value="all">Whole canvas</option>
						<option value="selected">Selected only</option>
					</select>
				</div>
			</div>

			<div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-4">
				{messages.length === 0 ? (
					<div className="rounded-[10px] border border-dashed border-stone-300 bg-white/70 p-4 text-sm text-stone-500">
						Start with a prompt like “map the auth flow”, “turn this into kanban tasks”, or “summarize the selected elements”.
					</div>
				) : (
					messages.map((message) => (
						<MessageCard
							key={message.id}
							message={message}
							onInsertArtifact={insertArtifactOnCanvas}
						/>
					))
				)}
				{isChatLoading && (
					<div className="mr-8 rounded-[10px] border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">
						Thinking...
					</div>
				)}
			</div>

			<div className="border-t border-stone-200 bg-white px-4 py-3">
				{chatError && (
					<div className="mb-3 rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
						{chatError}
					</div>
				)}
				<textarea
					value={input}
					onChange={(event) => setInput(event.target.value)}
					onKeyDown={(event) => {
						if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
							event.preventDefault();
							void sendMessage();
						}
					}}
					className="min-h-24 w-full resize-none rounded-[10px] border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none focus:border-[#d7dafd] focus:bg-[#f9f8ff]"
					placeholder="Ask the assistant to explain, diagram, or transform this canvas..."
				/>
				<div className="mt-3 flex items-center justify-between gap-3">
					<div className="text-[11px] text-stone-500">Cmd/Ctrl+Enter to send</div>
					<button
						type="button"
						disabled={disabled}
						onClick={() => void sendMessage()}
						className={`${PANEL_BUTTON} ${disabled ? 'opacity-50' : PANEL_BUTTON_ACTIVE} bg-[#eef0ff] px-4 disabled:cursor-not-allowed`}
					>
						Send
					</button>
				</div>
			</div>
		</div>
	);
}
