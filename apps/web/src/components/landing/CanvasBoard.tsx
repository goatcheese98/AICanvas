import type { FormEventHandler } from 'react';
import { CanvasStage } from './CanvasStage';
import { IntroChapter } from './IntroChapter';
import { CaptureChapter } from './CaptureChapter';
import { ResearchChapter } from './ResearchChapter';
import { PlanChapter } from './PlanChapter';
import { PolishChapter } from './PolishChapter';
import { WaitlistSection } from './WaitlistSection';

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
			<CanvasStage />
			<IntroChapter active={activeChapterId === 'intro'} />
			<CaptureChapter active={activeChapterId === 'capture'} />
			<ResearchChapter active={activeChapterId === 'research'} />
			<PlanChapter active={activeChapterId === 'plan'} />
			<PolishChapter active={activeChapterId === 'polish'} />
			<WaitlistSection
				email={email}
				waitlistMessage={waitlistMessage}
				waitlistStatus={waitlistStatus}
				onEmailChange={onEmailChange}
				onWaitlistSubmit={onWaitlistSubmit}
				active={activeChapterId === 'waitlist'}
			/>
		</>
	);
}
