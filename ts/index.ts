import { Method, Property, View } from '@node-3d/qml';
import type * as THREE from 'three';
import initQmlMaterial from './qml-material.ts';
import initQmlOverlayMaterial from './qml-overlay-material.ts';
import initQmlOverlay from './qml-overlay.ts';
import type { TInitOpts, TQml3D, TTextureProperties } from './types.ts';

const initPlugin = (opts: TInitOpts): TQml3D => {
	const optsFinal = {
		...opts,
		cwd: opts.cwd || process.cwd(),
	};

	const { doc, gl, cwd, three } = optsFinal;
	if (!three) {
		throw new Error('Failed to initialize @node-3d/plugin-qml without three.');
	}
	const release = (): void => doc.makeCurrent();

	View.init(cwd, doc.platformWindow, doc.platformContext, doc.platformDevice);
	View.style('Basic');
	release();

	const loop = (cb: () => void): (() => void) => {
		let next: ReturnType<typeof doc.requestAnimationFrame> | null = null;
		const loopFunc = (): void => {
			View.update();
			doc.makeCurrent();
			next = doc.requestAnimationFrame(loopFunc);
			cb();
		};
		next = doc.requestAnimationFrame(loopFunc);
		return () => {
			if (next !== null) {
				doc.cancelAnimationFrame(next);
			}
		};
	};

	const textureFromId = (id: number | null, renderer: THREE.WebGLRenderer): THREE.Texture => {
		const WebGLTexture = gl.WebGLTexture as new (textureId: number | null) => unknown;
		const rawTexture = new WebGLTexture(id);
		const texture = new three.Texture();
		const properties = (renderer.properties?.get(texture) ?? texture) as TTextureProperties;
		properties['__webglTexture'] = rawTexture;
		properties['__webglInit'] = true;

		return texture;
	};

	const QmlMaterial = initQmlMaterial({ textureFromId, three });
	const QmlOverlayMaterial = initQmlOverlayMaterial({ textureFromId, three });
	const QmlOverlay = initQmlOverlay({ doc, textureFromId, three });

	if (!QmlMaterial || !QmlOverlayMaterial || !QmlOverlay) {
		throw new Error('Failed to initialize @node-3d/plugin-qml classes.');
	}

	return {
		View,
		Property,
		Method,
		release,
		loop,
		textureFromId,
		QmlMaterial,
		QmlOverlayMaterial,
		QmlOverlay,
	};
};

let inited: TQml3D | null = null;

/**
 * Initialize Qml3D.
 *
 * This function can be called repeatedly, but will ignore further calls.
 * The return value is cached and will be returned immediately for repeating calls.
 */
const init = (opts: TInitOpts): TQml3D => {
	if (inited) {
		return inited;
	}
	inited = initPlugin(opts);
	return inited;
};

export { init };
export type {
	TInitOpts,
	TNewableQmlMaterial,
	TNewableQmlOverlay,
	TNewableQmlOverlayMaterial,
	TQml3D,
	TQmlMaterialInstance,
	TQmlOverlayInstance,
	TTextureFromId,
	TThree,
} from './types.ts';

export default { init };
