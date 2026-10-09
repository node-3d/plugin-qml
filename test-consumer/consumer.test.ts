import assert from 'node:assert/strict';
import { platform } from 'node:process';
import test from 'node:test';

import type { TGlfw } from '@node-3d/core';

if (platform === 'darwin') {
	const plugin = await import('@node-3d/plugin-qml');

	test('loads the packed QML plugin and its native dependency', () => {
		assert.equal(typeof plugin.init, 'function');
	});
} else {
	const useGles = platform === 'linux';
	const [{ addThreeHelpers, gl, init: initCore }, three, { init: initQml }] = await Promise.all([
		import('@node-3d/core'),
		import('three'),
		import('@node-3d/plugin-qml'),
	]);
	const core = initCore({
		height: 32,
		isGles3: useGles,
		isVisible: false,
		isWebGL2: useGles,
		width: 32,
		onBeforeWindow(_window, currentGlfw) {
			if (!useGles) {
				return;
			}
			const current = currentGlfw as TGlfw;
			current.windowHint(current.VISIBLE, current.FALSE);
			current.windowHint(current.OPENGL_PROFILE, current.OPENGL_ANY_PROFILE);
			current.windowHint(current.CONTEXT_VERSION_MAJOR, 3);
			current.windowHint(current.CONTEXT_VERSION_MINOR, 2);
			current.windowHint(current.CLIENT_API, current.OPENGL_ES_API);
			current.windowHint(current.STENCIL_BITS, 0);
			current.windowHint(current.DEPTH_BITS, 0);
			current.windowHint(current.SAMPLES, 0);
		},
	});

	addThreeHelpers();
	const extended = {
		...core,
		...initQml({ cwd: import.meta.dirname, doc: core.doc, gl, three }),
	};

	test('uses the packed QML plugin to extend core', () => {
		assert.equal(typeof extended.doc.createElement, 'function');
		assert.equal(typeof extended.View, 'function');
		assert.equal(typeof extended.QmlOverlay, 'function');
		const overlay = new extended.QmlOverlay({ file: `${import.meta.dirname}/test.qml` });
		assert.ok(overlay instanceof extended.QmlOverlay);
		assert.ok('mesh' in overlay);
		extended.doc.destroy();
	});
}
