import mermaid from 'mermaid';

let isMermaidInitialized = false;

export async function renderMermaidToSvg(code: string): Promise<string> {
	const cleanCode = code
		.replace(/^```mermaid\s*\n?/i, '')
		.replace(/\n?```\s*$/i, '')
		.trim();

	if (!cleanCode) {
		throw new Error('Empty Mermaid code provided');
	}

	if (!isMermaidInitialized) {
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: 'loose',
			theme: 'neutral',
			flowchart: {
				curve: 'basis',
			},
		});
		isMermaidInitialized = true;
	}

	mermaid.mermaidAPI.globalReset();

	const renderId = `ai-canvas-mermaid-${crypto.randomUUID()}`;
	const { svg } = await mermaid.render(renderId, cleanCode);
	return svg.trim();
}
