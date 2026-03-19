import { OverlaySurface } from '@/components/overlays/overlay-surface';
import { useAppStore } from '@/stores/store';
import { normalizeMarkdownOverlay } from '@ai-canvas/shared/schemas';
import { useMemo, useRef } from 'react';
import { OverlayExpandButton } from '../OverlayExpandButton';
import { MarkdownEditorSurface } from './MarkdownEditorSurface';
import { MarkdownNoteHeader } from './MarkdownNoteHeader';
import { MAX_MARKDOWN_TITLE_LENGTH, serializeOverlayState } from './markdown-note-helpers';
import type { MarkdownNoteProps } from './markdown-note-types';
import { useMarkdownNoteState } from './useMarkdownNoteState';

function MarkdownNoteStateful({
	element,
	mode,
	isSelected,
	isActive,
	onChange,
	onActivityChange,
	normalizedElement,
	sourceSignature,
}: MarkdownNoteProps & {
	normalizedElement: ReturnType<typeof normalizeMarkdownOverlay>;
	sourceSignature: string;
}) {
	const openExpandedOverlay = useAppStore((s) => s.openExpandedOverlay);
	const detachedPanelContainerRef = useRef<HTMLDivElement>(null);
	const state = useMarkdownNoteState({
		element,
		mode,
		isSelected,
		isActive,
		onChange,
		onActivityChange,
		normalizedElement,
		sourceSignature,
	});
	const shouldDetachUtilityPanel =
		mode !== 'shell' && (element.width < 980 || element.height < 720);
	const displaySettings = useMemo(
		() =>
			mode === 'shell'
				? {
						...state.settings,
						fontSize: Math.max(18, Math.min(24, state.settings.fontSize + 6)),
						lineHeight: Math.max(1.7, state.settings.lineHeight),
					}
				: state.settings,
		[mode, state.settings],
	);

	return (
		<div ref={detachedPanelContainerRef} className="relative h-full overflow-visible">
			<OverlaySurface
				element={element}
				isSelected={isSelected}
				backgroundColor={state.surfaceBackground}
				className="relative flex h-full flex-col"
			>
				{state.showHeader ? (
					<MarkdownNoteHeader
						title={state.title}
						titleNotice={state.titleNotice}
						hasLocalEdits={state.hasLocalEdits}
						isSelected={isSelected}
						compactTitle={state.compactTitle}
						controlsLayout={state.controlsLayout}
						activeMode={state.activeMode}
						showCompactControls={state.showCompactControls}
						activeUtilityPanel={state.activeUtilityPanel}
						headerRef={state.headerRef}
						utilityPanelRef={state.utilityPanelRef}
						detachedUtilityPanelRef={state.detachedUtilityPanelRef}
						surfaceBackground={state.surfaceBackground}
						strokeColor={element.strokeColor ?? '#111827'}
						strokeWidth={element.strokeWidth ?? 1}
						settings={state.settings}
						imageCount={Object.keys(state.images).length}
						detachUtilityPanel={shouldDetachUtilityPanel}
						detachedPanelContainer={detachedPanelContainerRef.current}
						isExpandedShell={mode === 'shell'}
						onTitleChange={state.handleTitleChange}
						onTitlePaste={(pasted, currentValueLength) => {
							if (currentValueLength + pasted.length > MAX_MARKDOWN_TITLE_LENGTH) {
								state.handleTitleChange(`${state.title}${pasted}`);
							}
						}}
						onTitleBlur={state.handleTitleBlur}
						onSelectMode={(mode) => {
							if (!isSelected) return;
							if (mode === 'preview') {
								state.handleCommit();
								state.setIsPreview(true);
								return;
							}
							state.setEditorMode(mode);
							state.setIsPreview(false);
						}}
						onActiveUtilityPanelChange={state.setActiveUtilityPanel}
						onSettingsChange={state.setSettings}
						onSurfaceStyleChange={state.handleSurfaceStyleChange}
						onRequestImagePicker={() => state.fileInputRef.current?.click()}
						onCompactControlsVisibilityChange={state.setIsCompactControlsVisible}
					/>
				) : null}

				<input
					ref={state.fileInputRef}
					type="file"
					accept="image/*"
					multiple
					className="hidden"
					onChange={(event) => {
						void state.insertImageFiles(event.target.files);
						event.currentTarget.value = '';
					}}
				/>

				<div
					className="min-h-0 flex-1"
					onDoubleClick={() => {
						if (isSelected && state.isPreview) state.setIsPreview(false);
					}}
				>
					<MarkdownEditorSurface
						content={state.content}
						images={state.images}
						settings={displaySettings}
						editorMode={state.editorMode}
						isPreview={state.isPreview}
						onContentChange={state.setContent}
						onImageAdd={(id, dataUrl) =>
							state.setImages((current) => ({ ...current, [id]: dataUrl }))
						}
						onEditorCheckboxToggle={state.handleEditorCheckboxToggle}
						onPreviewCheckboxToggle={state.handlePreviewCheckboxToggle}
					/>
				</div>

				{mode !== 'shell' && isSelected ? (
					<OverlayExpandButton onClick={() => openExpandedOverlay(element.id)} />
				) : null}
			</OverlaySurface>
		</div>
	);
}

export function MarkdownNoteContainer({
	element,
	mode,
	isSelected,
	isActive,
	onChange,
	onActivityChange,
}: MarkdownNoteProps) {
	const normalizedElement = useMemo(
		() => normalizeMarkdownOverlay(element.customData),
		[element.customData],
	);
	const sourceSignature = useMemo(
		() => serializeOverlayState(normalizedElement),
		[normalizedElement],
	);

	return (
		<MarkdownNoteStateful
			key={`${element.id}:${sourceSignature}`}
			element={element}
			mode={mode}
			isSelected={isSelected}
			isActive={isActive}
			onChange={onChange}
			onActivityChange={onActivityChange}
			normalizedElement={normalizedElement}
			sourceSignature={sourceSignature}
		/>
	);
}
