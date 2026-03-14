import { OverlaySurface } from '@/components/overlays/overlay-surface';
import { MAX_MARKDOWN_TITLE_LENGTH } from './markdown-note-helpers';
import { MarkdownEditorSurface } from './MarkdownEditorSurface';
import { MarkdownNoteHeader } from './MarkdownNoteHeader';
import type { MarkdownNoteProps } from './markdown-note-types';
import { useMarkdownNoteState } from './useMarkdownNoteState';

export function MarkdownNoteContainer({
	element,
	isSelected,
	onChange,
	onEditingChange,
}: MarkdownNoteProps) {
	const state = useMarkdownNoteState({ element, isSelected, onChange, onEditingChange });

	return (
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
					surfaceBackground={state.surfaceBackground}
					strokeColor={element.strokeColor ?? '#111827'}
					strokeWidth={element.strokeWidth ?? 1}
					roundness={element.roundness}
					settings={state.settings}
					imageCount={Object.keys(state.images).length}
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
					settings={state.settings}
					editorMode={state.editorMode}
					isPreview={state.isPreview}
					onContentChange={state.setContent}
					onImageAdd={(id, dataUrl) => state.setImages((current) => ({ ...current, [id]: dataUrl }))}
					onEditorCheckboxToggle={state.handleEditorCheckboxToggle}
					onPreviewCheckboxToggle={state.handlePreviewCheckboxToggle}
				/>
			</div>
		</OverlaySurface>
	);
}
