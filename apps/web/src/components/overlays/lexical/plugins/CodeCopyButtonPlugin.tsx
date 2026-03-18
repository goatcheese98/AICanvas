import { useMountEffect } from '@/hooks/useMountEffect';
import { $isCodeNode, CodeNode } from '@lexical/code';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey } from 'lexical';

const BTN_CLASS = 'canvas-code-copy';

function injectCopyButton(editor: ReturnType<typeof useLexicalComposerContext>[0], key: string) {
	const element = editor.getElementByKey(key);
	if (!element) return;

	element.querySelector(`.${BTN_CLASS}`)?.remove();

	const button = document.createElement('button');
	button.className = BTN_CLASS;
	button.type = 'button';
	button.textContent = 'Copy';

	button.addEventListener('mousedown', (event) => {
		event.preventDefault();
	});

	button.addEventListener('click', () => {
		editor.getEditorState().read(() => {
			const node = $getNodeByKey(key);
			if (!$isCodeNode(node)) return;
			const code = node.getTextContent();
			void navigator.clipboard.writeText(code).then(() => {
				button.textContent = 'Copied';
				button.classList.add('copied');
				setTimeout(() => {
					button.textContent = 'Copy';
					button.classList.remove('copied');
				}, 1500);
			});
		});
	});

	element.insertBefore(button, element.firstChild);
}

export default function CodeCopyButtonPlugin() {
	const [editor] = useLexicalComposerContext();

	useMountEffect(() =>
		editor.registerMutationListener(CodeNode, (mutations) => {
			for (const [key, mutation] of mutations) {
				if (mutation === 'destroyed') continue;
				requestAnimationFrame(() => injectCopyButton(editor, key));
			}
		}),
	);

	return null;
}
