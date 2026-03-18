import { CODE_LANGUAGE_FRIENDLY_NAME_MAP } from '@lexical/code';
import type { ReactElement } from 'react';
import { BLOCK_OPTIONS, NOTE_MONO_STACK } from './lexical-toolbar-types';
import type { BlockType } from './lexical-toolbar-types';

interface CodeLanguageSelectProps {
	codeLanguage: string;
	onChange: (language: string) => void;
}

export function CodeLanguageSelect({
	codeLanguage,
	onChange,
}: CodeLanguageSelectProps): ReactElement {
	return (
		<select
			value={codeLanguage}
			onChange={(event) => onChange(event.target.value)}
			onMouseDown={(event) => event.stopPropagation()}
			style={{
				height: 28,
				padding: '0 24px 0 10px',
				border: '1px solid #e7e5e4',
				borderRadius: 8,
				fontSize: 12,
				fontWeight: 600,
				background: codeLanguage === 'auto' ? '#ecfccb' : 'rgba(255,255,255,0.72)',
				color: codeLanguage === 'auto' ? '#3f6212' : '#44403c',
				cursor: 'pointer',
				flexShrink: 0,
				fontFamily: NOTE_MONO_STACK,
			}}
		>
			<option value="auto">Auto-detect</option>
			{Object.entries(CODE_LANGUAGE_FRIENDLY_NAME_MAP).map(([value, label]) => (
				<option key={value} value={value}>
					{label}
				</option>
			))}
			<option value="bash">Bash / Shell</option>
			<option value="go">Go</option>
			<option value="json">JSON</option>
			<option value="yaml">YAML</option>
			<option value="ruby">Ruby</option>
			<option value="kotlin">Kotlin</option>
			<option value="php">PHP</option>
		</select>
	);
}

interface BlockTypeSelectProps {
	blockType: BlockType;
	onChange: (type: BlockType) => void;
}

export function BlockTypeSelect({ blockType, onChange }: BlockTypeSelectProps): ReactElement {
	return (
		<select
			value={blockType}
			onChange={(event) => onChange(event.target.value as BlockType)}
			onMouseDown={(event) => event.stopPropagation()}
			style={{
				height: 28,
				padding: '0 24px 0 10px',
				border: '1px solid #e7e5e4',
				borderRadius: 8,
				fontSize: 12,
				fontWeight: 600,
				background: 'rgba(255,255,255,0.88)',
				color: '#44403c',
				cursor: 'pointer',
				flexShrink: 0,
				appearance: 'auto',
				marginRight: 2,
			}}
		>
			{BLOCK_OPTIONS.map((option) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	);
}
