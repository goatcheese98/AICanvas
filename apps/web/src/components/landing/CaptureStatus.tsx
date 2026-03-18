import type { CaptureStatusProps } from './canvas-tour-layout-utils';

export function CaptureStatus({ devCaptureStatus }: CaptureStatusProps) {
	if (!devCaptureStatus) return null;

	return <p className="canvas-tour-layout-status">{devCaptureStatus}</p>;
}
