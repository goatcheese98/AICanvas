import {
	type D2RenderVariant,
	downloadBlob,
	renderCodeArtifactToSvg,
	svgToPngBlob,
} from '@/lib/assistant/diagram-renderer';
import type { AssistantArtifact } from '@ai-canvas/shared/types';
import { useEffect, useMemo, useState } from 'react';
import { CodeSnippet } from './AIChatArtifactPrimitives';
import { PANEL_BUTTON, PANEL_BUTTON_DANGER, PANEL_BUTTON_IDLE } from './ai-chat-constants';
import type { AssistantInsertionState, DiagramInsertInput } from './ai-chat-types';
import { getDiagramArtifactSource } from './assistant-artifacts';

export function DiagramArtifactCard({
	artifactKey,
	artifact,
	insertionState,
	onUndoInsertedArtifact,
	onInsertRenderedDiagram,
}: {
	artifactKey: string;
	artifact: AssistantArtifact;
	insertionState?: AssistantInsertionState;
	onUndoInsertedArtifact?: (artifactKey: string) => void;
	onInsertRenderedDiagram?: (artifactKey: string, input: DiagramInsertInput) => void;
}) {
	const diagram = useMemo(() => getDiagramArtifactSource(artifact), [artifact]);
	const [d2Variant, setD2Variant] = useState<D2RenderVariant>('default');
	const [rendered, setRendered] = useState<{
		svgMarkup: string;
		width: number;
		height: number;
	} | null>(null);
	const [renderError, setRenderError] = useState<string | null>(null);
	const [isRendering, setIsRendering] = useState(false);

	useEffect(() => {
		if (!diagram) {
			setRendered(null);
			setRenderError(null);
			return;
		}

		let isCurrent = true;
		setIsRendering(true);
		setRenderError(null);

		void renderCodeArtifactToSvg({
			language: diagram.language,
			code: diagram.code,
			d2Variant,
		})
			.then((result) => {
				if (isCurrent) {
					setRendered(result);
				}
			})
			.catch((error) => {
				if (isCurrent) {
					setRenderError(error instanceof Error ? error.message : 'Failed to render diagram');
					setRendered(null);
				}
			})
			.finally(() => {
				if (isCurrent) {
					setIsRendering(false);
				}
			});

		return () => {
			isCurrent = false;
		};
	}, [d2Variant, diagram]);

	if (!diagram) {
		return null;
	}

	const title = diagram.language === 'mermaid' ? 'Mermaid Diagram' : 'D2 Diagram';

	return (
		<div className="rounded-[10px] border border-stone-200 bg-stone-50 p-3">
			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				<div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-stone-500">
					{title}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{diagram.language === 'd2' ? (
						<select
							value={d2Variant}
							onChange={(event) => setD2Variant(event.target.value as D2RenderVariant)}
							className={`h-8 rounded-[7px] border border-stone-300 bg-white px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-700 ${PANEL_BUTTON_IDLE}`}
						>
							<option value="default">Default</option>
							<option value="sketch">Sketch</option>
							<option value="ascii">Ascii</option>
						</select>
					) : null}
					{rendered && onInsertRenderedDiagram ? (
						insertionState?.status === 'inserted' ? (
							<>
								<div className="inline-flex h-8 items-center justify-center rounded-[7px] border border-emerald-200 bg-emerald-50 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
									Inserted Onto Canvas
								</div>
								{onUndoInsertedArtifact ? (
									<button
										type="button"
										onClick={() => onUndoInsertedArtifact(artifactKey)}
										className={`${PANEL_BUTTON} ${PANEL_BUTTON_DANGER}`}
									>
										Undo Insert
									</button>
								) : null}
							</>
						) : (
							<button
								type="button"
								onClick={() =>
									onInsertRenderedDiagram(artifactKey, {
										title,
										svgMarkup: rendered.svgMarkup,
										width: rendered.width,
										height: rendered.height,
										diagram: {
											language: diagram.language,
											code: diagram.code,
										},
									})
								}
								className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
							>
								Insert On Canvas
							</button>
						)
					) : null}
					{rendered ? (
						<>
							<button
								type="button"
								onClick={() =>
									downloadBlob(
										new Blob([rendered.svgMarkup], { type: 'image/svg+xml' }),
										`${diagram.language}${diagram.language === 'd2' ? `-${d2Variant}` : ''}.svg`,
									)
								}
								className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
							>
								Download SVG
							</button>
							<button
								type="button"
								onClick={async () => {
									const png = await svgToPngBlob(
										rendered.svgMarkup,
										rendered.width,
										rendered.height,
									);
									downloadBlob(
										png,
										`${diagram.language}${diagram.language === 'd2' ? `-${d2Variant}` : ''}.png`,
									);
								}}
								className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
							>
								Download PNG
							</button>
						</>
					) : null}
				</div>
			</div>
			<div className="overflow-hidden rounded-[10px] border border-stone-200 bg-white">
				{isRendering ? (
					<div className="px-4 py-10 text-center text-[12px] text-stone-500">
						Rendering diagram...
					</div>
				) : renderError ? (
					<div className="px-4 py-10 text-center text-[12px] text-rose-700">{renderError}</div>
				) : rendered ? (
					<div
						className="max-h-[320px] overflow-auto p-3"
						dangerouslySetInnerHTML={{ __html: rendered.svgMarkup }}
					/>
				) : null}
			</div>
			<details className="mt-3">
				<summary className="cursor-pointer text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-500">
					View Source
				</summary>
				<div className="mt-3">
					<CodeSnippet
						code={diagram.code}
						language={diagram.language === 'mermaid' ? 'Mermaid' : `D2 ${d2Variant}`}
						compact
					/>
				</div>
			</details>
		</div>
	);
}
