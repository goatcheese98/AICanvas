import {
	startTransition,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type FormEvent,
} from 'react';
import { waitlistSchemas, type JoinWaitlist } from '@ai-canvas/shared/schemas';
import { joinWaitlist } from '../../lib/api';
import {
	landingContent,
	type LandingActorId,
	type LandingChatState,
	type LandingConnectorId,
	type LandingScene,
} from './landing-content';
import './landing.css';

type WaitlistStatus =
	| { kind: 'idle'; message: string }
	| { kind: 'submitting'; message: string }
	| { kind: 'success'; message: string }
	| { kind: 'duplicate'; message: string }
	| { kind: 'error'; message: string };

type Camera = {
	x: number;
	y: number;
	scale: number;
};

type CanvasActor = {
	id: LandingActorId;
	type:
		| 'cluster'
		| 'imageRef'
		| 'sketchNote'
		| 'markdown'
		| 'chat'
		| 'richText'
		| 'kanban'
		| 'prototype'
		| 'waitlist';
	x: number;
	y: number;
	width: number;
	height: number;
	rotate?: number;
};

type Connector = {
	id: LandingConnectorId;
	x: number;
	y: number;
	width: number;
	height: number;
	path: string;
};

type CollaborationMarker = {
	id: string;
	type: 'avatar' | 'comment' | 'cursor';
	x: number;
	y: number;
	label: string;
	tone: 'violet' | 'mint' | 'gold';
	driftX?: number;
	driftY?: number;
	delay?: number;
};

const canvasActors: CanvasActor[] = [
	{ id: 'cluster', type: 'cluster', x: 960, y: 380, width: 520, height: 410, rotate: -1.8 },
	{ id: 'imageRef', type: 'imageRef', x: 1450, y: 1080, width: 250, height: 190, rotate: -5.5 },
	{ id: 'sketchNote', type: 'sketchNote', x: 1550, y: 330, width: 270, height: 96, rotate: 2.4 },
	{ id: 'markdown', type: 'markdown', x: 1760, y: 240, width: 540, height: 360, rotate: -0.6 },
	{ id: 'chat', type: 'chat', x: 2360, y: 360, width: 470, height: 320, rotate: 0.5 },
	{ id: 'richText', type: 'richText', x: 1940, y: 900, width: 560, height: 395, rotate: 0.4 },
	{ id: 'kanban', type: 'kanban', x: 2700, y: 470, width: 760, height: 440, rotate: -0.3 },
	{ id: 'prototype', type: 'prototype', x: 2860, y: 1160, width: 620, height: 420, rotate: -0.2 },
	{ id: 'waitlist', type: 'waitlist', x: 3510, y: 1180, width: 520, height: 360, rotate: -0.18 },
];

const canvasConnectors: Connector[] = [
	{
		id: 'cluster-to-chat',
		x: 1460,
		y: 500,
		width: 950,
		height: 180,
		path: 'M24 108C220 28 420 18 610 54C724 76 816 106 926 138',
	},
	{
		id: 'chat-to-richtext',
		x: 2160,
		y: 670,
		width: 460,
		height: 390,
		path: 'M44 24C26 92 34 172 88 236C142 298 238 328 402 344',
	},
	{
		id: 'richtext-to-kanban',
		x: 2380,
		y: 700,
		width: 520,
		height: 270,
		path: 'M22 208C142 118 246 74 338 58C390 50 440 52 492 74',
	},
	{
		id: 'kanban-to-prototype',
		x: 3080,
		y: 860,
		width: 300,
		height: 360,
		path: 'M42 30C44 128 78 196 140 246C176 274 216 290 266 306',
	},
];

const collaborationMarkers: CollaborationMarker[] = [
	{
		id: 'avatar-notes',
		type: 'avatar',
		x: 2200,
		y: 1020,
		label: 'Maya',
		tone: 'mint',
		driftX: 12,
		driftY: -8,
		delay: 0.1,
	},
	{
		id: 'avatar-board',
		type: 'avatar',
		x: 3010,
		y: 910,
		label: 'Noor',
		tone: 'violet',
		driftX: 8,
		driftY: 10,
		delay: 0.6,
	},
	{
		id: 'comment-prototype',
		type: 'comment',
		x: 3310,
		y: 1080,
		label: 'Shorten the intro and keep the examples visible.',
		tone: 'gold',
		driftX: 10,
		driftY: -6,
		delay: 0.4,
	},
	{
		id: 'cursor-board',
		type: 'cursor',
		x: 2860,
		y: 720,
		label: 'Leo is grouping ideas',
		tone: 'violet',
		driftX: 14,
		driftY: -14,
		delay: 0,
	},
	{
		id: 'cursor-notes',
		type: 'cursor',
		x: 1980,
		y: 1180,
		label: 'Maya is trimming notes',
		tone: 'mint',
		driftX: -12,
		driftY: 12,
		delay: 0.9,
	},
	{
		id: 'cursor-prototype',
		type: 'cursor',
		x: 3200,
		y: 1410,
		label: 'Noor is comparing layouts',
		tone: 'gold',
		driftX: 10,
		driftY: 16,
		delay: 0.3,
	},
];

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number) {
	return start + (end - start) * amount;
}

function mixCamera(start: Camera, end: Camera, amount: number): Camera {
	return {
		x: lerp(start.x, end.x, amount),
		y: lerp(start.y, end.y, amount),
		scale: lerp(start.scale, end.scale, amount),
	};
}

function mixVisibility(isVisible: boolean, nextVisible: boolean, amount: number, hiddenValue = 0.04) {
	return lerp(isVisible ? 1 : hiddenValue, nextVisible ? 1 : hiddenValue, amount);
}

function getMessageTone(status: WaitlistStatus) {
	if (status.kind === 'success') return 'success';
	if (status.kind === 'duplicate') return 'duplicate';
	if (status.kind === 'error') return 'error';
	return 'neutral';
}

function getChatCopy(chatState: LandingChatState) {
	switch (chatState) {
		case 'prompt':
			return {
				user: 'Summarize these notes and references into a cleaner study guide I can keep on the board.',
				assistant:
					'I pulled the useful takeaways into markdown and kept the sources nearby so you can keep editing from here.',
				outputTitle: 'Rendered output',
				outputLines: ['Key topics', 'Useful references', 'Questions to revisit'],
			};
		case 'drafting':
			return {
				user: 'Group the takeaways into actions, open questions, and what still needs a decision.',
				assistant:
					'I organized the notes into grouped next steps and created a planning board without losing the original context.',
				outputTitle: 'Board update',
				outputLines: ['Actions grouped', 'Questions collected', 'Plan created on canvas'],
			};
		case 'handoff':
			return {
				user: 'Turn this into something easier to scan and reuse later.',
				assistant:
					'I inserted a structured summary on the canvas so the important parts stay editable and easy to build from.',
				outputTitle: 'Inserted onto canvas',
				outputLines: ['Summary block added', 'Findings highlighted', 'Checklist preserved'],
			};
		case 'iterating':
			return {
				user: 'Use the plan and notes to sketch a cleaner landing direction beside the source material.',
				assistant:
					'I drafted a faster comparison view so you can review ideas, planning, and the prototype together on one board.',
				outputTitle: 'Drafted variation',
				outputLines: ['Layout options', 'Suggested copy shift', 'Compare beside notes'],
			};
		case 'invite':
			return {
				user: 'Make sure this board is ready to share with someone new.',
				assistant:
					'Everything is still connected here, so the next person can jump in with the notes, plan, comments, and output already in place.',
				outputTitle: 'Ready to share',
				outputLines: ['Source context', 'Plan and prototype', 'Invite from same board'],
			};
		default:
			return {
				user: 'Ask AI for help without leaving the board.',
				assistant: 'Research, drafting, and iteration stay in context when the board and assistant live together.',
				outputTitle: 'On-canvas help',
				outputLines: ['Research', 'Drafting', 'Iteration'],
			};
	}
}

function TourCard({
	scene,
	index,
	total,
	style,
	onStepSelect,
}: {
	scene: LandingScene;
	index: number;
	total: number;
	style: CSSProperties;
	onStepSelect: (index: number) => void;
}) {
	return (
		<section className="landing-tour-card" style={style}>
			<div className="landing-tour-topline">
				<p className="landing-kicker">{scene.label}</p>
				<span className="landing-tour-count">
					{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
				</span>
			</div>
			<h1 className="landing-guide-title">{scene.title}</h1>
			<p className="landing-subtitle landing-guide-copy">{scene.description}</p>
			<div className="landing-tour-progress" aria-label="Story progress">
				{landingContent.scenes.map((item, stepIndex) => (
					<button
						key={item.id}
						type="button"
						className={`landing-tour-dot ${stepIndex === index ? 'landing-tour-dot-active' : ''}`}
						onClick={() => onStepSelect(stepIndex)}
						aria-label={`Go to ${item.label}`}
					/>
				))}
			</div>
			{scene.cta ? (
				<div className="landing-tour-actions">
					{scene.cta.primaryLabel ? (
						scene.cta.primaryTarget != null ? (
							<button
								className="landing-button landing-button-primary"
								type="button"
								onClick={() => onStepSelect(scene.cta?.primaryTarget ?? 0)}
							>
								{scene.cta.primaryLabel}
							</button>
						) : (
							<a className="landing-button landing-button-primary" href="#waitlist">
								{scene.cta.primaryLabel}
							</a>
						)
					) : null}
					{scene.cta.secondaryLabel && scene.cta.secondaryHref ? (
						<a className="landing-button landing-button-secondary" href={scene.cta.secondaryHref}>
							{scene.cta.secondaryLabel}
						</a>
					) : null}
				</div>
			) : null}
		</section>
	);
}

function WaitlistForm({
	source,
	submitLabel,
	secondaryLabel,
	secondaryHref,
}: {
	source: JoinWaitlist['source'];
	submitLabel: string;
	secondaryLabel: string;
	secondaryHref: string;
}) {
	const inputId = useId();
	const [email, setEmail] = useState('');
	const [status, setStatus] = useState<WaitlistStatus>({
		kind: 'idle',
		message: 'Product updates and invite access only.',
	});

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const parsed = waitlistSchemas.join.safeParse({ email, source });

		if (!parsed.success) {
			startTransition(() => {
				setStatus({
					kind: 'error',
					message: parsed.error.flatten().fieldErrors.email?.[0] ?? 'Enter a valid email address.',
				});
			});
			return;
		}

		setStatus({
			kind: 'submitting',
			message: 'Saving your spot...',
		});

		try {
			const result = await joinWaitlist(parsed.data);
			startTransition(() => {
				setStatus({
					kind: result.status === 'created' ? 'success' : 'duplicate',
					message: result.message,
				});
				if (result.status === 'created') {
					setEmail('');
				}
			});
		} catch (error) {
			startTransition(() => {
				setStatus({
					kind: 'error',
					message:
						error instanceof Error
							? error.message
							: 'Something went wrong. Please try again in a moment.',
				});
			});
		}
	}

	return (
		<form
			aria-label="Landing waitlist form"
			className="grid gap-3"
			noValidate
			onSubmit={handleSubmit}
		>
			<label className="grid gap-2" htmlFor={inputId}>
				<span className="landing-microcopy text-[0.72rem] uppercase tracking-[0.18em] text-[var(--landing-soft)]">
					Work email
				</span>
				<input
					id={inputId}
					className="landing-input"
					type="email"
					autoComplete="email"
					inputMode="email"
					name="email"
					placeholder="you@company.com"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
				/>
			</label>

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<button
					className="landing-button landing-button-primary"
					type="submit"
					disabled={status.kind === 'submitting'}
				>
					{status.kind === 'submitting' ? 'Joining...' : submitLabel}
				</button>
				<a className="landing-button landing-button-secondary" href={secondaryHref}>
					{secondaryLabel}
				</a>
			</div>

			<p className="landing-form-message" aria-live="polite" data-tone={getMessageTone(status)}>
				{status.message}
			</p>
		</form>
	);
}

function WaitlistNode() {
	return (
		<div className="landing-waitlist-shell">
			<div className="landing-card-topline">
				<span className="landing-chip">Invite</span>
				<span className="landing-meta">RoopStudio</span>
			</div>
			<h3 className="landing-card-title">Join the waitlist</h3>
			<p className="landing-card-copy">
				Get early access to a canvas that keeps ideas, AI help, collaboration, and making in one place.
			</p>
			<div className="mt-5">
				<WaitlistForm
					source="landing-footer"
					submitLabel="Request access"
					secondaryLabel="Sign in"
					secondaryHref="/login"
				/>
			</div>
		</div>
	);
}

function CanvasActorNode({
	actor,
	activeScene,
	style,
}: {
	actor: CanvasActor;
	activeScene: LandingScene;
	style: CSSProperties;
}) {
	const chatCopy = getChatCopy(activeScene.chatState);
	const richTextState = activeScene.artifactState.richText;
	const markdownState = activeScene.artifactState.markdown;
	const kanbanState = activeScene.artifactState.kanban;

	if (actor.type === 'cluster') {
		return (
			<article className="landing-canvas-card landing-cluster-board" style={style}>
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Canvas</span>
					<span className="landing-meta">Loose thinking</span>
				</div>
				<h3 className="landing-card-title">Start with what you already have</h3>
				<div className="landing-cluster-grid" aria-hidden="true">
					<div className="landing-cluster-thumb landing-cluster-thumb-photo" />
					<div className="landing-sticky-note" data-tone="mint">
						Study questions
					</div>
					<div className="landing-sticky-note" data-tone="gold">
						UI ideas
					</div>
					<div className="landing-sticky-note" data-tone="sky">
						Research clips
					</div>
					<div className="landing-sticky-note" data-tone="peach">
						Next steps
					</div>
					<div className="landing-cluster-thumb landing-cluster-thumb-image" />
				</div>
			</article>
		);
	}

	if (actor.type === 'imageRef') {
		return (
			<div className="landing-canvas-actor landing-image-reference" style={style}>
				<div className="landing-image-frame">
					<div className="landing-image-art" />
				</div>
				<span>Reference image</span>
			</div>
		);
	}

	if (actor.type === 'sketchNote') {
		return (
			<div className="landing-canvas-actor landing-sketch-note" style={style}>
				<p>Collect first, organize after.</p>
				<span>rough note</span>
			</div>
		);
	}

	if (actor.type === 'markdown') {
		return (
			<article className="landing-canvas-card landing-note-board" style={style}>
				<div className="landing-card-topline">
					<span className="landing-chip">Markdown</span>
					<span className="landing-meta">
						{markdownState === 'seed' ? 'Saved note' : markdownState === 'draft' ? 'AI-assisted note' : 'Working brief'}
					</span>
				</div>
				<h3 className="landing-card-title">
					{markdownState === 'seed'
						? 'Course notes, links, and half-formed ideas'
						: markdownState === 'draft'
							? 'Research summary with the useful parts kept'
							: 'A clearer brief that stays attached to the board'}
				</h3>
				<p className="landing-card-copy">
					{markdownState === 'seed'
						? 'Capture raw thinking first, then decide what deserves more structure.'
						: markdownState === 'draft'
							? 'AI helps clean up the messy parts, but the result stays editable and easy to build from.'
							: 'Decisions, constraints, and goals stay near the notes, images, and outputs they came from.'}
				</p>
				<div className="landing-note-sections" aria-hidden="true">
					<div className="landing-note-section">
						<p>Summary</p>
						<span data-accent="true" />
					</div>
					<div className="landing-note-section">
						<p>Why it matters</p>
						<span />
					</div>
					<div className="landing-note-section">
						<p>Open questions</p>
						<span />
					</div>
				</div>
			</article>
		);
	}

	if (actor.type === 'chat') {
		return (
			<article className="landing-canvas-card landing-chat-board" style={style}>
				<div className="landing-card-topline">
					<span className="landing-chip">AI</span>
					<span className="landing-meta">Assistant</span>
				</div>
				<div className="landing-chat-stack">
					<div className="landing-chat-message" data-tone="user">
						{chatCopy.user}
					</div>
					<div className="landing-chat-message" data-tone="assistant">
						{chatCopy.assistant}
					</div>
					<div className="landing-chat-rendered-output">
						<div className="landing-chat-rendered-topline">
							<span>{chatCopy.outputTitle}</span>
							<strong>Insert on canvas</strong>
						</div>
						<div className="landing-chat-rendered-card" aria-hidden="true">
							<p>Study guide</p>
							{chatCopy.outputLines.map((line) => (
								<div key={line} className="landing-chat-rendered-line">
									<i />
									<span>{line}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</article>
		);
	}

	if (actor.type === 'richText') {
		return (
			<article className="landing-canvas-card landing-richtext-board" style={style}>
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Rich text</span>
					<span className="landing-meta">
						{richTextState === 'draft' ? 'Inserted summary' : 'Grouped notes'}
					</span>
				</div>
				<div className="landing-richtext-body" aria-hidden="true">
					<div className="landing-richtext-heading">
						<h4>{richTextState === 'draft' ? 'Inserted summary' : 'Shared notes'}</h4>
						<p>{richTextState === 'draft' ? 'Rendered from the assistant' : 'Edited by the team'}</p>
					</div>
					<div className="landing-richtext-paragraph">
						<span>
							{richTextState === 'draft'
								? 'The useful output lands directly on the board, where it can be edited, grouped, and linked to everything nearby.'
								: 'The board keeps the polished summary, source notes, and next steps tied together so collaboration stays grounded.'}
						</span>
					</div>
					<div className="landing-richtext-checklist">
						<div>
							<i />
							<span>
								{richTextState === 'draft'
									? 'Key themes from the notes are inserted directly onto the board'
									: 'Open questions stay next to the notes they came from'}
							</span>
						</div>
						<div>
							<i />
							<span>
								{richTextState === 'draft'
									? 'Research findings are easier to scan, edit, and reuse later'
									: 'Tasks and decisions can be grouped without breaking the narrative'}
							</span>
						</div>
						<div>
							<i />
							<span>
								{richTextState === 'draft'
									? 'Useful AI output becomes part of the canvas instead of a detached answer'
									: 'Comments and revisions still point back to the source material'}
							</span>
						</div>
					</div>
				</div>
			</article>
		);
	}

	if (actor.type === 'kanban') {
		return (
			<article className="landing-canvas-card landing-kanban-board" style={style}>
				<div className="landing-card-topline">
					<span className="landing-chip">Kanban</span>
					<span className="landing-meta">
						{kanbanState === 'forming' ? 'Board in progress' : 'Shared plan'}
					</span>
				</div>
				<div className="landing-kanban-columns" aria-hidden="true">
					<div className="landing-kanban-column">
						<p>Collect</p>
						<span>Pin helpful examples</span>
						<span>Keep source notes nearby</span>
						<span>Capture unknowns</span>
					</div>
					<div className="landing-kanban-column">
						<p>Shape</p>
						<span data-accent="true">Group takeaways</span>
						<span>Turn notes into steps</span>
						<span>Track what needs feedback</span>
					</div>
					<div className="landing-kanban-column">
						<p>Make</p>
						<span>Compare visual directions</span>
						<span data-accent="true">Share the board with context intact</span>
						<span>Keep iterating in place</span>
					</div>
				</div>
			</article>
		);
	}

	if (actor.type === 'prototype') {
		return (
			<article className="landing-canvas-card landing-prototype-board" style={style}>
				<div className="landing-card-topline">
					<span className="landing-chip">Prototype</span>
					<span className="landing-meta">Visual direction</span>
				</div>
				<div className="landing-prototype-frame" aria-hidden="true">
					<div className="landing-prototype-window">
						<div className="landing-prototype-nav">
							<span />
							<span />
							<span />
						</div>
						<div className="landing-prototype-body">
							<div className="landing-prototype-sidebar">
								<i />
								<i />
								<i />
							</div>
							<div className="landing-prototype-screen">
								<div className="landing-prototype-hero" />
								<div className="landing-prototype-cta-row">
									<span data-accent="true" />
									<span />
								</div>
								<div className="landing-prototype-content" />
							</div>
						</div>
					</div>
				</div>
			</article>
		);
	}

	return (
		<article className="landing-canvas-card landing-waitlist-board" style={style}>
			<WaitlistNode />
		</article>
	);
}

function ConnectorPath({
	connector,
	opacity,
}: {
	connector: Connector;
	opacity: number;
}) {
	const style = {
		left: `${connector.x}px`,
		top: `${connector.y}px`,
		width: `${connector.width}px`,
		height: `${connector.height}px`,
		['--landing-connector-opacity' as string]: `${opacity}`,
		['--landing-connector-offset' as string]: `${(1 - opacity) * 360}`,
	} satisfies CSSProperties;

	return (
		<div className="landing-connector" style={style} aria-hidden="true">
			<svg viewBox={`0 0 ${connector.width} ${connector.height}`} fill="none" xmlns="http://www.w3.org/2000/svg">
				<path
					d={connector.path}
					pathLength={360}
					stroke="rgba(105, 101, 219, 0.78)"
					strokeWidth="4"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeDasharray="16 12"
				/>
				<path
					d={connector.path}
					pathLength={360}
					stroke="rgba(105, 101, 219, 0.18)"
					strokeWidth="12"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</div>
	);
}

function CollaborationLayer({
	lowerScene,
	upperScene,
	amount,
}: {
	lowerScene: LandingScene;
	upperScene: LandingScene;
	amount: number;
}) {
	const lowerWeight =
		lowerScene.collaborationState === 'active'
			? 1
			: lowerScene.collaborationState === 'commentary'
				? 0.55
				: 0;
	const upperWeight =
		upperScene.collaborationState === 'active'
			? 1
			: upperScene.collaborationState === 'commentary'
				? 0.55
				: 0;
	const visibility = lerp(lowerWeight, upperWeight, amount);

	return (
		<div
			className="landing-collaboration-layer"
			style={{ opacity: visibility, pointerEvents: 'none' }}
			aria-hidden="true"
		>
			{collaborationMarkers.map((marker) => (
				<div
					key={marker.id}
					className={`landing-collab-marker landing-collab-${marker.type}`}
					data-tone={marker.tone}
					style={{
						left: `${marker.x}px`,
						top: `${marker.y}px`,
						transform: `translate3d(0, ${(1 - visibility) * 16}px, 0) scale(${0.92 + visibility * 0.08})`,
						['--landing-collab-drift-x' as string]: `${marker.driftX ?? 0}px`,
						['--landing-collab-drift-y' as string]: `${marker.driftY ?? 0}px`,
						animationDelay: `${marker.delay ?? 0}s`,
					}}
				>
					{marker.type === 'cursor' ? (
						<>
							<span className="landing-collab-cursor-shape" />
							<span>{marker.label}</span>
						</>
					) : marker.type === 'comment' ? (
						<>
							<strong>Comment</strong>
							<span>{marker.label}</span>
						</>
					) : (
						<>
							<i />
							<span>{marker.label}</span>
						</>
					)}
				</div>
			))}
		</div>
	);
}

function CanvasBoard({
	camera,
	activeScene,
	activeIndex,
	lowerScene,
	upperScene,
	amount,
	onStepSelect,
}: {
	camera: Camera;
	activeScene: LandingScene;
	activeIndex: number;
	lowerScene: LandingScene;
	upperScene: LandingScene;
	amount: number;
	onStepSelect: (index: number) => void;
}) {
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const node = viewportRef.current;
		if (!node) return;

		const updateSize = () => {
			const rect = node.getBoundingClientRect();
			setViewportSize({
				width: rect.width,
				height: rect.height,
			});
		};

		updateSize();
		const observer =
			typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => updateSize());
		observer?.observe(node);
		window.addEventListener('resize', updateSize);

		return () => {
			observer?.disconnect();
			window.removeEventListener('resize', updateSize);
		};
	}, []);

	const boardTransform = useMemo(() => {
		const translateX = viewportSize.width / 2 - camera.x * camera.scale;
		const translateY = viewportSize.height / 2 - camera.y * camera.scale;

		return {
			transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${camera.scale})`,
		} satisfies CSSProperties;
	}, [camera, viewportSize.height, viewportSize.width]);

	const tourCardStyle = useMemo(() => {
		const mixedWidth = lerp(lowerScene.tourCard.width, upperScene.tourCard.width, amount);
		const mixedX = lerp(lowerScene.tourCard.x, upperScene.tourCard.x, amount);
		const mixedY = lerp(lowerScene.tourCard.y, upperScene.tourCard.y, amount);
		return {
			left: `${mixedX}px`,
			top: `${mixedY}px`,
			width: `${mixedWidth}px`,
		} satisfies CSSProperties;
	}, [amount, lowerScene.tourCard.width, lowerScene.tourCard.x, lowerScene.tourCard.y, upperScene.tourCard.width, upperScene.tourCard.x, upperScene.tourCard.y]);

	return (
		<div ref={viewportRef} className="landing-board-viewport">
			<div className="landing-board-surface" style={boardTransform}>
				<div className="landing-board-grid" />

				{canvasConnectors.map((connector) => {
					const opacity = mixVisibility(
						lowerScene.connectorState.includes(connector.id),
						upperScene.connectorState.includes(connector.id),
						amount,
						0,
					);

					return <ConnectorPath key={connector.id} connector={connector} opacity={opacity} />;
				})}

				{canvasActors.map((actor) => {
					const visibility = mixVisibility(
						lowerScene.visibleActors.includes(actor.id),
						upperScene.visibleActors.includes(actor.id),
						amount,
						0.03,
					);
					const focus = mixVisibility(
						lowerScene.focusActors.includes(actor.id),
						upperScene.focusActors.includes(actor.id),
						amount,
						0,
					);
					const scale = 0.92 + visibility * 0.08 + focus * 0.05;
					const yShift = (1 - visibility) * 28;
					const style = {
						left: `${actor.x}px`,
						top: `${actor.y}px`,
						width: `${actor.width}px`,
						height: `${actor.height}px`,
						opacity: visibility,
						zIndex: Math.round(10 + visibility * 10 + focus * 10),
						transform: `translate3d(0, ${yShift}px, 0) scale(${scale}) rotate(${actor.rotate ?? 0}deg)`,
					} satisfies CSSProperties;

					return <CanvasActorNode key={actor.id} actor={actor} activeScene={activeScene} style={style} />;
				})}

				<TourCard
					scene={activeScene}
					index={activeIndex}
					total={landingContent.scenes.length}
					style={tourCardStyle}
					onStepSelect={onStepSelect}
				/>

				<CollaborationLayer lowerScene={lowerScene} upperScene={upperScene} amount={amount} />
			</div>
		</div>
	);
}

function CanvasJourney() {
	const journeyRef = useRef<HTMLElement | null>(null);
	const scenes = landingContent.scenes;
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		let frame = 0;

		const updateProgress = () => {
			frame = 0;
			const node = journeyRef.current;
			if (!node) return;

			const rect = node.getBoundingClientRect();
			const scrollable = Math.max(rect.height - window.innerHeight, 1);
			const nextProgress = clamp(-rect.top / scrollable, 0, 1);
			setProgress(nextProgress);
		};

		const requestUpdate = () => {
			if (frame !== 0) return;
			frame = window.requestAnimationFrame(updateProgress);
		};

		updateProgress();
		window.addEventListener('scroll', requestUpdate, { passive: true });
		window.addEventListener('resize', requestUpdate);

		return () => {
			if (frame !== 0) {
				window.cancelAnimationFrame(frame);
			}
			window.removeEventListener('scroll', requestUpdate);
			window.removeEventListener('resize', requestUpdate);
		};
	}, []);

	const exactIndex = progress * (scenes.length - 1);
	const lowerIndex = Math.floor(exactIndex);
	const upperIndex = Math.min(scenes.length - 1, lowerIndex + 1);
	const amount = exactIndex - lowerIndex;
	const activeIndex = amount > 0.55 ? upperIndex : lowerIndex;
	const lowerScene = scenes[lowerIndex];
	const upperScene = scenes[upperIndex];
	const activeScene = scenes[activeIndex];
	const camera = mixCamera(lowerScene.camera, upperScene.camera, amount);

	const handleSceneSelect = useCallback(
		(index: number) => {
			const node = journeyRef.current;
			if (!node) return;

			const targetProgress = index / Math.max(scenes.length - 1, 1);
			const targetY =
				node.offsetTop + (node.offsetHeight - window.innerHeight) * targetProgress;

			window.scrollTo({
				top: targetY,
				behavior: 'smooth',
			});
		},
		[scenes.length],
	);

	return (
		<section
			ref={journeyRef}
			id="product"
			className="landing-journey"
			style={{ height: `${scenes.length * 115}vh` }}
		>
			<div
				id="waitlist"
				aria-hidden="true"
				className="landing-journey-anchor"
				style={{ top: `${(scenes.length - 1) * 115}vh` }}
			/>
			<div className="landing-journey-sticky">
				<div className="landing-canvas-shell">
					<div className="landing-stage-bar">
						<div className="landing-stage-brand">
							<div className="landing-stage-dots" aria-hidden="true">
								<span />
								<span />
								<span />
							</div>
							<a className="landing-link landing-stage-wordmark" href="#top">
								{landingContent.brand.name}
							</a>
						</div>
						<div className="landing-stage-meta">
							<span className="landing-kicker">{landingContent.hero.eyebrow}</span>
							<span className="landing-meta text-[0.72rem] uppercase tracking-[0.18em] text-[var(--landing-soft)]">
								Scroll to follow the board
							</span>
						</div>
					</div>

					<div className="landing-canvas-frame">
						<CanvasBoard
							camera={camera}
							activeScene={activeScene}
							activeIndex={activeIndex}
							lowerScene={lowerScene}
							upperScene={upperScene}
							amount={amount}
							onStepSelect={handleSceneSelect}
						/>
					</div>
				</div>
			</div>
		</section>
	);
}

export function LandingPage() {
	return (
		<div className="landing-page">
			<main id="top" className="landing-shell">
				<CanvasJourney />
			</main>
		</div>
	);
}
