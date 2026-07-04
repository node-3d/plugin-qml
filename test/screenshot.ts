import fs from 'node:fs';
import type { TWebgl } from '@node-3d/core';

type ScreenshotDoc = {
	w: number;
	h: number;
	context: Pick<TWebgl, 'RGBA' | 'UNSIGNED_BYTE' | 'readPixels'>;
};
type ScreenshotImage = {
	data: Buffer | null;
	width: number;
	height: number;
	save: (name: string) => void;
};
type ScreenshotImageCtor = {
	fromPixels: (width: number, height: number, bpp: number, data: Buffer) => ScreenshotImage;
	loadAsync: (name: string) => Promise<ScreenshotImage>;
};

const pixelThreshold = 0.2; // threshold error in one pixel
const maxFailedPixels = 100; // total failed pixels

const makePathDiff = (name: string): string => `test/__diff__/${name}.png`;
const makePathExpected = (name: string): string => `test/__diff__/${name}__expected__.png`;
const makePathActual = (name: string): string => `test/__diff__/${name}__actual__.png`;
const makePathExport = (name: string): string => `__screenshots__/${name}.png`;

const allocBuffer = (doc: ScreenshotDoc): Buffer => {
	const memSize = doc.w * doc.h * 4; // estimated number of bytes
	return Buffer.allocUnsafeSlow(memSize);
};

const getImage = (doc: ScreenshotDoc, Image: ScreenshotImageCtor): ScreenshotImage | null => {
	try {
		const storage = { data: allocBuffer(doc) };

		doc.context.readPixels(
			0,
			0,
			doc.w,
			doc.h,
			doc.context.RGBA,
			doc.context.UNSIGNED_BYTE,
			storage,
		);

		const img = Image.fromPixels(doc.w, doc.h, 32, storage.data);
		return img;
	} catch (error) {
		console.error(error);
		return null;
	}
};

const makeScreenshot = (name: string, doc: ScreenshotDoc, Image: ScreenshotImageCtor): void => {
	console.info(`Screenshot: ${name}`);
	const img = getImage(doc, Image);
	if (img) {
		img.save(makePathExport(name));
		console.info(`Screenshot: ${name} generated`);
	}
};

const compareScreenshot = async (
	name: string,
	doc: ScreenshotDoc,
	Image: ScreenshotImageCtor,
): Promise<boolean> => {
	const path = makePathExport(name);
	if (!fs.existsSync(path)) {
		console.error(`Warning! No such screenshot: ${name}.`);
		return false;
	}

	const actualImage = getImage(doc, Image);
	if (!actualImage?.data) {
		return false;
	}

	const expectedImage = await Image.loadAsync(path);
	if (!expectedImage.data) {
		return false;
	}

	const diff = allocBuffer(doc);

	let numFailedPixels = 0;

	try {
		const { default: pixelmatch } = await import('pixelmatch');

		numFailedPixels = pixelmatch(
			expectedImage.data,
			actualImage.data,
			diff,
			actualImage.width,
			actualImage.height,
			{
				threshold: pixelThreshold,
				alpha: 0.3,
				diffMask: false,
				diffColor: [255, 0, 0],
			},
		);
	} catch (error) {
		console.error(error);
		return false;
	}

	const pathDiff = makePathDiff(name);

	if (numFailedPixels) {
		console.warn(`Screenshot: ${name} - ${numFailedPixels}/${maxFailedPixels}.`);
		const pathExpected = makePathExpected(name);
		const pathActual = makePathActual(name);
		actualImage.save(pathActual);
		expectedImage.save(pathExpected);

		const diffImage = Image.fromPixels(doc.w, doc.h, 32, diff);
		diffImage.save(pathDiff);

		const isError = numFailedPixels >= maxFailedPixels;
		console[isError ? 'error' : 'warn'](
			[
				`Screenshot: ${name}.`,
				`Failed pixels: ${numFailedPixels}/${maxFailedPixels}.`,
				`Diff written: ${pathDiff}.`,
			].join('\n'),
		);

		return !isError;
	}

	return true;
};

export const screenshot = async (
	name: string,
	doc: ScreenshotDoc,
	Image: ScreenshotImageCtor,
): Promise<boolean> => {
	try {
		const path = makePathExport(name);

		// oxlint-disable-next-line node/no-process-env
		const isCi = !!process.env['CI'];
		const hasFile = fs.existsSync(path);

		if (!hasFile && !isCi) {
			await makeScreenshot(name, doc, Image);
			return true;
		}

		return compareScreenshot(name, doc, Image);
	} catch (error) {
		console.error(error);
		return false;
	}
};

export default { screenshot };
