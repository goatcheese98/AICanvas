const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 0.82;
const COMPRESS_THRESHOLD = 80 * 1024;

export const compressImageDataUrl = (dataUrl: string): Promise<string> =>
	new Promise((resolve) => {
		if (dataUrl.length < COMPRESS_THRESHOLD) {
			resolve(dataUrl);
			return;
		}

		const img = new Image();
		img.onload = () => {
			let { width, height } = img;

			if (width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE) {
				const ratio = Math.min(MAX_IMAGE_SIDE / width, MAX_IMAGE_SIDE / height);
				width = Math.round(width * ratio);
				height = Math.round(height * ratio);
			}

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				resolve(dataUrl);
				return;
			}

			ctx.drawImage(img, 0, 0, width, height);

			const webp = canvas.toDataURL('image/webp', 0.85);
			if (webp.startsWith('data:image/webp') && webp.length < dataUrl.length) {
				resolve(webp);
				return;
			}

			const jpeg = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
			resolve(jpeg.length < dataUrl.length ? jpeg : dataUrl);
		};

		img.onerror = () => resolve(dataUrl);
		img.src = dataUrl;
	});
