/// <reference types="@cloudflare/workers-types" />

import * as Sentry from '@sentry/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function createDb(d1: D1Database) {
	return drizzle(Sentry.instrumentD1WithSentry(d1), { schema });
}

export type Database = ReturnType<typeof createDb>;
