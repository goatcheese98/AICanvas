import katex from 'katex';
import {
	$applyNodeReplacement,
	type DOMConversionMap,
	type DOMConversionOutput,
	type DOMExportOutput,
	DecoratorNode,
	type EditorConfig,
	type LexicalNode,
	type NodeKey,
	type SerializedLexicalNode,
	type Spread,
} from 'lexical';
import React, { useMemo } from 'react';

type SerializedEquationNode = Spread<
	{
		equation: string;
		inline: boolean;
		type: 'equation';
		version: 1;
	},
	SerializedLexicalNode
>;

export class EquationNode extends DecoratorNode<React.JSX.Element> {
	__equation: string;
	__inline: boolean;

	static getType(): string {
		return 'equation';
	}

	static clone(node: EquationNode): EquationNode {
		return new EquationNode(node.__equation, node.__inline, node.__key);
	}

	static importJSON(serializedNode: SerializedEquationNode): EquationNode {
		return $createEquationNode(serializedNode.equation, serializedNode.inline);
	}

	static importDOM(): DOMConversionMap | null {
		return {
			div: () => ({
				conversion: $convertEquationElement,
				priority: 1,
			}),
			span: () => ({
				conversion: $convertEquationElement,
				priority: 1,
			}),
		};
	}

	constructor(equation: string, inline?: boolean, key?: NodeKey) {
		super(key);
		this.__equation = equation;
		this.__inline = inline ?? false;
	}

	exportJSON(): SerializedEquationNode {
		return {
			...super.exportJSON(),
			equation: this.__equation,
			inline: this.__inline,
			type: 'equation',
			version: 1,
		};
	}

	createDOM(): HTMLElement {
		const element = document.createElement(this.__inline ? 'span' : 'div');
		element.className = this.__inline ? 'canvas-inline-equation' : 'canvas-equation';
		return element;
	}

	exportDOM(): DOMExportOutput {
		const element = document.createElement(this.__inline ? 'span' : 'div');
		element.setAttribute('data-lexical-equation', this.__equation);
		element.setAttribute('data-lexical-inline', String(this.__inline));
		katex.render(this.__equation, element, {
			displayMode: !this.__inline,
			throwOnError: false,
			trust: false,
		});
		return { element };
	}

	updateDOM(_prevNode: EquationNode, _dom: HTMLElement, _config: EditorConfig): false {
		return false;
	}

	decorate(): React.JSX.Element {
		return React.createElement(EquationComponent, {
			equation: this.__equation,
			inline: this.__inline,
		});
	}
}

function EquationComponent({
	equation,
	inline,
}: {
	equation: string;
	inline: boolean;
}): React.JSX.Element {
	const renderedEquation = useMemo(() => {
		return katex.renderToString(equation, {
			displayMode: !inline,
			throwOnError: false,
			trust: false,
		});
	}, [equation, inline]);

	const Tag = inline ? 'span' : 'div';
	return React.createElement(Tag, {
		className: inline ? 'canvas-inline-equation' : 'canvas-equation',
		style: inline ? { display: 'inline-block' } : { margin: '1em 0' },
		dangerouslySetInnerHTML: { __html: renderedEquation },
	});
}

function $convertEquationElement(element: HTMLElement): DOMConversionOutput | null {
	const equation = element.getAttribute('data-lexical-equation');
	const inline = element.getAttribute('data-lexical-inline') === 'true';
	if (!equation) return null;
	return {
		node: $createEquationNode(equation, inline),
	};
}

export function $createEquationNode(equation: string, inline?: boolean): EquationNode {
	return $applyNodeReplacement(new EquationNode(equation, inline));
}

function $isEquationNode(node: LexicalNode | null | undefined): node is EquationNode {
	return node instanceof EquationNode;
}
