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
import type { JSX } from 'react';
import ImageComponent from './ImageComponent';

export interface ImagePayload {
	altText: string;
	height?: number;
	key?: NodeKey;
	maxWidth?: number;
	src: string;
	width?: number;
}

type SerializedImageNode = Spread<
	{
		altText: string;
		height?: number;
		maxWidth: number;
		src: string;
		width?: number;
		type: 'image';
		version: 1;
	},
	SerializedLexicalNode
>;

function $convertImageElement(domNode: Node): DOMConversionOutput | null {
	const image = domNode as HTMLImageElement;
	const src = image.getAttribute('src');
	if (!src || src.startsWith('file:///')) return null;

	return {
		node: $createImageNode({
			altText: image.alt,
			height: image.height,
			src,
			width: image.width,
		}),
	};
}

export class ImageNode extends DecoratorNode<JSX.Element> {
	__src: string;
	__altText: string;
	__width: 'inherit' | number;
	__height: 'inherit' | number;
	__maxWidth: number;

	static getType(): string {
		return 'image';
	}

	static clone(node: ImageNode): ImageNode {
		return new ImageNode(
			node.__src,
			node.__altText,
			node.__maxWidth,
			node.__width,
			node.__height,
			node.__key,
		);
	}

	static importJSON(serializedNode: SerializedImageNode): ImageNode {
		return $createImageNode({
			altText: serializedNode.altText,
			height: serializedNode.height,
			maxWidth: serializedNode.maxWidth,
			src: serializedNode.src,
			width: serializedNode.width,
		});
	}

	static importDOM(): DOMConversionMap | null {
		return {
			img: () => ({
				conversion: $convertImageElement,
				priority: 0,
			}),
		};
	}

	constructor(
		src: string,
		altText: string,
		maxWidth: number,
		width?: 'inherit' | number,
		height?: 'inherit' | number,
		key?: NodeKey,
	) {
		super(key);
		this.__src = src;
		this.__altText = altText;
		this.__maxWidth = maxWidth;
		this.__width = width || 'inherit';
		this.__height = height || 'inherit';
	}

	exportJSON(): SerializedImageNode {
		return {
			...super.exportJSON(),
			altText: this.__altText,
			height: this.__height === 'inherit' ? 0 : this.__height,
			maxWidth: this.__maxWidth,
			src: this.__src,
			type: 'image',
			version: 1,
			width: this.__width === 'inherit' ? 0 : this.__width,
		};
	}

	createDOM(config: EditorConfig): HTMLElement {
		const span = document.createElement('span');
		const className = config.theme.image;
		if (className) span.className = className;
		return span;
	}

	exportDOM(): DOMExportOutput {
		const img = document.createElement('img');
		img.setAttribute('src', this.__src);
		img.setAttribute('alt', this.__altText);
		img.setAttribute('width', this.__width.toString());
		img.setAttribute('height', this.__height.toString());
		return { element: img };
	}

	updateDOM(): false {
		return false;
	}

	setWidthAndHeight(width: 'inherit' | number, height: 'inherit' | number): void {
		const writable = this.getWritable();
		writable.__width = width;
		writable.__height = height;
	}

	decorate(): JSX.Element {
		return (
			<ImageComponent
				src={this.__src}
				altText={this.__altText}
				width={this.__width}
				height={this.__height}
				maxWidth={this.__maxWidth}
				nodeKey={this.getKey()}
				onResize={(width, height) => this.setWidthAndHeight(width, height)}
				resizable
			/>
		);
	}
}

export function $createImageNode({
	altText,
	height,
	maxWidth = 760,
	src,
	width,
	key,
}: ImagePayload): ImageNode {
	return $applyNodeReplacement(new ImageNode(src, altText, maxWidth, width, height, key));
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
	return node instanceof ImageNode;
}
