import type { CanvasElement } from '@ai-canvas/shared/types';
import { MessageCard } from './AIChatArtifacts';
import { AIChatRunStatus } from './AIChatRunStatus';
import type { AIChatMessageListProps } from './ai-chat-panel-types';

interface ExtendedAIChatMessageListProps extends AIChatMessageListProps {
	isChatLoading: boolean;
}

/**
 * Renders the list of chat messages and run status.
 */
export function AIChatMessageList({
	messages,
	elements,
	canvasActions,
	runProgress,
	isRunProgressExpanded,
	setIsRunProgressExpanded,
	latestMessage,
	setChatError,
	isChatLoading,
}: ExtendedAIChatMessageListProps) {
	const shouldAppendRunStatusToLatestMessage =
		runProgress !== null &&
		(runProgress.status === 'completed' || runProgress.status === 'failed') &&
		latestMessage?.role === 'assistant';

	const handleInsertArtifact = async (
		artifactKey: string,
		artifact: Parameters<typeof canvasActions.insertArtifactOnCanvas>[0],
	) => {
		const insertionState = await canvasActions.insertArtifactOnCanvas(artifact);
		if (insertionState) {
			canvasActions.rememberInsertionState(artifactKey, insertionState);
		}
	};

	const handleVectorizeArtifact = async (
		artifactKey: string,
		artifact: Parameters<typeof canvasActions.vectorizeRasterAssetOnCanvas>[0],
	) => {
		const insertionState = await canvasActions.vectorizeRasterAssetOnCanvas(artifact);
		if (insertionState) {
			canvasActions.rememberInsertionState(artifactKey, insertionState);
		}
	};

	const handleInsertRenderedDiagram = async (
		artifactKey: string,
		inputForInsert: Parameters<typeof canvasActions.insertRenderedDiagramOnCanvas>[0],
	) => {
		const insertionState = await canvasActions.insertRenderedDiagramOnCanvas(inputForInsert);
		if (insertionState) {
			canvasActions.rememberInsertionState(artifactKey, insertionState);
		}
	};

	return (
		<div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3.5 px-4 py-4">
			{messages.map((message) => (
				<MessageCard
					key={message.id}
					message={message}
					elements={elements as unknown as CanvasElement[]}
					onInsertArtifact={(artifactKey, artifact) =>
						void handleInsertArtifact(artifactKey, artifact)
					}
					onVectorizeArtifact={(artifactKey, artifact) =>
						void handleVectorizeArtifact(artifactKey, artifact)
					}
					insertionStates={canvasActions.assistantInsertionStates}
					onUndoInsertedArtifact={canvasActions.removeInsertedArtifact}
					onInsertMarkdown={(nextMessage) =>
						void canvasActions.insertMarkdownOnCanvas(nextMessage.content)
					}
					onInsertPrototype={(nextMessage) =>
						void canvasActions.insertPrototypeOnCanvas(nextMessage.content)
					}
					onInsertSvg={(nextMessage) => {
						const svgMarkup = nextMessage.content.match(/```svg\s*([\s\S]*?)```/i)?.[1]?.trim();
						if (!svgMarkup) {
							setChatError('This assistant message does not contain SVG markup.');
							return;
						}
						void (async () => {
							const insertionState = await canvasActions.insertSvgMarkupOnCanvas(svgMarkup);
							if (insertionState) {
								canvasActions.rememberInsertionState(
									`${nextMessage.id}-svg-inline`,
									insertionState,
								);
							}
						})();
					}}
					onInsertRenderedDiagram={(artifactKey, inputForInsert) =>
						void handleInsertRenderedDiagram(artifactKey, inputForInsert)
					}
					patchStates={canvasActions.assistantPatchStates}
					markdownPatchReviewStates={canvasActions.markdownPatchReviewStates}
					onChangeMarkdownAcceptedHunks={canvasActions.updateMarkdownPatchAcceptedHunks}
					onApplyPatch={(artifactKey, artifact, options) =>
						canvasActions.applyAssistantPatch(artifactKey, artifact, 'apply', options)
					}
					onUndoPatch={(artifactKey) => canvasActions.undoAssistantPatch(artifactKey)}
					onReapplyPatch={(artifactKey, artifact, options) =>
						canvasActions.applyAssistantPatch(artifactKey, artifact, 'reapply', options)
					}
					headerAccessory={
						shouldAppendRunStatusToLatestMessage && latestMessage?.id === message.id ? (
							<AIChatRunStatus
								runProgress={runProgress}
								isExpanded={isRunProgressExpanded}
								onToggleExpanded={() => setIsRunProgressExpanded((current) => !current)}
								variant="inline-trigger"
							/>
						) : undefined
					}
					headerDetails={
						shouldAppendRunStatusToLatestMessage && latestMessage?.id === message.id ? (
							<AIChatRunStatus
								runProgress={runProgress}
								isExpanded={isRunProgressExpanded}
								onToggleExpanded={() => setIsRunProgressExpanded((current) => !current)}
								variant="inline-panel"
							/>
						) : undefined
					}
				/>
			))}

			{runProgress && !shouldAppendRunStatusToLatestMessage ? (
				<AIChatRunStatus
					runProgress={runProgress}
					isExpanded={isRunProgressExpanded}
					onToggleExpanded={() => setIsRunProgressExpanded((current) => !current)}
				/>
			) : null}

			{isChatLoading && !runProgress ? (
				<div className="mr-auto rounded-[12px] border border-stone-200 bg-white px-4 py-3 text-[12px] text-stone-500">
					Planning and running...
				</div>
			) : null}
		</div>
	);
}
