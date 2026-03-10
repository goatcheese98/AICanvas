const MIN_CONTENT_LENGTH = 30;
const MIN_SCORE = 3;

type Rule = { re: RegExp; score: number };

const LANG_RULES: Array<{ lang: string; rules: Rule[] }> = [
	{
		lang: 'html',
		rules: [
			{ re: /<!DOCTYPE\s+html/i, score: 6 },
			{ re: /<(html|head|body|div|span|script|style|link|meta)\b/i, score: 3 },
			{ re: /<\/[a-z][\w-]*>/i, score: 2 },
			{ re: /\s(class|id|href|src|type)=["']/i, score: 2 },
		],
	},
	{
		lang: 'css',
		rules: [
			{ re: /@(media|keyframes|import|charset|layer)\b/, score: 5 },
			{ re: /\b(color|background|font-size|margin|padding|border|display|flex|grid)\s*:/, score: 3 },
			{ re: /:(hover|focus|active|before|after|not|nth-child|root)\b/, score: 3 },
			{ re: /\b\d+(px|em|rem|vw|vh|%)\b/, score: 2 },
		],
	},
	{
		lang: 'sql',
		rules: [
			{ re: /\bSELECT\s+[\w*]/i, score: 4 },
			{ re: /\bFROM\s+\w/i, score: 3 },
			{ re: /\b(WHERE|JOIN|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT)\b/i, score: 3 },
			{
				re: /\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)\b/i,
				score: 5,
			},
			{ re: /\b(VARCHAR|INTEGER|BIGINT|TEXT|BOOLEAN|PRIMARY\s+KEY)\b/i, score: 3 },
		],
	},
	{
		lang: 'py',
		rules: [
			{ re: /\bdef\s+\w+\s*\(/, score: 3 },
			{ re: /\bfrom\s+[\w.]+\s+import\b|\bimport\s+[\w.]+/, score: 2 },
			{ re: /\belif\b/, score: 5 },
			{ re: /\bself\s*[,.):]/, score: 4 },
			{ re: /\b(True|False|None)\b/, score: 2 },
			{ re: /\bclass\s+\w+\s*[:(]/, score: 3 },
			{ re: /^[ \t]*(def |class |elif |except\b)/m, score: 2 },
		],
	},
	{
		lang: 'ruby',
		rules: [
			{ re: /\bdef\s+\w+/, score: 2 },
			{ re: /\bend\b/, score: 2 },
			{ re: /\b(puts|print|p)\s+["'\w]/, score: 3 },
			{ re: /\battr_(accessor|reader|writer)\b/, score: 6 },
			{ re: /do\s*\|\w+\|/, score: 5 },
			{ re: /\brequire(_relative)?\s*['"]/, score: 3 },
			{ re: /@{1,2}\w+/, score: 3 },
		],
	},
	{
		lang: 'typescript',
		rules: [
			{ re: /\binterface\s+[A-Z]\w*/, score: 5 },
			{ re: /\btype\s+[A-Z]\w*\s*=/, score: 5 },
			{ re: /:\s*(string|number|boolean|void|any|unknown|never)\b/, score: 4 },
			{ re: /\benum\s+\w+/, score: 5 },
			{ re: /\bimplements\s+\w+/, score: 5 },
			{ re: /<[A-Z]\w*>|\bRecord<|\bPartial<|\bRequired<|\bReadonly</, score: 4 },
			{ re: /\breadonly\s+\w+/, score: 3 },
		],
	},
	{
		lang: 'js',
		rules: [
			{ re: /\b(const|let)\s+\w+\s*=/, score: 2 },
			{ re: /\bfunction\s*[\w(]/, score: 2 },
			{ re: /\s=>\s*[{(]/, score: 2 },
			{ re: /console\.(log|error|warn|info)\s*\(/, score: 3 },
			{ re: /\b(import|export)\b/, score: 2 },
		],
	},
	{
		lang: 'tsx',
		rules: [
			{ re: /<[A-Z][A-Za-z0-9]*(\s|\/?>)/, score: 5 },
			{ re: /className=|onClick=|useState\(|useEffect\(/, score: 4 },
			{ re: /:\s*React\./, score: 4 },
			{ re: /return\s*\(\s*</, score: 4 },
		],
	},
	{
		lang: 'java',
		rules: [
			{ re: /\bpublic\s+(class|interface|enum|record)\s+[A-Z]/, score: 5 },
			{ re: /\bSystem\.out\.print/, score: 5 },
			{ re: /\bimport\s+java\./, score: 5 },
			{ re: /@(Override|NotNull|Autowired|Component|Service)\b/, score: 4 },
			{ re: /\bpublic\s+static\s+void\s+main/, score: 5 },
			{ re: /\bnew\s+[A-Z]\w+\s*\(/, score: 2 },
		],
	},
	{
		lang: 'rust',
		rules: [
			{ re: /\bfn\s+\w+\s*\(/, score: 3 },
			{ re: /\blet\s+mut\s+\w+/, score: 4 },
			{ re: /\bimpl\s+\w+/, score: 3 },
			{ re: /\buse\s+(std|crate|super)::/, score: 5 },
			{ re: /\b(println!|eprintln!|format!)\s*\(/, score: 5 },
			{ re: /\b(Some|None|Ok|Err)\s*\(|\bOption<|\bResult</, score: 4 },
			{ re: /&(mut\s+)?str\b|\bString::|\bVec</, score: 3 },
		],
	},
	{
		lang: 'go',
		rules: [
			{ re: /^package\s+\w+/m, score: 5 },
			{ re: /\bfunc\s+\w+\s*\(/, score: 3 },
			{ re: /\bimport\s+\(/, score: 4 },
			{ re: /\w+\s*:=\s*/, score: 3 },
			{ re: /\bfmt\.(Print|Println|Printf|Sprintf)\s*\(/, score: 4 },
			{ re: /\bdefer\s+\w+|\bgo\s+func/, score: 5 },
			{ re: /\berr\s*!=\s*nil/, score: 4 },
		],
	},
	{
		lang: 'bash',
		rules: [
			{ re: /^#!\//, score: 6 },
			{ re: /\becho\s+/, score: 2 },
			{ re: /\bif\s+\[[\[!]?\s+/, score: 3 },
			{ re: /\b(fi|done|then|esac)\b/, score: 3 },
			{ re: /\$\{?\w+\}/, score: 2 },
			{ re: /\$\([^)]+\)/, score: 3 },
			{ re: /\b(chmod|mkdir|grep|sed|awk|curl|wget)\s+/, score: 3 },
		],
	},
	{
		lang: 'json',
		rules: [
			{ re: /^\s*[{[]/, score: 2 },
			{ re: /"[\w$][\w$\s-]*"\s*:\s*["{\[0-9t f n]/, score: 4 },
			{ re: /:\s*(true|false|null)\b/, score: 3 },
			{ re: /,\s*\n\s*"/, score: 2 },
		],
	},
	{
		lang: 'yaml',
		rules: [
			{ re: /^---\s*$/m, score: 5 },
			{ re: /^\w[\w-]*:\s*\S/m, score: 2 },
			{ re: /^- \w/m, score: 2 },
			{ re: /^\s{2}\w[\w-]*:\s*\S/m, score: 3 },
		],
	},
	{
		lang: 'markdown',
		rules: [
			{ re: /^#{1,6}\s+\w/m, score: 3 },
			{ re: /\*\*[^*\n]{2,}\*\*|__[^_\n]{2,}__/, score: 3 },
			{ re: /^\s*[-*+]\s+\w/m, score: 2 },
			{ re: /^\s*>\s+\w/m, score: 3 },
			{ re: /\[[^\]]{1,100}\]\([^)]{1,200}\)/, score: 4 },
			{ re: /^```\w*/m, score: 5 },
		],
	},
];

export function detectCodeLanguage(code: string): string | null {
	if (code.trim().length < MIN_CONTENT_LENGTH) return null;

	let best = '';
	let bestScore = 0;

	for (const { lang, rules } of LANG_RULES) {
		let score = 0;
		for (const { re, score: points } of rules) {
			if (re.test(code)) score += points;
		}
		if (score > bestScore) {
			best = lang;
			bestScore = score;
		}
	}

	return bestScore >= MIN_SCORE ? best : null;
}
