#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const apiDir = process.cwd();
const envFilePath = path.join(apiDir, '.dev.vars');

function parseEnvFile(filePath) {
	if (!existsSync(filePath)) {
		return new Map();
	}

	const entries = new Map();

	for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
		const line = rawLine.trim();

		if (!line || line.startsWith('#')) {
			continue;
		}

		const separatorIndex = line.indexOf('=');
		if (separatorIndex === -1) {
			continue;
		}

		const key = line.slice(0, separatorIndex).trim();
		const value = line.slice(separatorIndex + 1).trim();
		entries.set(key, value);
	}

	return entries;
}

function getWranglerBinary() {
	const binaryName = process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler';
	return path.join(apiDir, 'node_modules', '.bin', binaryName);
}

const envFileValues = parseEnvFile(envFilePath);
const port = process.env.API_PORT || process.env.PORT || envFileValues.get('API_PORT') || '8787';
const extraArgs = process.argv.slice(2);
const shouldShowHelp = extraArgs.includes('--help') || extraArgs.includes('-h');

if (!shouldShowHelp) {
	const migrateResult = spawnSync(
		getWranglerBinary(),
		['d1', 'migrations', 'apply', 'ai-canvas-db', '--local'],
		{
			cwd: apiDir,
			stdio: 'inherit',
			env: process.env,
		},
	);

	if (migrateResult.status !== 0) {
		process.exit(migrateResult.status ?? 1);
	}
}

const child = spawn(getWranglerBinary(), ['dev', '--port', port, ...extraArgs], {
	cwd: apiDir,
	stdio: 'inherit',
	env: process.env,
});

child.on('exit', (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}

	process.exit(code ?? 0);
});
