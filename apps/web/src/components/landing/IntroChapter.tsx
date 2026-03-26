type IntroChapterProps = {
	active: boolean;
};

export function IntroChapter({ active }: IntroChapterProps) {
	return (
		<article
			className="landing-board-card landing-board-intro-card"
			data-chapter="intro"
			data-active={active ? 'true' : undefined}
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
					<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
						<path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35Z" />
					</svg>
				</div>
				<div className="landing-intro-hint">Scroll to explore</div>
			</div>
		</article>
	);
}
