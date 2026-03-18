import { useMountEffect } from '@/hooks/useMountEffect';
import { $isCodeNode, CodeNode } from '@lexical/code';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, $nodesOfType } from 'lexical';
import { detectCodeLanguage } from '../utils/detectCodeLanguage';

const DEBOUNCE_MS = 500;
const UPDATE_TAG = 'auto-lang-detect';

export default function AutoCodeLanguagePlugin() {
	const [editor] = useLexicalComposerContext();

	useMountEffect(() => {
		let timer: ReturnType<typeof setTimeout> | null = null;

		const unregister = editor.registerUpdateListener(({ tags }) => {
			if (tags.has(UPDATE_TAG)) return;
			if (timer) clearTimeout(timer);

			timer = setTimeout(() => {
				timer = null;
				const pending: Array<{ key: string; code: string }> = [];

				editor.getEditorState().read(() => {
					for (const node of $nodesOfType(CodeNode)) {
						if (!$isCodeNode(node) || node.getLanguage() !== 'auto') continue;
						const code = node.getTextContent();
						if (code.trim().length > 0) {
							pending.push({ key: node.getKey(), code });
						}
					}
				});

				if (pending.length === 0) return;

				const detections = pending
					.map(({ key, code }) => ({ key, lang: detectCodeLanguage(code) }))
					.filter((candidate): candidate is { key: string; lang: string } =>
						Boolean(candidate.lang),
					);

				if (detections.length === 0) return;

				editor.update(
					() => {
						for (const { key, lang } of detections) {
							const node = $getNodeByKey(key);
							if ($isCodeNode(node)) {
								node.setLanguage(lang);
							}
						}
					},
					{ tag: UPDATE_TAG },
				);
			}, DEBOUNCE_MS);
		});

		return () => {
			unregister();
			if (timer) clearTimeout(timer);
		};
	});

	return null;
}
