import type { FormEventHandler } from 'react';
import { BoardLogo } from './landing-canvas-scene-utils';

type CanvasBoardProps = {
	email: string;
	waitlistMessage: string | null;
	waitlistStatus: 'idle' | 'submitting' | 'success' | 'error';
	onEmailChange: (value: string) => void;
	onWaitlistSubmit: FormEventHandler<HTMLFormElement>;
	activeChapterId: string;
};

export function CanvasBoard({
	email,
	waitlistMessage,
	waitlistStatus,
	onEmailChange,
	onWaitlistSubmit,
	activeChapterId,
}: CanvasBoardProps) {
	return (
		<>
			{/* ===== EXCALIDRAW-STYLE BACKGROUND SKETCH LAYER ===== */}
			<div className="landing-sketch-layer" aria-hidden="true">
				<div className="landing-sketch-rect" />
				<div className="landing-sketch-rect-2" />
				<div className="landing-sketch-rect-3" />
				<div className="landing-sketch-rect-4" />
				<div className="landing-sketch-circle" />
				<div className="landing-sketch-circle-2" />
				<div className="landing-sketch-circle-3" />
				<div className="landing-sketch-arrow landing-sketch-arrow-1">
					<svg viewBox="0 0 140 60" preserveAspectRatio="none">
						<path d="M10 45 Q35 25, 70 35 T130 20" />
						<path d="M122 12 L130 20 L118 26" />
					</svg>
				</div>
				<div className="landing-sketch-arrow landing-sketch-arrow-2">
					<svg viewBox="0 0 100 80" preserveAspectRatio="none">
						<path d="M10 60 Q30 30, 60 40 T90 15" />
						<path d="M82 8 L90 15 L80 22" />
					</svg>
				</div>
				<div className="landing-sketch-arrow landing-sketch-arrow-3">
					<svg viewBox="0 0 120 50" preserveAspectRatio="none">
						<path d="M10 35 Q40 15, 75 25 T110 18" />
						<path d="M102 10 L110 18 L100 24" />
					</svg>
				</div>
				<div className="landing-sketch-wiggle landing-sketch-wiggle-1">
					<svg viewBox="0 0 300 40" preserveAspectRatio="none">
						<path d="M0 20 Q15 8, 30 20 T60 20 T90 18 T120 22 T150 20 T180 18 T210 20 T240 19 T270 20 T300 18" />
					</svg>
				</div>
				<div className="landing-sketch-wiggle landing-sketch-wiggle-2">
					<svg viewBox="0 0 250 50" preserveAspectRatio="none">
						<path d="M0 25 Q12 12, 25 25 T50 23 T75 27 T100 24 T125 26 T150 22 T175 25 T200 23 T225 26 T250 24" />
					</svg>
				</div>
				<div className="landing-sketch-wiggle landing-sketch-wiggle-3">
					<svg viewBox="0 0 280 45" preserveAspectRatio="none">
						<path d="M0 22 Q14 10, 28 22 T56 20 T84 24 T112 21 T140 23 T168 19 T196 22 T224 20 T252 23 T280 21" />
					</svg>
				</div>
				<div className="landing-sketch-dots landing-sketch-dots-1" />
				<div className="landing-sketch-dots landing-sketch-dots-2" />
				<div className="landing-sketch-dots landing-sketch-dots-3" />
			</div>

			{/* Zone labels */}
			<div className="landing-zone-label" data-zone="capture">
				<span>Rough capture</span>
			</div>
			<div className="landing-zone-label" data-zone="research">
				<span>Research wall</span>
			</div>
			<div className="landing-zone-label" data-zone="plan">
				<span>Planning lane</span>
			</div>
			<div className="landing-zone-label" data-zone="polish">
				<span>Polished outputs</span>
			</div>

			{/* Ambient glows */}
			<div className="landing-ambient-glow landing-ambient-glow-capture" />
			<div className="landing-ambient-glow landing-ambient-glow-research" />
			<div className="landing-ambient-glow landing-ambient-glow-plan" />
			<div className="landing-ambient-glow landing-ambient-glow-polish" />

			{/* ===== INTRO ELEMENT (blurred when entering capture) ===== */}
			<article
				className="landing-board-card landing-board-intro-card"
				data-chapter="intro"
				data-active={activeChapterId === 'intro' ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Start here</span>
					<span className="landing-meta">Your workspace</span>
				</div>
				<h2 className="landing-card-title">Welcome to your canvas</h2>
				<p className="landing-card-copy">
					A single surface for everything from rough notes to polished deliverables.
				</p>
				<div className="landing-intro-visual" aria-hidden="true">
					<div className="landing-intro-cursor">
						<svg viewBox="0 0 24 24" fill="currentColor">
							<path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35Z" />
						</svg>
					</div>
					<div className="landing-intro-hint">Scroll to explore</div>
				</div>
			</article>

			{/* ===== CHAPTER 1: CAPTURE ZONE ===== */}
			<article
				className="landing-board-card landing-board-cluster-card"
				data-chapter="capture"
				data-active={activeChapterId === 'capture' ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip">Canvas</span>
					<span className="landing-meta">Loose thinking</span>
				</div>
				<h2 className="landing-card-title">Loose notes and references</h2>
				<p className="landing-card-copy">
					Drop in screenshots, prompts, notes, and quick ideas before you decide what deserves
					structure.
				</p>
				<div className="landing-cluster-grid" aria-hidden="true">
					<div className="landing-cluster-thumb landing-cluster-thumb-photo">
						<span>Onboarding screenshot</span>
					</div>
					<div className="landing-sticky-note" data-tone="mint">
						<strong>Study questions</strong>
						<small>What blocks the first session?</small>
					</div>
					<div className="landing-sticky-note" data-tone="gold">
						<strong>UI ideas</strong>
						<small>Keep evidence docked beside drafts</small>
					</div>
					<div className="landing-sticky-note" data-tone="sky">
						<strong>Research clips</strong>
						<small>3 call excerpts worth revisiting</small>
					</div>
					<div className="landing-sticky-note" data-tone="peach">
						<strong>Next steps</strong>
						<small>Summarize friction, map options</small>
					</div>
					<div className="landing-cluster-thumb landing-cluster-thumb-voice">
						<p>Voice memo</p>
						<span>"Need one place for notes + plan."</span>
					</div>
				</div>
			</article>

			<article
				className="landing-board-card landing-board-note-card"
				data-chapter="capture"
				data-active={activeChapterId === 'capture' ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip">Markdown</span>
					<span className="landing-meta">Saved note</span>
				</div>
				<h2 className="landing-card-title">Course notes, links, and half-formed ideas</h2>
				<p className="landing-card-copy">
					Capture raw thinking first, then decide what deserves more structure.
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

			<article
				className="landing-board-card landing-board-links-card"
				data-chapter="capture"
				data-active={activeChapterId === 'capture' ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Links</span>
					<span className="landing-meta">Quick saves</span>
				</div>
				<div className="landing-links-list" aria-hidden="true">
					<span>loom.com/share/onboarding-friction</span>
					<span>docs.google.com/research-synthesis</span>
					<span>figma.com/file/new-first-run-flow</span>
				</div>
				<div className="landing-board-source-badges" aria-hidden="true">
					<div className="landing-board-logo-chip">
						<BoardLogo kind="loom" />
						<span>Loom</span>
					</div>
					<div className="landing-board-logo-chip">
						<BoardLogo kind="figma" />
						<span>Figma</span>
					</div>
					<div className="landing-board-logo-chip">
						<BoardLogo kind="notion" />
						<span>Notion</span>
					</div>
				</div>
			</article>

			{/* Flow connector */}
			<div className="landing-flow-connector landing-flow-capture-to-research" aria-hidden="true">
				<svg viewBox="0 0 200 60" preserveAspectRatio="none">
					<path d="M0 40 Q50 20, 100 30 T200 25" />
				</svg>
			</div>

			{/* ===== CHAPTER 2: RESEARCH ZONE ===== */}
			<article
				className="landing-board-card landing-board-research-card"
				data-chapter="research"
				data-active={activeChapterId === 'research' ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Research</span>
					<span className="landing-meta">Source stack</span>
				</div>
				<h2 className="landing-card-title">Evidence beside the board</h2>
				<p className="landing-card-copy">
					Compare clips, summaries, and unanswered questions without switching context.
				</p>
				<div className="landing-research-rows" aria-hidden="true">
					<div className="landing-research-row">
						<strong>User interviews</strong>
						<span>Patterns from support calls</span>
					</div>
					<div className="landing-research-row">
						<strong>Competitor notes</strong>
						<span>Pricing, onboarding, and empty states</span>
					</div>
					<div className="landing-research-row">
						<strong>Open questions</strong>
						<span>Where adoption drops after first setup</span>
					</div>
				</div>
				<div className="landing-research-tags" aria-hidden="true">
					<span>Problem framing</span>
					<span>Signals</span>
					<span>Quotes</span>
				</div>
			</article>

			<article
				className="landing-board-card landing-board-signal-card"
				data-chapter="research"
				data-active={activeChapterId === 'research' ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip">Snapshot</span>
					<span className="landing-meta">Signal check</span>
				</div>
				<div className="landing-signal-meter" aria-hidden="true">
					<div>
						<strong>Setup friction</strong>
						<span>High signal</span>
					</div>
					<div>
						<strong>Context switching</strong>
						<span>Repeated complaint</span>
					</div>
				</div>
			</article>

			{/* ===== WEB EMBED - Video Tutorial ===== */}
			<article
				className="landing-board-card landing-board-embed-card"
				data-chapter="research"
				data-active={activeChapterId === 'research' ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Embed</span>
					<span className="landing-meta">Reference video</span>
				</div>
				<div className="landing-embed-player">
					<div className="landing-embed-screen">
						<div className="landing-embed-tutorial">
							<div className="landing-tutorial-step active">
								<div className="landing-tutorial-icon">1</div>
								<div className="landing-tutorial-text">
									<span>Create your first board</span>
									<div className="landing-tutorial-bar" />
								</div>
							</div>
							<div className="landing-tutorial-step">
								<div className="landing-tutorial-icon">2</div>
								<div className="landing-tutorial-text">
									<span>Add sticky notes</span>
									<div className="landing-tutorial-bar" />
								</div>
							</div>
							<div className="landing-tutorial-step">
								<div className="landing-tutorial-icon">3</div>
								<div className="landing-tutorial-text">
									<span>Share with your team</span>
									<div className="landing-tutorial-bar" />
								</div>
							</div>
						</div>
						<div className="landing-embed-progress">
							<div className="landing-embed-progress-bar" />
						</div>
					</div>
					<div className="landing-embed-controls">
						<button className="landing-embed-btn" type="button">
							<svg viewBox="0 0 24 24" fill="currentColor">
								<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
							</svg>
						</button>
						<span className="landing-embed-time">1:24 / 3:45</span>
						<button className="landing-embed-btn" type="button">
							<svg viewBox="0 0 24 24" fill="currentColor">
								<path d="M16 5v14h4V5h-4zM6 19h4V5H6v14z" />
							</svg>
						</button>
					</div>
				</div>
			</article>

			{/* Flow connector */}
			<div className="landing-flow-connector landing-flow-research-to-plan" aria-hidden="true">
				<svg viewBox="0 0 180 60" preserveAspectRatio="none">
					<path d="M0 25 Q45 45, 90 30 T180 35" />
				</svg>
			</div>

			{/* ===== CHAPTER 3: PLAN ZONE ===== */}
			<article
				className="landing-board-card landing-board-kanban-card"
				data-chapter="plan"
				data-active={activeChapterId === 'plan' ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip">Kanban</span>
					<span className="landing-meta">Execution plan</span>
				</div>
				<h2 className="landing-card-title">From findings to next actions</h2>
				<div className="landing-kanban-grid" aria-hidden="true">
					<div className="landing-kanban-column">
						<p>Backlog</p>
						<span>Refine interview themes</span>
						<span>Review onboarding friction</span>
					</div>
					<div className="landing-kanban-column">
						<p>In progress</p>
						<span>Draft launch narrative</span>
						<span>Score opportunities</span>
					</div>
					<div className="landing-kanban-column">
						<p>Ready to ship</p>
						<span>Write release brief</span>
						<span>Sign off prototype</span>
					</div>
				</div>
			</article>

			<article
				className="landing-board-card landing-board-timeline-card"
				data-chapter="plan"
				data-active={activeChapterId === 'plan' ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Timeline</span>
					<span className="landing-meta">Milestones</span>
				</div>
				<div className="landing-timeline" aria-hidden="true">
					<span>Research synthesis</span>
					<span>Scope lock</span>
					<span>Prototype review</span>
					<span>Launch prep</span>
				</div>
			</article>

			<article
				className="landing-board-card landing-board-decision-card"
				data-chapter="plan"
				data-active={activeChapterId === 'plan' ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Decision</span>
					<span className="landing-meta">Working direction</span>
				</div>
				<p className="landing-decision-text">
					Keep capture, research, and planning visible together instead of forcing a handoff.
				</p>
			</article>

			{/* Flow connector */}
			<div className="landing-flow-connector landing-flow-plan-to-polish" aria-hidden="true">
				<svg viewBox="0 0 200 60" preserveAspectRatio="none">
					<path d="M0 30 Q50 15, 100 25 T200 20" />
				</svg>
			</div>

			{/* ===== CHAPTER 4: POLISH ZONE ===== */}
			<article
				className="landing-board-card landing-board-doc-card"
				data-chapter="polish"
				data-active={activeChapterId === 'polish' ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip">Brief</span>
					<span className="landing-meta">Polished artifact</span>
				</div>
				<h2 className="landing-card-title">A board that can also present the answer</h2>
				<p className="landing-card-copy">
					Write the decision memo with the raw context still visible around it.
				</p>
				<div className="landing-doc-lines" aria-hidden="true">
					<span className="landing-doc-line landing-doc-line-strong" />
					<span className="landing-doc-line" />
					<span className="landing-doc-line" />
					<span className="landing-doc-line landing-doc-line-short" />
					<span className="landing-doc-line" />
				</div>
			</article>

			{/* ===== RICH TEXT DOCUMENT ===== */}
			<article
				className="landing-board-card landing-board-richdoc-card"
				data-chapter="polish"
				data-active={activeChapterId === 'polish' ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Document</span>
					<span className="landing-meta">Full editor</span>
				</div>
				<div className="landing-richdoc-content" aria-hidden="true">
					<div className="landing-richdoc-heading">Product Strategy Q2</div>
					<div className="landing-richdoc-paragraph">
						<span className="landing-richdoc-bold">Objective:</span> Reduce time-to-value by 40% through improved onboarding.
					</div>
					<div className="landing-richdoc-list">
						<div className="landing-richdoc-item">Simplify first-run experience</div>
						<div className="landing-richdoc-item">Add contextual tooltips</div>
						<div className="landing-richdoc-item">Create template library</div>
					</div>
					<div className="landing-richdoc-quote">
						"Users who complete the new onboarding are 3x more likely to become paying customers."
					</div>
					<div className="landing-richdoc-toolbar">
						<span>B</span>
						<span>I</span>
						<span>U</span>
						<span>•</span>
						<span>1.</span>
						<span>❝</span>
					</div>
				</div>
			</article>

			{/* ===== IMPROVED PROTOTYPE ===== */}
			<article
				className="landing-board-card landing-board-prototype-card"
				data-chapter="polish"
				data-active={activeChapterId === 'polish' ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Prototype</span>
					<span className="landing-meta">Screen strip</span>
				</div>
				<div className="landing-prototype-strip" aria-hidden="true">
					<div className="landing-prototype-frame">
						<div className="landing-prototype-header">
							<div className="landing-prototype-dot" />
							<div className="landing-prototype-dot" />
							<div className="landing-prototype-dot" />
						</div>
						<div className="landing-prototype-body">
							<div className="landing-prototype-content">
								<div className="landing-prototype-line" />
								<div className="landing-prototype-line short" />
								<div className="landing-prototype-button">Get started</div>
							</div>
						</div>
					</div>
					<div className="landing-prototype-frame">
						<div className="landing-prototype-header">
							<div className="landing-prototype-dot" />
							<div className="landing-prototype-dot" />
							<div className="landing-prototype-dot" />
						</div>
						<div className="landing-prototype-body">
							<div className="landing-prototype-sidebar" />
							<div className="landing-prototype-main">
								<div className="landing-prototype-card" />
								<div className="landing-prototype-card" />
							</div>
						</div>
					</div>
					<div className="landing-prototype-frame">
						<div className="landing-prototype-header">
							<div className="landing-prototype-dot" />
							<div className="landing-prototype-dot" />
							<div className="landing-prototype-dot" />
						</div>
						<div className="landing-prototype-body center">
							<div className="landing-prototype-success">✓</div>
							<div className="landing-prototype-complete">All set!</div>
						</div>
					</div>
				</div>
			</article>

			{/* Flow connector */}
			<div className="landing-flow-connector landing-flow-polish-to-waitlist" aria-hidden="true">
				<svg viewBox="0 0 180 100" preserveAspectRatio="none">
					<path d="M0 80 Q45 70, 90 45 T160 20" />
				</svg>
			</div>

			{/* ===== WAITLIST ===== */}
			<form
				aria-label="Landing waitlist form"
				className="landing-board-card landing-board-waitlist-card"
				data-chapter="waitlist"
				data-active={activeChapterId === 'waitlist' ? 'true' : undefined}
				onSubmit={onWaitlistSubmit}
			>
				<div className="landing-card-topline">
					<span className="landing-chip">Waitlist</span>
					<span className="landing-meta">Opening access</span>
				</div>
				<h2 className="landing-card-title">Join the waitlist</h2>
				<p className="landing-card-copy">
					Get early access when RoopStudio opens its first release wave.
				</p>
				<label className="landing-board-form-label" htmlFor="landing-board-email">
					Work email
				</label>
				<input
					id="landing-board-email"
					autoComplete="email"
					className="landing-board-input"
					name="email"
					onChange={(event) => onEmailChange(event.target.value)}
					placeholder="name@company.com"
					type="email"
					value={email}
				/>
				<button
					className="landing-board-submit"
					disabled={waitlistStatus === 'submitting'}
					type="submit"
				>
					{waitlistStatus === 'submitting' ? 'Requesting...' : 'Request access'}
				</button>
				{waitlistMessage ? (
					<p className="landing-board-message" data-status={waitlistStatus}>
						{waitlistMessage}
					</p>
				) : null}
			</form>
		</>
	);
}
