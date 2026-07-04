import { getLogger } from '@node-3d/addon-tools';
import { ShaderMaterial } from 'three';
import type * as THREE from 'three';
import type {
	TInitMaterialOpts,
	TMaterialOpts,
	TNewableQmlMaterial,
	TTextureFromId,
	TThree,
} from './types.ts';

const logger = getLogger('plugin-qml');

let activeThree: TThree | null = null;
let activeTextureFromId: TTextureFromId | null = null;

const makeMaterialParams = (three: TThree, opts: TMaterialOpts): TMaterialOpts => ({
	...opts,
	side: opts.side || three.CullFaceBack,
	uniforms: {
		...opts.uniforms,
		t: { value: null },
	},
	transparent: opts.transparent || false,
	lights: opts.lights || false,
	vertexShader:
		opts.vertexShader ||
		`
		out vec2 tc;
		void main() {
			tc = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
	`,
	fragmentShader:
		opts.fragmentShader ||
		`
		uniform sampler2D t;
		in vec2 tc;
		out vec4 fragColor;
		void main() {
			fragColor = texture(t, tc);
		}
	`,
	glslVersion: opts.glslVersion || '300 es',
});

export class QmlMaterialBase extends ShaderMaterial {
	private _textureId: number | null = null;
	private _texture: THREE.Texture | null = null;
	private _renderer: THREE.WebGLRenderer | null = null;

	public constructor(opts: TMaterialOpts = {}) {
		if (!activeThree) {
			throw new Error('QmlMaterial is not initialized.');
		}
		super(makeMaterialParams(activeThree, opts));
	}

	public onBeforeCompile(
		shaderObject: THREE.WebGLProgramParametersWithUniforms,
		renderer: THREE.WebGLRenderer,
	): void {
		super.onBeforeCompile(shaderObject, renderer);

		if (!activeTextureFromId) {
			return;
		}

		if (!this._renderer && this._textureId) {
			this._texture = activeTextureFromId(this._textureId, renderer);
			this.shaderUniforms.t.value = this._texture;
		}
		this._renderer = renderer;
	}

	public get textureId(): number | null {
		return this._textureId;
	}
	public set textureId(texId: number | null) {
		this._textureId = texId;

		if (this._renderer && this._textureId && activeTextureFromId) {
			this._texture = activeTextureFromId(this._textureId, this._renderer);
			this.shaderUniforms.t.value = this._texture;
		}
	}

	private get shaderUniforms(): THREE.ShaderMaterial['uniforms'] {
		return (this as THREE.ShaderMaterial).uniforms;
	}
}

const initMaterial = ({ textureFromId, three }: TInitMaterialOpts): TNewableQmlMaterial | null => {
	if (!three) {
		logger.error("Can't init QmlOverlayMaterial with no `three`.");
		return null;
	}

	activeThree = three;
	activeTextureFromId = textureFromId;
	return QmlMaterialBase as TNewableQmlMaterial;
};

let inited: TNewableQmlMaterial | null = null;

const init = (opts: TInitMaterialOpts): TNewableQmlMaterial | null => {
	if (inited) {
		return inited;
	}
	inited = initMaterial(opts);
	return inited;
};

export default init;
