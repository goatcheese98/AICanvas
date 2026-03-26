import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebEmbedPreviewCard } from './WebEmbedPreviewCard';

describe('WebEmbedPreviewCard', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders Microlink preview data for a URL fallback', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({
				data: {
					title: 'UBC Sauder School of Business',
					description: 'Business school at the University of British Columbia.',
					publisher: 'Google Maps',
					logo: { url: 'https://example.com/logo.png' },
					screenshot: { url: 'https://example.com/screenshot.png' },
				},
			}),
		} as Response);

		render(
			<WebEmbedPreviewCard
				url="https://www.google.com/maps/place/UBC+Sauder+School+of+Business"
				warning="Google Maps links need an official embed URL."
				width={960}
				height={720}
				mode="shell"
			/>,
		);

		expect(screen.getByText('Google Maps links need an official embed URL.')).toBeTruthy();

		await waitFor(() => {
			expect(screen.getByText('UBC Sauder School of Business')).toBeTruthy();
		});

		expect(screen.getByText('Business school at the University of British Columbia.')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Open source' }).getAttribute('href')).toBe(
			'https://www.google.com/maps/place/UBC+Sauder+School+of+Business',
		);
	});
});
