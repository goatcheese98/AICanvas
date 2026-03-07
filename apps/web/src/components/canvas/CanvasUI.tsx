import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	type SetStateAction,
} from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from '@tanstack/react-router';
import type { OverlayType } from '@ai-canvas/shared/types';
import { useAppStore } from '@/stores/store';
import { AIChatPanel } from '@/components/ai-chat';
import { getCollaborationStatusCopy, type CollaborationSessionStatus } from '@/hooks/collaboration-utils';
import { buildOverlayInsertionScene } from './element-factories';

interface CanvasUIProps {
	canvasId: string;
	collaboration: {
		isCollaborating: boolean;
		collaborators: Map<string, { username?: string }>;
		roomLink: string | null;
		sessionError: string | null;
		sessionStatus: CollaborationSessionStatus;
		username: string;
		setUsername: (name: string) => void;
		startSession: () => Promise<void>;
		stopSession: () => void;
	};
}

const CHROME_BUTTON_BASE =
	'inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border px-3.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors shadow-sm';
const CHROME_BUTTON_IDLE =
	'border-stone-200 bg-white/96 text-stone-700 hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]';
const CHROME_BUTTON_ACTIVE = 'border-[#d7dafd] bg-[#eef0ff] text-[#4d55cc]';
const CHROME_BUTTON_SUBTLE =
	'border-stone-200 bg-stone-50/92 text-stone-600 hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]';
const CHROME_BUTTON_DANGER = 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100';

function PanelShell({
	title,
	description,
	onClose,
	children,
}: {
	title: string;
	description: string;
	onClose: () => void;
	children: ReactNode;
}) {
	return (
		<div className="overflow-hidden rounded-[12px] border border-stone-200 bg-white shadow-xl">
			<div className="flex items-start justify-between gap-3 border-b border-stone-200 px-4 py-3">
				<div>
					<div className="text-sm font-semibold text-stone-900">{title}</div>
					<div className="mt-1 max-w-[24rem] text-xs text-stone-500">{description}</div>
				</div>
				<button
					type="button"
					onClick={onClose}
					className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_SUBTLE} px-3 py-1.5`}
				>
					Close
				</button>
			</div>
			{children}
		</div>
	);
}

function PanelFrame({
	width,
	className,
	onResizeStart,
	children,
}: {
	width: number;
	className: string;
	onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
	children: ReactNode;
}) {
	return (
		<div className={className} style={{ width }}>
			<div
				className="absolute inset-y-8 -left-2 z-30 flex w-4 cursor-ew-resize items-center justify-center"
				onPointerDown={onResizeStart}
				aria-label="Resize panel"
			>
				<div className="h-16 w-1 rounded-[999px] bg-stone-200/90 shadow-sm" />
			</div>
			{children}
		</div>
	);
}

const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH = 420;
const MIN_CHAT_WIDTH = 300;
const MAX_CHAT_WIDTH = 460;

export function CanvasUI({ canvasId, collaboration }: CanvasUIProps) {
	const navigate = useNavigate();
	const { user } = useUser();
	const activePanel = useAppStore((s) => s.activePanel);
	const setActivePanel = useAppStore((s) => s.setActivePanel);
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const elements = useAppStore((s) => s.elements);
	const appState = useAppStore((s) => s.appState);
	const addToast = useAppStore((s) => s.addToast);
	const [isInsertMenuOpen, setIsInsertMenuOpen] = useState(false);
	const [sidePanelWidth, setSidePanelWidth] = useState(332);
	const [chatPanelWidth, setChatPanelWidth] = useState(352);
	const insertMenuRef = useRef<HTMLDivElement | null>(null);
	const initials = useMemo(() => {
		const name =
			user?.fullName ||
			user?.username ||
			user?.firstName ||
			user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
			'You';
		return name
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('') || 'Y';
	}, [user]);
	const profileName =
		user?.fullName ||
		user?.username ||
		user?.firstName ||
		user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
		'You';
	const profileEmail = user?.primaryEmailAddress?.emailAddress ?? 'Signed in';
	const collaboratorList = Array.from(collaboration.collaborators.values()).filter((collaborator) =>
		Boolean(collaborator.username),
	);
	const sessionCopy = getCollaborationStatusCopy(
		collaboration.sessionStatus,
		collaboratorList.length,
		collaboration.sessionError,
	);
	const statusDotClass =
		collaboration.sessionStatus === 'connected'
			? 'bg-emerald-500'
			: collaboration.sessionStatus === 'reconnecting'
				? 'bg-amber-500'
					: collaboration.sessionStatus === 'error'
						? 'bg-rose-500'
						: 'bg-stone-300';
	const overlayActions: Array<{ type: OverlayType; label: string; description: string }> = [
		{ type: 'markdown', label: 'Markdown', description: 'Note with formatting and images' },
		{ type: 'newlex', label: 'Rich Text', description: 'Lexical editor with comments' },
		{ type: 'kanban', label: 'Kanban', description: 'Board for planning work' },
		{ type: 'web-embed', label: 'Web Embed', description: 'Inline site or prototype' },
	];

	useEffect(() => {
		if (!isInsertMenuOpen) return;

		const handlePointerDown = (event: PointerEvent) => {
			if (!insertMenuRef.current?.contains(event.target as Node)) {
				setIsInsertMenuOpen(false);
			}
		};

		window.addEventListener('pointerdown', handlePointerDown);
		return () => window.removeEventListener('pointerdown', handlePointerDown);
	}, [isInsertMenuOpen]);

	useEffect(() => {
		const handleResize = () => {
			const maxSide = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, window.innerWidth - 48));
			const maxChat = Math.max(MIN_CHAT_WIDTH, Math.min(MAX_CHAT_WIDTH, window.innerWidth - 48));
			setSidePanelWidth((current) => Math.min(current, maxSide));
			setChatPanelWidth((current) => Math.min(current, maxChat));
		};

		handleResize();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	const startResize =
		useCallback(
			(setter: Dispatch<SetStateAction<number>>, min: number, max: number) =>
				(event: ReactPointerEvent<HTMLDivElement>) => {
					event.preventDefault();
					const startX = event.clientX;
					const currentWidth = (() => {
						let snapshot = min;
						setter((value) => {
							snapshot = value;
							return value;
						});
						return snapshot;
					})();

					const handleMove = (moveEvent: PointerEvent) => {
						const delta = moveEvent.clientX - startX;
						const viewportMax = Math.max(min, Math.min(max, window.innerWidth - 48));
						setter(Math.max(min, Math.min(viewportMax, currentWidth - delta)));
					};

					const handleUp = () => {
						window.removeEventListener('pointermove', handleMove);
						window.removeEventListener('pointerup', handleUp);
					};

					window.addEventListener('pointermove', handleMove);
					window.addEventListener('pointerup', handleUp);
				},
			[],
		);

	const startSidePanelResize = startResize(setSidePanelWidth, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH);
	const startChatPanelResize = startResize(setChatPanelWidth, MIN_CHAT_WIDTH, MAX_CHAT_WIDTH);

	const insertOverlay = (type: OverlayType) => {
		if (!excalidrawApi) {
			addToast({ message: 'Canvas is still loading. Try again in a moment.', type: 'info' });
			return;
		}

		const sceneUpdate = buildOverlayInsertionScene(type, elements, appState);
		excalidrawApi.updateScene({
			elements: sceneUpdate.elements,
			appState: sceneUpdate.appState as any,
		});
		setIsInsertMenuOpen(false);
		addToast({
			message:
				type === 'newlex'
					? 'Rich text note inserted'
					: `${overlayActions.find((action) => action.type === type)?.label ?? 'Overlay'} inserted`,
			type: 'success',
		});
	};

	return (
		<>
			<div className="absolute left-16 top-4 z-20">
				<button
					type="button"
					onClick={() => void navigate({ to: '/dashboard' })}
					className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_IDLE} bg-white/92 shadow-md backdrop-blur`}
				>
					Back To Dashboard
				</button>
			</div>

			<div className="absolute right-4 top-4 z-20 flex max-w-[calc(100vw-1rem)] items-center gap-2">
				<div className="relative" ref={insertMenuRef}>
					<button
						type="button"
						onClick={() => setIsInsertMenuOpen((current) => !current)}
						className={`${CHROME_BUTTON_BASE} ${
							isInsertMenuOpen ? CHROME_BUTTON_ACTIVE : CHROME_BUTTON_IDLE
						} bg-white/96 tracking-[0.22em] backdrop-blur`}
					>
						Insert
					</button>
					{isInsertMenuOpen ? (
						<div className="absolute right-0 top-[calc(100%+0.75rem)] w-72 rounded-[12px] border border-stone-200 bg-white p-2 shadow-xl">
							<div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
								Add To Canvas
							</div>
							<div className="space-y-1">
								{overlayActions.map((action) => (
									<button
										key={action.type}
										type="button"
										onClick={() => insertOverlay(action.type)}
										className="flex w-full flex-col rounded-[8px] px-3 py-3 text-left hover:bg-[#f3f1ff]"
									>
										<span className="text-sm font-semibold text-stone-900">{action.label}</span>
										<span className="mt-1 text-xs text-stone-500">{action.description}</span>
									</button>
								))}
							</div>
						</div>
					) : null}
				</div>

				<button
					type="button"
					aria-label="Profile and workspace menu"
					onClick={() => setActivePanel(activePanel === 'assets' ? 'none' : 'assets')}
					className={`flex h-9 w-9 items-center justify-center rounded-[8px] border shadow-sm backdrop-blur ${
						activePanel === 'assets' ? CHROME_BUTTON_ACTIVE : CHROME_BUTTON_IDLE
					}`}
				>
					{user?.imageUrl ? (
						<img src={user.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
					) : (
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">
							{initials}
						</div>
					)}
				</button>
			</div>

			{activePanel === 'collab' ? (
				<PanelFrame
					width={sidePanelWidth}
					onResizeStart={startSidePanelResize}
					className="absolute bottom-20 right-4 z-20 h-[min(30rem,calc(100vh-9rem))]"
				>
					<PanelShell
						title="Live Collaboration"
						description="End-to-end encrypted room sharing through PartyKit."
						onClose={() => setActivePanel('none')}
					>
						<div className="max-h-full space-y-4 overflow-auto px-4 py-4">
							<div className="rounded-[10px] border border-stone-200 bg-stone-50 px-3 py-3">
								<div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
									Session Status
								</div>
								<div className="mt-2 text-sm text-stone-900">{sessionCopy.label}</div>
								<div className="mt-1 text-xs text-stone-500">{sessionCopy.detail}</div>
								{collaboratorList.length > 0 ? (
									<div className="mt-3 flex flex-wrap gap-2">
										{collaboratorList.map((collaborator, index) => (
											<span
												key={`${collaborator.username ?? 'anon'}-${index}`}
												className="rounded-[8px] bg-white px-3 py-1 text-[11px] text-stone-700"
											>
												{collaborator.username}
											</span>
										))}
									</div>
								) : null}
							</div>

							<div>
								<label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
									Display Name
								</label>
								<input
									value={collaboration.username}
									onChange={(event) => collaboration.setUsername(event.target.value)}
									className="w-full rounded-[8px] border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none"
									placeholder="Anonymous"
								/>
							</div>

							{collaboration.roomLink ? (
								<div>
									<label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
										Share Link
									</label>
									<textarea
										readOnly
										value={collaboration.roomLink}
										className="min-h-24 w-full resize-none rounded-[8px] border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-700 outline-none"
									/>
								</div>
							) : null}

							<div className="flex gap-2">
								{collaboration.isCollaborating ? (
									<>
										<button
											type="button"
											onClick={() => {
												if (collaboration.roomLink) {
													void navigator.clipboard.writeText(collaboration.roomLink);
												}
											}}
											className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_IDLE} flex-1 text-xs`}
										>
											Copy Link
										</button>
										<button
											type="button"
											onClick={collaboration.stopSession}
											className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_DANGER} flex-1 text-xs`}
										>
											Stop
										</button>
									</>
								) : (
									<button
										type="button"
										onClick={() => void collaboration.startSession()}
										className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_ACTIVE} w-full text-xs`}
									>
										Start Collaboration
									</button>
								)}
							</div>
						</div>
					</PanelShell>
				</PanelFrame>
			) : null}

			{activePanel === 'assets' ? (
				<PanelFrame
					width={sidePanelWidth}
					onResizeStart={startSidePanelResize}
					className="absolute right-4 top-20 z-20 max-h-[calc(100%-6rem)]"
				>
					<PanelShell
						title="Profile & Workspace"
						description="Account details, workspace shortcuts, and quick inserts."
						onClose={() => setActivePanel('none')}
					>
						<div className="max-h-[calc(100vh-9rem)] space-y-4 overflow-auto px-4 py-4">
							<div className="flex items-center gap-3 rounded-[10px] border border-stone-200 bg-stone-50 px-4 py-4">
								{user?.imageUrl ? (
									<img src={user.imageUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
								) : (
									<div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-white">
										{initials}
									</div>
								)}
								<div className="min-w-0">
									<div className="truncate text-sm font-semibold text-stone-900">{profileName}</div>
									<div className="truncate text-xs text-stone-500">{profileEmail}</div>
									<div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
										Canvas workspace
									</div>
								</div>
							</div>

							<div className="rounded-[10px] border border-stone-200 bg-white px-4 py-4">
								<div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
									Quick Actions
								</div>
								<div className="mt-3 grid grid-cols-2 gap-2">
									<button
										type="button"
										onClick={() => void navigate({ to: '/dashboard' })}
										className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_IDLE} rounded-[8px] px-3 py-3 text-left text-sm font-medium normal-case tracking-normal text-stone-800`}
									>
										Browse Canvases
									</button>
									<button
										type="button"
										onClick={() => {
											setActivePanel('none');
											setIsInsertMenuOpen(true);
										}}
										className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_IDLE} rounded-[8px] px-3 py-3 text-left text-sm font-medium normal-case tracking-normal text-stone-800`}
									>
										Open Insert Menu
									</button>
									<button
										type="button"
										onClick={() => setActivePanel('collab')}
										className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_IDLE} rounded-[8px] px-3 py-3 text-left text-sm font-medium normal-case tracking-normal text-stone-800`}
									>
										Live Collaboration
									</button>
									<button
										type="button"
										onClick={() => setActivePanel('chat')}
										className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_IDLE} rounded-[8px] px-3 py-3 text-left text-sm font-medium normal-case tracking-normal text-stone-800`}
									>
										Open AI Assistant
									</button>
								</div>
							</div>

							<div>
								<div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
									Available Inserts
								</div>
								<div className="space-y-2">
									{overlayActions.map((action) => (
										<button
											key={action.type}
											type="button"
											onClick={() => {
												insertOverlay(action.type);
												setActivePanel('none');
											}}
											className="flex w-full items-start justify-between rounded-[8px] border border-stone-200 bg-stone-50 px-3 py-3 text-left hover:border-[#d7dafd] hover:bg-[#f3f1ff]"
										>
											<div>
												<div className="text-sm font-semibold text-stone-900">{action.label}</div>
												<div className="mt-1 text-xs text-stone-500">{action.description}</div>
											</div>
											<span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
												Add
											</span>
										</button>
									))}
								</div>
							</div>
						</div>
					</PanelShell>
				</PanelFrame>
			) : null}

			<div className="absolute bottom-5 right-4 z-20 flex items-center gap-2">
				<button
					type="button"
					onClick={() => setActivePanel(activePanel === 'collab' ? 'none' : 'collab')}
					className={`${CHROME_BUTTON_BASE} ${
						activePanel === 'collab' ? CHROME_BUTTON_ACTIVE : CHROME_BUTTON_IDLE
					} flex items-center gap-2 bg-white/95 px-3.5 py-2.5 shadow-lg backdrop-blur`}
				>
					<span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
					Live
				</button>

				<button
					type="button"
					onClick={() => setActivePanel(activePanel === 'chat' ? 'none' : 'chat')}
					className={`${CHROME_BUTTON_BASE} ${
						activePanel === 'chat' ? CHROME_BUTTON_ACTIVE : CHROME_BUTTON_IDLE
					} flex items-center gap-2 bg-white/95 px-3.5 py-2.5 shadow-lg backdrop-blur`}
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
					</svg>
					AI
				</button>
			</div>

			{activePanel === 'chat' ? (
				<PanelFrame
					width={chatPanelWidth}
					onResizeStart={startChatPanelResize}
					className="absolute bottom-20 right-4 z-20 h-[min(34rem,calc(100vh-9rem))]"
				>
					<div className="h-full">
						<AIChatPanel />
					</div>
				</PanelFrame>
			) : null}
		</>
	);
}
