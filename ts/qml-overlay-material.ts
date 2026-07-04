import { getLogger } from '@node-3d/addon-tools';
import type {
	TInitMaterialOpts,
	TMaterialOpts,
	TNewableQmlOverlayMaterial,
	TThree,
} from './types.ts';
import initQmlMaterial, { QmlMaterialBase } from './qml-material.ts';

const logger = getLogger('plugin-qml');

let activeThree: TThree | null = null;

class QmlOverlayMaterialBase extends QmlMaterialBase {
	public constructor(opts: TMaterialOpts = {}) {
		if (!activeThree) {
			throw new Error('QmlOverlayMaterial is not initialized.');
		}

		super({
			...opts,
			side: opts.side || activeThree.CullFaceFront,
			depthWrite: opts.depthWrite || false,
			depthTest: opts.depthTest || false,
			transparent: opts.transparent || true,
			vertexShader:
				opts.vertexShader ||
				`
				out vec2 tc;
				void main() {
					tc = uv;
					gl_Position = vec4(position, 1.0);
				}
			`,
		});
	}
}

const initMaterial = (opts: TInitMaterialOpts): TNewableQmlOverlayMaterial | null => {
	const { three } = opts;
	if (!three) {
		logger.error("Can't init QmlOverlayMaterial with no `three`.");
		return null;
	}
	const QmlMaterial = initQmlMaterial(opts);
	if (!QmlMaterial) {
		return null;
	}

	activeThree = three;
	return QmlOverlayMaterialBase as TNewableQmlOverlayMaterial;
};

let inited: TNewableQmlOverlayMaterial | null = null;

const init = (opts: TInitMaterialOpts): TNewableQmlOverlayMaterial | null => {
	if (inited) {
		return inited;
	}
	inited = initMaterial(opts);
	return inited;
};

export default init;
