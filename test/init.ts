import { platform } from 'node:process';
import * as three from 'three';
import { init as initQml } from '../ts/index.ts';
import type { TCore3D, TGlfw, TInitOpts } from '@node-3d/core';
import type { TQml3D } from '../ts/index.ts';

const shouldUseHeadlessGlfw = platform === 'darwin';
const shouldUseGlesTestWindowHints = platform === 'darwin' || platform === 'linux';

const applyGlesWindowHints = (currentGlfw: TGlfw): void => {
	currentGlfw.windowHint(currentGlfw.VISIBLE, currentGlfw.FALSE);
	currentGlfw.windowHint(currentGlfw.OPENGL_PROFILE, currentGlfw.OPENGL_ANY_PROFILE);
	currentGlfw.windowHint(currentGlfw.CONTEXT_VERSION_MAJOR, 3);
	currentGlfw.windowHint(currentGlfw.CONTEXT_VERSION_MINOR, 2);
	currentGlfw.windowHint(currentGlfw.CLIENT_API, currentGlfw.OPENGL_ES_API);
	currentGlfw.windowHint(currentGlfw.STENCIL_BITS, 0);
	currentGlfw.windowHint(currentGlfw.DEPTH_BITS, 0);
	currentGlfw.windowHint(currentGlfw.SAMPLES, 0);
};

const applyHeadlessWindowHints = (currentGlfw: TGlfw): void => {
	currentGlfw.windowHint(currentGlfw.CONTEXT_CREATION_API, currentGlfw.EGL_CONTEXT_API);
	applyGlesWindowHints(currentGlfw);
};

const importCoreForTest = async () => {
	const nodeGlobal = globalThis as unknown as Record<string, unknown>;
	if (shouldUseHeadlessGlfw) {
		nodeGlobal['__isGlfwInited'] = true;
	}

	const core = await import('@node-3d/core');

	if (shouldUseHeadlessGlfw) {
		core.glfw.initHint(core.glfw.PLATFORM, core.glfw.PLATFORM_NULL);
		if (!core.glfw.init()) {
			throw new Error('Failed to initialize GLFW for headless tests');
		}
		core.glfw.defaultWindowHints();
		nodeGlobal['__isGlfwInited'] = true;
	}

	return core;
};

const core = await importCoreForTest();
const { init, addThreeHelpers, gl } = core;

const getInitOpts = (): TInitOpts => {
	const opts: TInitOpts = {
		width: 200,
		height: 200,
		...(shouldUseGlesTestWindowHints
			? {
					isGles3: true,
					isWebGL2: true,
				}
			: {
					isGles3: false,
					major: 2,
					minor: 1,
				}),
	};

	if (!shouldUseGlesTestWindowHints) {
		return opts;
	}

	return {
		...opts,
		isVisible: false,
		onBeforeWindow(_window, currentGlfw) {
			if (shouldUseHeadlessGlfw) {
				applyHeadlessWindowHints(currentGlfw as TGlfw);
				return;
			}
			applyGlesWindowHints(currentGlfw as TGlfw);
		},
	};
};

const initForTest = (): Omit<TCore3D, 'loop'> & TQml3D => {
	const node3d = init(getInitOpts());

	const { doc } = node3d;

	addThreeHelpers(three);

	const inited = initQml({ doc, gl, cwd: import.meta.dirname, three });
	return { ...node3d, ...inited };
};

export default initForTest;
