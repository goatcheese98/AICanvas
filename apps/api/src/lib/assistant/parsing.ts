export function extractCodeBlock(text: string, language: string): string | null {
	const pattern = new RegExp(`\`\`\`${language}\\s*\\n([\\s\\S]*?)\\n\`\`\``, 'i');
	const match = text.match(pattern);
	return match?.[1]?.trim() || null;
}

export function buildConversationPrompt(history: Array<{ role: string; text: string }>): string {
	return history.map((item) => `${item.role.toUpperCase()}: ${item.text}`).join('\n\n');
}

export function buildMermaidPrompt(userText: string): string {
	return [
		'Generate only Mermaid syntax for an Excalidraw-ready diagram.',
		'Rules:',
		'- Return only a single Mermaid code block.',
		'- Prefer flowchart TD unless the user asks otherwise.',
		'- Keep labels concise.',
		'- The app renders Mermaid directly. Do not mention external editors, CLI tools, or rendering limitations.',
		'',
		`Request: ${userText}`,
	].join('\n');
}

export function buildMermaidEditPrompt(userText: string, currentSource: string): string {
	return [
		'Update the existing Mermaid diagram.',
		'Rules:',
		'- Return only a single Mermaid code block.',
		'- Return the full updated diagram, not a diff or explanation.',
		'- Preserve the current subject unless the request explicitly changes it.',
		'- The app renders Mermaid directly. Do not mention external editors, CLI tools, or rendering limitations.',
		'',
		'Current Mermaid source:',
		'```mermaid',
		currentSource,
		'```',
		'',
		`Edit request: ${userText}`,
	].join('\n');
}

export function buildD2Prompt(userText: string): string {
	return [
		'Generate only D2 syntax for a clean architecture/flow diagram.',
		'Rules:',
		'- Return only a single d2 code block.',
		'- Keep IDs short and deterministic.',
		'- Use arrows for relationships.',
		'- The app renders D2 directly. Do not mention external editors, CLI tools, or rendering limitations.',
		'',
		`Request: ${userText}`,
	].join('\n');
}

export function buildD2EditPrompt(userText: string, currentSource: string): string {
	return [
		'Update the existing D2 diagram.',
		'Rules:',
		'- Return only a single d2 code block.',
		'- Return the full updated diagram, not a diff or explanation.',
		'- Preserve the current subject unless the request explicitly changes it.',
		'- Use arrows for relationships.',
		'- The app renders D2 directly. Do not mention external editors, CLI tools, or rendering limitations.',
		'',
		'Current D2 source:',
		'```d2',
		currentSource,
		'```',
		'',
		`Edit request: ${userText}`,
	].join('\n');
}

export function buildKanbanPrompt(userText: string): string {
	return [
		'Generate only JSON kanban operations.',
		'Rules:',
		'- Return a single json code block.',
		'- Use operations like add_column, add_card, update_card, move_card.',
		'- Keep titles short and practical.',
		'',
		`Request: ${userText}`,
	].join('\n');
}

export function buildMarkdownRewritePrompt(
	userText: string,
	currentMarkdown: string,
): string {
	return [
		'Rewrite the selected markdown note to satisfy the edit request.',
		'Rules:',
		'- Return only a single markdown code block.',
		'- Return the full updated document, not a diff and not an explanation.',
		'- Preserve unrelated sections, formatting, and checklist structure unless the request changes them.',
		'- If the user asks to remove a section or list items, delete them from the document instead of adding commentary about the request.',
		'- Do not quote or paraphrase the user request inside the markdown unless the note itself should explicitly contain that wording.',
		'',
		'Current markdown:',
		'```markdown',
		currentMarkdown,
		'```',
		'',
		`Edit request: ${userText}`,
	].join('\n');
}

export function buildPrototypePrompt(
	userText: string,
	currentPrototypeJson?: string,
): string {
	return [
		'Generate only JSON for the prototype tooling.',
		'Rules:',
		'- Return a single json code block.',
		'- The JSON must include: title, template, activeFile, dependencies, preview, files.',
		'- For React prototypes include /App.jsx, /index.jsx, and /styles.css.',
		'- files must be the complete post-edit file map, not a partial patch.',
		'- Update both JSX and CSS when the request changes structure and styling.',
		'- Replace any starter content entirely. Do not reuse PulseBoard, launch/pipeline/ops tabs, or the default template copy unless the user explicitly asks for them.',
		'- Make the JSX and CSS clearly reflect the request subject, industry, and page structure.',
		'- Keep dependencies limited to react, react-dom/client, framer-motion, lucide-react, @radix-ui/react-dialog, @radix-ui/react-tabs.',
		'- preview must include: eyebrow, title, description, accent, background, badges, metrics.',
		'',
		`Request: ${userText}`,
		...(currentPrototypeJson
			? ['', 'Current selected prototype context:', currentPrototypeJson]
			: []),
	].join('\n');
}
