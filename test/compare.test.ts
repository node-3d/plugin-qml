import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import * as three from 'three';
import { Image } from '@node-3d/core';

import initForTest from './init.ts';
import screenshotModule from './screenshot.ts';

const { screenshot } = screenshotModule;
const inited = initForTest();
const { QmlOverlay, loop, doc } = inited;

const renderer = new three.WebGLRenderer();
renderer.setPixelRatio(doc.devicePixelRatio);
renderer.setSize(doc.innerWidth, doc.innerHeight);

const camera = new three.PerspectiveCamera(70, doc.innerWidth / doc.innerHeight, 1, 1000);
camera.position.z = 2;
const scene = new three.Scene();
const overlay = new QmlOverlay({ file: `${import.meta.dirname}/test.qml` });
const loadPromise = Promise.race([
	new Promise((res) => {
		setTimeout(() => res(false), 5000);
	}),
	new Promise((res) => {
		overlay.on('load', () => res(true));
	}),
]);
const texturePromise = Promise.race([
	new Promise((res) => {
		setTimeout(() => res(null), 5000);
	}),
	new Promise((res) => {
		overlay.on('reset', (id) => res(id));
	}),
]);
scene.add(overlay.mesh);

const tested = describe('Screenshots', () => {
	it('matches ui screenshot', async () => {
		const loaded = await loadPromise;
		assert.strictEqual(loaded, true);
		const texture = await texturePromise;
		assert.ok(texture);

		await new Promise((res) => {
			setTimeout(res, 1000);
		});
		renderer.render(scene, camera);

		assert.ok(await screenshot('ui', doc, Image));
	});
});

const stop = loop(() => {
	renderer.render(scene, camera);
});
await tested;
stop();
doc.destroy();
setTimeout(() => {
	/* nop */
}, 500);
