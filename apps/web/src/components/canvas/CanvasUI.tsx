import { AIChatPanel } from '@/components/ai-chat';
import type { CollaborationSessionStatus } from '@/hooks/collaboration-utils';
import { useAppStore } from '@/stores/store';
import type { OverlayType } from '@ai-canvas/shared/types';
import { useUser } from '@clerk/clerk-react';
import type { AppState } from '@excalidraw/excalidraw/types';
import { useNavigate } from '@tanstack/react-router';
import {
	type Dispatch,
	type PointerEvent as ReactPointerEvent,
	type SetStateAction,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { CollaborationPanel } from './CollaborationPanel';
import { ProfilePanel } from './ProfilePanel';
import {
	CHROME_BUTTON_ACTIVE,
	CHROME_BUTTON_BASE,
	CHROME_BUTTON_IDLE,
	PanelFrame,
	PanelShell,
} from './canvas-chrome';
import { buildOverlayInsertionScene } from './element-factories';
import { updateSceneAndSyncAppStore } from './excalidraw-store-sync';

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

const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH = 420;
const MIN_CHAT_WIDTH = 620;
const MAX_CHAT_WIDTH = 1080;

const overlayActions: ReadonlyArray<{ type: OverlayType; label: string; description: string }> = [
	{ type: 'markdown', label: 'Markdown', description: 'Note with formatting and images' },
	{ type: 'newlex', label: 'Rich Text', description: 'Lexical editor with comments' },
	{ type: 'kanban', label: 'Kanban', description: 'Board for planning work' },
	{ type: 'web-embed', label: 'Web Embed', description: 'Inline site or prototype' },
	{ type: 'prototype', label: 'Prototype', description: 'Live React or JS app with preview' },
];

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
	const [chatPanelWidth, setChatPanelWidth] = useState(920);
	const [chatPanelHeight, setChatPanelHeight] = useState(680);
	const insertMenuRef = useRef<HTMLDivElement | null>(null);
	const initials = useMemo(() => {
		const name =
			user?.fullName ||
			user?.username ||
			user?.firstName ||
			user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
			'You';
		return (
			name
				.split(/\s+/)
				.slice(0, 2)
				.map((part) => part[0]?.toUpperCase() ?? '')
				.join('') || 'Y'
		);
	}, [user]);
	const profileName =
		user?.fullName ||
		user?.username ||
		user?.firstName ||
		user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
		'You';
	const profileEmail = user?.primaryEmailAddress?.emailAddress ?? 'Signed in';
	const statusDotClass =
		collaboration.sessionStatus === 'connected'
			? 'bg-emerald-500'
			: collaboration.sessionStatus === 'reconnecting'
				? 'bg-amber-500'
				: collaboration.sessionStatus === 'error'
					? 'bg-rose-500'
					: 'bg-stone-300';

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

	const startResize = useCallback(
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

	const startChatHeightResize = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			event.preventDefault();
			const startY = event.clientY;
			let snapshot = chatPanelHeight;
			setChatPanelHeight((v) => {
				snapshot = v;
				return v;
			});
			const handleMove = (e: PointerEvent) => {
				const delta = e.clientY - startY;
				const maxH = Math.floor(window.innerHeight * 0.88);
				setChatPanelHeight(Math.max(300, Math.min(maxH, snapshot - delta)));
			};
			const handleUp = () => {
				window.removeEventListener('pointermove', handleMove);
				window.removeEventListener('pointerup', handleUp);
			};
			window.addEventListener('pointermove', handleMove);
			window.addEventListener('pointerup', handleUp);
		},
		[chatPanelHeight],
	);

	const insertOverlay = (type: OverlayType) => {
		if (!excalidrawApi) {
			addToast({ message: 'Canvas is still loading. Try again in a moment.', type: 'info' });
			return;
		}

		const sceneUpdate = buildOverlayInsertionScene(type, elements, appState);
		updateSceneAndSyncAppStore(excalidrawApi, {
			elements: sceneUpdate.elements,
			appState: sceneUpdate.appState as AppState,
		});
		setIsInsertMenuOpen(false);
		addToast({
			message:
				type === 'newlex'
					? 'Rich text note inserted'
					: type === 'prototype'
						? 'Prototype overlay inserted'
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
						<CollaborationPanel
							isCollaborating={collaboration.isCollaborating}
							collaborators={collaboration.collaborators}
							roomLink={collaboration.roomLink}
							sessionError={collaboration.sessionError}
							sessionStatus={collaboration.sessionStatus}
							username={collaboration.username}
							setUsername={collaboration.setUsername}
							startSession={collaboration.startSession}
							stopSession={collaboration.stopSession}
						/>
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
						<ProfilePanel
							initials={initials}
							profileName={profileName}
							profileEmail={profileEmail}
							userImageUrl={user?.imageUrl}
							overlayActions={overlayActions}
							onNavigateDashboard={() => void navigate({ to: '/dashboard' })}
							onOpenInsertMenu={() => {
								setActivePanel('none');
								setIsInsertMenuOpen(true);
							}}
							onOpenCollaboration={() => setActivePanel('collab')}
							onOpenChat={() => setActivePanel('chat')}
							onInsertOverlay={(type) => {
								insertOverlay(type);
								setActivePanel('none');
							}}
						/>
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
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
					>
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
					</svg>
					AI
				</button>
			</div>

			{activePanel === 'chat' ? (
				<div
					className="absolute bottom-20 right-4 z-20"
					style={{ width: chatPanelWidth, height: chatPanelHeight }}
				>
					{/* Horizontal resize handle (left edge) */}
					<div
						className="absolute inset-y-8 -left-2 z-30 flex w-4 cursor-ew-resize items-center justify-center"
						onPointerDown={startChatPanelResize}
						aria-label="Resize panel width"
					>
						<div className="h-16 w-1 rounded-[999px] bg-stone-200/90 shadow-sm" />
					</div>
					{/* Vertical resize handle (top edge) */}
					<div
						className="absolute -top-2 inset-x-8 z-30 flex h-4 cursor-ns-resize items-center justify-center"
						onPointerDown={startChatHeightResize}
						aria-label="Resize panel height"
					>
						<div className="h-1 w-16 rounded-[999px] bg-stone-200/90 shadow-sm" />
					</div>
					<div className="h-full">
						<AIChatPanel canvasId={canvasId} />
					</div>
				</div>
			) : null}
		</>
	);
}
