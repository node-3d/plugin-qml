import type * as THREE from 'three';
import type {
	Method,
	Property,
	TKeyEvent,
	TMouseEventCommon,
	TMouseEventPress,
	TMouseEventWheel,
	TOptsView,
	View,
} from '@node-3d/qml';
import type { TCore3D, TWebgl } from '@node-3d/core';

export type TThree = typeof THREE;
export type TDocument = TCore3D['doc'];
export type TTextureFromId = (id: number | null, renderer: THREE.WebGLRenderer) => THREE.Texture;

export type TMaterialOpts = THREE.ShaderMaterialParameters;

export type TQmlMaterialInstance = THREE.ShaderMaterial & {
	textureId: number | null;
};

export type TNewableQmlMaterial = {
	new (opts?: TMaterialOpts): TQmlMaterialInstance;
	prototype: TQmlMaterialInstance;
};

export type TNewableQmlOverlayMaterial = TNewableQmlMaterial;

export type TQmlOverlayInstance = InstanceType<typeof View> & {
	isVisible: boolean;
	isDisabled: boolean;
	material: TQmlMaterialInstance;
	mesh: THREE.Mesh;
};

export type TNewableQmlOverlay = Pick<typeof View, 'init' | 'style' | 'update'> & {
	new (opts?: TOptsView): TQmlOverlayInstance;
	prototype: TQmlOverlayInstance;
};

export type TInitMaterialOpts = Readonly<{
	textureFromId: TTextureFromId;
	three: TThree | null;
}>;

export type TInitOverlayOpts = TInitMaterialOpts &
	Readonly<{
		doc: TDocument;
	}>;

export type TInitOpts = Readonly<{
	doc: TDocument;
	gl: TWebgl;
	cwd?: string | null;
	three: TThree | null;
}>;

export type TQml3D = Readonly<{
	View: typeof View;
	Property: typeof Property;
	Method: typeof Method;
	release: () => void;
	loop: (cb: () => void) => () => void;
	textureFromId: TTextureFromId;
	QmlMaterial: TNewableQmlMaterial;
	QmlOverlayMaterial: TNewableQmlOverlayMaterial;
	QmlOverlay: TNewableQmlOverlay;
}>;

export type TTextureProperties = {
	__webglTexture?: unknown;
	__webglInit?: boolean;
};

export type TOverlayEventName =
	| 'mousedown'
	| 'mouseup'
	| 'mousemove'
	| 'keydown'
	| 'keyup'
	| 'wheel';

export type TOverlayEventMap = {
	mousedown: TMouseEventPress;
	mouseup: TMouseEventPress;
	mousemove: TMouseEventCommon;
	keydown: TKeyEvent;
	keyup: TKeyEvent;
	wheel: TMouseEventWheel;
};
