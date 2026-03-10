import { AutoLinkPlugin as LexicalAutoLinkPlugin } from '@lexical/react/LexicalAutoLinkPlugin';
import { createLinkMatcherWithRegExp } from '@lexical/link';

const URL_REGEX = /https?:\/\/[^\s]+/i;
const WWW_URL_REGEX = /www\.[^\s]+/i;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;

const MATCHERS = [
	createLinkMatcherWithRegExp(URL_REGEX, (text) => text),
	createLinkMatcherWithRegExp(WWW_URL_REGEX, (text) => `https://${text}`),
	createLinkMatcherWithRegExp(EMAIL_REGEX, (text) => `mailto:${text}`),
];

export default function AutoLinkPlugin() {
	return <LexicalAutoLinkPlugin matchers={MATCHERS} />;
}
