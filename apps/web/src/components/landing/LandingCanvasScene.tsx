import type { CSSProperties, FormEventHandler } from 'react';
import { CanvasBoard } from './CanvasBoard';
import { CanvasToolbar } from './CanvasToolbar';
import type { LandingStoryChapter } from './landing-content';

type LandingCanvasSceneProps = {
	activeChapter: LandingStoryChapter;
	activeProgressChapterId: string;
	boardStyle: CSSProperties;
	chapters: LandingStoryChapter[];
	email: string;
	waitlistMessage: string | null;
	waitlistStatus: 'idle' | 'submitting' | 'success' | 'error';
	onEmailChange: (value: string) => void;
	onWaitlistSubmit: FormEventHandler<HTMLFormElement>;
};

export function LandingCanvasScene({
	activeChapter,
	activeProgressChapterId,
	boardStyle,
	chapters,
	email,
	waitlistMessage,
	waitlistStatus,
	onEmailChange,
	onWaitlistSubmit,
}: LandingCanvasSceneProps) {
	return (
		<div className="landing-canvas-shell">
			<CanvasToolbar />

			<div className="landing-canvas-hud">
				<div>
					<p>{activeChapter.eyebrow}</p>
					<h2>{activeChapter.title}</h2>
					<span>{activeChapter.description}</span>
				</div>
			</div>

			<div className="landing-canvas-viewport">
				<div className="landing-canvas-board" style={boardStyle}>
					<CanvasBoard
						activeChapterId={activeChapter.id}
						email={email}
						onEmailChange={onEmailChange}
						onWaitlistSubmit={onWaitlistSubmit}
						waitlistMessage={waitlistMessage}
						waitlistStatus={waitlistStatus}
					/>
				</div>
			</div>

			<div className="landing-canvas-footer">
				<span className="landing-canvas-footer-label">{activeChapter.label}</span>
				<div className="landing-canvas-pips" aria-hidden="true">
					{chapters.map((chapter) => (
						<span
							key={chapter.id}
							data-active={chapter.id === activeProgressChapterId ? 'true' : undefined}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
