import type { MarkdownNoteSettings } from '@ai-canvas/shared/types';
import { handleImagePasteAsMarkdown } from './markdown-media';

interface MarkdownPlainEditorProps {
	value: string;
	images?: Record<string, string>;
	settings: MarkdownNoteSettings;
	onChange: (value: string) => void;
	onImageAdd: (id: string, dataUrl: string) => void;
}

export function MarkdownPlainEditor({
	value,
	settings,
	onChange,
	onImageAdd,
}: MarkdownPlainEditorProps) {
	return (
		<textarea
			autoFocus
			value={value}
			onChange={(event) => onChange(event.target.value)}
			onPaste={(event) => {
				void handleImagePasteAsMarkdown({
					event,
					value,
					onChange,
					onImageAdd,
				});
			}}
			className="h-full w-full resize-none border-0 bg-transparent p-4 text-stone-900 outline-none"
			style={{
				fontFamily: settings.font,
				fontSize: `${settings.fontSize}px`,
				lineHeight: settings.lineHeight,
			}}
			placeholder="Write markdown..."
		/>
	);
}
