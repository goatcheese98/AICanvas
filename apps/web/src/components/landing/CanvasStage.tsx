/**
 * CanvasStage - Background sketch layer and ambient elements for the landing board.
 * Includes Excalidraw-style SVG decorations, zone labels, and ambient glows.
 */

export function CanvasStage() {
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
		</>
	);
}
