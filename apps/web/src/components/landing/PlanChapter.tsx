type PlanChapterProps = {
	active: boolean;
};

export function PlanChapter({ active }: PlanChapterProps) {
	return (
		<>
			<article
				className="landing-board-card landing-board-kanban-card"
				data-chapter="plan"
				data-active={active ? 'true' : undefined}
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
				data-active={active ? 'true' : undefined}
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
				data-active={active ? 'true' : undefined}
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
				<svg viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
					<path d="M0 30 Q50 15, 100 25 T200 20" />
				</svg>
			</div>
		</>
	);
}
