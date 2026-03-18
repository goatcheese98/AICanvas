#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function printUsage() {
	console.log(`Usage:
  bun run worktree:new -- <task-name> [options]

Options:
  --base <branch>           Base ref to branch from (default: main)
  --branch-prefix <prefix>  Branch prefix (default: task)
  --no-copy-env             Skip copying local env files into the new worktree
  --no-sync-docs            Skip syncing orchestration docs into the new worktree
  --dry-run                 Print planned actions without making changes
  --help                    Show this help
`);
}

function parseArgs(argv) {
	const options = {
		base: 'main',
		branchPrefix: 'task',
		copyEnv: true,
		syncDocs: true,
		dryRun: false,
		taskName: '',
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (!arg.startsWith('--') && !options.taskName) {
			options.taskName = arg;
			continue;
		}

		if (arg === '--base') {
			options.base = argv[index + 1] ?? options.base;
			index += 1;
			continue;
		}

		if (arg === '--branch-prefix') {
			options.branchPrefix = argv[index + 1] ?? options.branchPrefix;
			index += 1;
			continue;
		}

		if (arg === '--no-copy-env') {
			options.copyEnv = false;
			continue;
		}

		if (arg === '--no-sync-docs') {
			options.syncDocs = false;
			continue;
		}

		if (arg === '--dry-run') {
			options.dryRun = true;
			continue;
		}

		if (arg === '--help') {
			printUsage();
			process.exit(0);
		}

		throw new Error(`Unknown argument: ${arg}`);
	}

	if (!options.taskName) {
		printUsage();
		throw new Error('Missing required <task-name>.');
	}

	return options;
}

function slugifyTaskName(value) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function runGit(args, dryRun) {
	if (dryRun) {
		console.log(`DRY RUN git ${args.join(' ')}`);
		return '';
	}

	return execFileSync('git', args, {
		cwd: repoRoot,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	}).trim();
}

function parseAssignedPorts() {
	const docsPath = path.join(repoRoot, 'docs', 'multi-agent-orchestration.md');
	const docsText = readFileSync(docsPath, 'utf8');
	const webPorts = new Set([5173]);
	const apiPorts = new Set([8787]);
	const lanePattern = /-> web `(\d+)`(?:, api `(\d+)`)?/g;

	for (const match of docsText.matchAll(lanePattern)) {
		webPorts.add(Number.parseInt(match[1], 10));
		if (match[2]) {
			apiPorts.add(Number.parseInt(match[2], 10));
		}
	}

	return { webPorts, apiPorts };
}

function firstAvailablePort(usedPorts, start) {
	let port = start;
	while (usedPorts.has(port)) {
		port += 1;
	}
	return port;
}

function copyFileIfPresent(fromPath, toPath, dryRun) {
	if (!existsSync(fromPath)) {
		return false;
	}

	if (dryRun) {
		console.log(`DRY RUN copy ${fromPath} -> ${toPath}`);
		return true;
	}

	mkdirSync(path.dirname(toPath), { recursive: true });
	copyFileSync(fromPath, toPath);
	return true;
}

function upsertEnvLine(text, key, value) {
	const line = `${key}=${value}`;
	const pattern = new RegExp(`^${key}=.*$`, 'm');

	if (pattern.test(text)) {
		return text.replace(pattern, line);
	}

	return text.endsWith('\n') ? `${text}${line}\n` : `${text}\n${line}\n`;
}

function updateFile(filePath, transform, dryRun) {
	if (!existsSync(filePath)) {
		return false;
	}

	const nextText = transform(readFileSync(filePath, 'utf8'));

	if (dryRun) {
		console.log(`DRY RUN patch ${filePath}`);
		return true;
	}

	writeFileSync(filePath, nextText);
	return true;
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	const taskSlug = slugifyTaskName(options.taskName);

	if (!taskSlug) {
		throw new Error('Task name must contain at least one letter or number.');
	}

	const branchName = `${options.branchPrefix}/${taskSlug}`;
	const worktreeName = `AICanvas-${taskSlug}`;
	const worktreePath = path.resolve(repoRoot, '..', worktreeName);

	if (existsSync(worktreePath)) {
		throw new Error(`Worktree path already exists: ${worktreePath}`);
	}

	const { webPorts, apiPorts } = parseAssignedPorts();
	const suggestedWebPort = firstAvailablePort(webPorts, 5181);
	const suggestedApiPort = firstAvailablePort(apiPorts, 8791);

	console.log(`Creating worktree ${worktreeName}`);
	console.log(`Branch: ${branchName}`);
	console.log(`Base: ${options.base}`);
	console.log(`Path: ${worktreePath}`);

	runGit(['worktree', 'add', '-b', branchName, worktreePath, options.base], options.dryRun);

	if (options.syncDocs) {
		const trackedFilesToSync = [
			'AGENTS.md',
			'CLAUDE.md',
			'docs/multi-agent-orchestration.md',
			'docs/auth-setup.md',
			'turbo.json',
		];

		for (const relativePath of trackedFilesToSync) {
			copyFileIfPresent(
				path.join(repoRoot, relativePath),
				path.join(worktreePath, relativePath),
				options.dryRun,
			);
		}
	}

	if (options.copyEnv) {
		const localFilesToCopy = ['apps/web/.env.local', 'apps/api/.dev.vars'];

		for (const relativePath of localFilesToCopy) {
			copyFileIfPresent(
				path.join(repoRoot, relativePath),
				path.join(worktreePath, relativePath),
				options.dryRun,
			);
		}
	}

	const worktreeWebEnvPath = path.join(worktreePath, 'apps/web/.env.local');
	updateFile(
		worktreeWebEnvPath,
		(text) => {
			let nextText = upsertEnvLine(text, 'VITE_PORT', String(suggestedWebPort));
			nextText = upsertEnvLine(
				nextText,
				'VITE_API_BASE_URL',
				`http://localhost:${suggestedApiPort}`,
			);
			nextText = upsertEnvLine(
				nextText,
				'VITE_API_PROXY_TARGET',
				`http://localhost:${suggestedApiPort}`,
			);
			return nextText;
		},
		options.dryRun,
	);

	const worktreeApiEnvPath = path.join(worktreePath, 'apps/api/.dev.vars');
	updateFile(
		worktreeApiEnvPath,
		(text) => {
			let nextText = upsertEnvLine(text, 'API_PORT', String(suggestedApiPort));
			nextText = upsertEnvLine(
				nextText,
				'CORS_ALLOWED_ORIGINS',
				`http://localhost:${suggestedWebPort},http://127.0.0.1:${suggestedWebPort},https://roopstudio.com,https://www.roopstudio.com`,
			);
			nextText = upsertEnvLine(
				nextText,
				'CLERK_AUTHORIZED_PARTIES',
				`http://localhost:${suggestedWebPort},http://127.0.0.1:${suggestedWebPort}`,
			);
			return nextText;
		},
		options.dryRun,
	);

	console.log('');
	console.log('Next steps');
	console.log(`- Open ${worktreePath} as its own workspace.`);
	console.log(`- Run all services: cd ${worktreePath} && bun run dev`);
	console.log(
		`  (starts Web on ${suggestedWebPort}, API on ${suggestedApiPort}, PartyKit on 1999)`,
	);
	console.log(`- Push when ready: git -C ${worktreePath} push -u origin ${branchName}`);
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
