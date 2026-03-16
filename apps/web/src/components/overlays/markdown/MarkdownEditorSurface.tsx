import { memo } from 'react';
import type { MarkdownNoteSettings, MarkdownOverlayCustomData } from '@ai-canvas/shared/types';
import { MarkdownHybridEditor } from './MarkdownHybridEditor';
import { MarkdownPlainEditor } from './MarkdownPlainEditor';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MarkdownEditorSurfaceProps {
	content: string;
	images: Record<string, string>;
	settings: MarkdownNoteSettings;
	editorMode: MarkdownOverlayCustomData['editorMode'];
	isPreview: boolean;
	onContentChange: (value: string | ((current: string) => string)) => void;
	onImageAdd: (id: string, dataUrl: string) => void;
	onEditorCheckboxToggle: (lineIndex: number) => void;
	onPreviewCheckboxToggle: (lineIndex: number) => void;
}

export const MarkdownEditorSurface = memo(function MarkdownEditorSurface({
	content,
	images,
	settings,
	editorMode,
	isPreview,
	onContentChange,
	onImageAdd,
	onEditorCheckboxToggle,
	onPreviewCheckboxToggle,
}: MarkdownEditorSurfaceProps) {
	if (!isPreview) {
		if (editorMode === 'hybrid') {
			return (
				<MarkdownHybridEditor
					content={content}
					images={images}
					settings={settings}
					onChange={(nextValue) => onContentChange(nextValue)}
					onImageAdd={onImageAdd}
					onCheckboxToggle={onEditorCheckboxToggle}
				/>
			);
		}

		return (
			<MarkdownPlainEditor
				value={content}
				images={images}
				settings={settings}
				onChange={(nextValue) => onContentChange(nextValue)}
				onImageAdd={onImageAdd}
			/>
		);
	}

	return (
		<div className="h-full overflow-auto p-4">
			<MarkdownRenderer
				content={content}
				images={images}
				settings={settings}
				onCheckboxToggle={onPreviewCheckboxToggle}
			/>
		</div>
	);
});
