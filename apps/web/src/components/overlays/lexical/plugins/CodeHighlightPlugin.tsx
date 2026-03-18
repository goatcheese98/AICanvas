import { useMountEffect } from '@/hooks/useMountEffect';
import { registerCodeHighlighting } from '@lexical/code';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

export default function CodeHighlightPlugin() {
	const [editor] = useLexicalComposerContext();

	useMountEffect(() => registerCodeHighlighting(editor));

	return null;
}
