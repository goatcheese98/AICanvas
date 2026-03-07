import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { assistantSchemas } from '@ai-canvas/shared/schemas';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';
import { generateAssistantResponse } from '../lib/assistant/service';

export const assistantRoutes = new Hono<AppEnv>()
	.use(requireAuth)

	// Send message to AI assistant
	.post('/chat', zValidator('json', assistantSchemas.sendMessage), async (c) => {
		const { message, contextMode, generationMode } = c.req.valid('json');
		const result = await generateAssistantResponse({
			message,
			contextMode,
			generationMode,
		});

		return c.json(result.message);
	});
