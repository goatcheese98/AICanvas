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
			<div className="landing-board-marker landing-board-marker-capture">rough capture</div>
			<div className="landing-board-marker landing-board-marker-research">research wall</div>
			<div className="landing-board-marker landing-board-marker-plan">planning lane</div>
			<div className="landing-board-marker landing-board-marker-polish">polished outputs</div>
			<div className="landing-board-marker landing-board-marker-waitlist">early access</div>

			<div className="landing-board-track landing-board-track-main" />
			<div className="landing-board-track landing-board-track-side" />
			<div className="landing-board-orb landing-board-orb-a" />
			<div className="landing-board-orb landing-board-orb-b" />
			<div className="landing-board-dots landing-board-dots-a" />
			<div className="landing-board-dots landing-board-dots-b" />

			<article className="landing-board-card landing-board-cluster-card">
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Canvas</span>
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

			<article className="landing-board-card landing-board-links-card">
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

			<div className="landing-board-links-arrow" aria-hidden="true">
				<svg viewBox="0 0 220 120">
					<path d="M18 100c22-32 64-51 113-58" />
					<path d="m123 31 20 9-18 12" />
				</svg>
				<span>saved sources</span>
			</div>

			<article className="landing-board-card landing-board-note-card">
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

			<article className="landing-board-card landing-board-research-card">
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

			<article className="landing-board-card landing-board-signal-card">
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

			<article className="landing-board-card landing-board-kanban-card">
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

			<article className="landing-board-card landing-board-timeline-card">
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

			<article className="landing-board-card landing-board-decision-card">
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Decision</span>
					<span className="landing-meta">Working direction</span>
				</div>
				<p className="landing-decision-text">
					Keep capture, research, and planning visible together instead of forcing a handoff.
				</p>
			</article>

			<div className="landing-board-plan-flow" aria-hidden="true">
				<div className="landing-board-flow-shape landing-board-flow-shape-rect">
					<span>collect</span>
				</div>
				<div className="landing-board-flow-shape landing-board-flow-shape-diamond">
					<span>shape</span>
				</div>
				<div className="landing-board-flow-shape landing-board-flow-shape-ellipse">
					<span>ship</span>
				</div>
				<svg className="landing-board-flow-connector" viewBox="0 0 340 120">
					<path d="M40 58h106" />
					<path d="M196 58h92" />
					<path d="m136 50 12 8-12 8" />
					<path d="m278 50 12 8-12 8" />
				</svg>
			</div>

			<article className="landing-board-card landing-board-doc-card">
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

			<article className="landing-board-card landing-board-prototype-card">
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Prototype</span>
					<span className="landing-meta">Screen strip</span>
				</div>
				<div className="landing-prototype-strip" aria-hidden="true">
					<div />
					<div />
					<div />
				</div>
			</article>

			<form
				aria-label="Landing waitlist form"
				className="landing-board-card landing-board-waitlist-card"
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
