import { expect, test, type Locator, type Page } from '@playwright/test';

type Bounds = { x: number; y: number; width: number; height: number };

async function getBounds(locator: Locator): Promise<Bounds> {
	const box = await locator.boundingBox();
	expect(box).not.toBeNull();
	return box as Bounds;
}

function expectClose(actual: number, expected: number, tolerance = 6) {
	expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

async function readInsertedId(page: Page, testId: string, prefix: string) {
	const text = (await page.getByTestId(testId).textContent()) ?? '';
	const value = text.replace(prefix, '').trim();
	expect(value).not.toBe('none');
	return value;
}

async function expectLocked(page: Page, overlayId: string, tolerance = 6) {
	const overlay = page.getByTestId(`overlay-item-${overlayId}`);
	const reference = page.getByTestId(`overlay-reference-${overlayId}`);
	await expect(overlay).toBeVisible();
	await expect(reference).toBeVisible();

	const overlayBox = await getBounds(overlay);
	const referenceBox = await getBounds(reference);

	expectClose(overlayBox.x, referenceBox.x, tolerance);
	expectClose(overlayBox.y, referenceBox.y, tolerance);
	expectClose(overlayBox.width, referenceBox.width, tolerance);
	expectClose(overlayBox.height, referenceBox.height, tolerance);
}

async function dragFromCenter(page: Page, overlayId: string, deltaX: number, deltaY: number) {
	const overlay = page.getByTestId(`overlay-item-${overlayId}`);
	const box = await getBounds(overlay);
	const startX = box.x + box.width / 2;
	const startY = box.y + box.height / 2;

	await page.mouse.move(startX, startY);
	await page.mouse.down();

	for (let step = 1; step <= 6; step += 1) {
		const nextX = startX + (deltaX * step) / 6;
		const nextY = startY + (deltaY * step) / 6;
		await page.mouse.move(nextX, nextY, { steps: 4 });
		await expectLocked(page, overlayId);
	}

	await page.mouse.up();
}

test.describe('overlay drag lock regression', () => {
	test('markdown and kanban overlays stay locked to live API references while dragging and zooming', async ({
		page,
	}) => {
		await page.goto('/experiments/overlay-regression');

		await expect(page.getByTestId('overlay-item-regression-markdown')).toBeVisible();
		await expect(page.getByTestId('overlay-item-regression-kanban')).toBeVisible();

		await expectLocked(page, 'regression-markdown');
		await expectLocked(page, 'regression-kanban');

		await dragFromCenter(page, 'regression-markdown', 140, 90);
		await expectLocked(page, 'regression-markdown');

		await page.getByTestId('overlay-regression-zoom-150').click();
		await expect(page.getByTestId('overlay-regression-zoom-label')).toHaveText('150%');
		await expectLocked(page, 'regression-markdown');
		await expectLocked(page, 'regression-kanban');

		await dragFromCenter(page, 'regression-kanban', -180, 120);
		await expectLocked(page, 'regression-kanban');

		await page.getByTestId('overlay-regression-reset').click();
		await expect(page.getByTestId('overlay-regression-zoom-label')).toHaveText('100%');
		await expectLocked(page, 'regression-markdown');
		await expectLocked(page, 'regression-kanban');
	});

	test('newly inserted overlays stay locked to their live references after creation', async ({
		page,
	}) => {
		await page.goto('/experiments/overlay-regression');
		await expect(page.getByTestId('overlay-regression-api-state')).toHaveText('API: ready');
		await expect(page.getByTestId('overlay-regression-element-count')).toHaveText('Elements: 2');

		await page.getByTestId('overlay-regression-insert-markdown').click();
		await expect(page.getByTestId('overlay-regression-element-count')).toHaveText('Elements: 3');
		const insertedMarkdownId = await readInsertedId(
			page,
			'overlay-regression-last-markdown-id',
			'Last Markdown:',
		);
		await expectLocked(page, insertedMarkdownId);
		await dragFromCenter(page, insertedMarkdownId, 110, 65);
		await expectLocked(page, insertedMarkdownId);

		await page.getByTestId('overlay-regression-insert-kanban').click();
		await expect(page.getByTestId('overlay-regression-element-count')).toHaveText('Elements: 4');
		const insertedKanbanId = await readInsertedId(
			page,
			'overlay-regression-last-kanban-id',
			'Last Kanban:',
		);
		await expectLocked(page, insertedKanbanId);

		await page.getByTestId('overlay-regression-zoom-150').click();
		await expect(page.getByTestId('overlay-regression-zoom-label')).toHaveText('150%');
		await expectLocked(page, insertedMarkdownId);
		await expectLocked(page, insertedKanbanId);

		await dragFromCenter(page, insertedKanbanId, -120, 80);
		await expectLocked(page, insertedKanbanId);
	});
});
