import { getLogger } from '@node-3d/addon-tools';
import { View } from '@node-3d/qml';
import type { TOptsView } from '@node-3d/qml';
import type * as THREE from 'three';
import type {
	TInitOverlayOpts,
	TNewableQmlOverlay,
	TOverlayEventMap,
	TOverlayEventName,
	TQmlMaterialInstance,
} from './types.ts';
import initQmlOverlayMaterial from './qml-overlay-material.ts';

const logger = getLogger('plugin-qml');
const overlayEventNames = [
	'mousedown',
	'mouseup',
	'mousemove',
	'keydown',
	'keyup',
	'wheel',
] as const;

const overlayEventRoutes: {
	[K in TOverlayEventName]: (view: View, event: TOverlayEventMap[K]) => void;
} = {
	mousedown: (view, event) => view.mousedown(event),
	mouseup: (view, event) => view.mouseup(event),
	mousemove: (view, event) => view.mousemove(event),
	keydown: (view, event) => view.keydown(event),
	keyup: (view, event) => view.keyup(event),
	wheel: (view, event) => view.wheel(event),
};

const routeVisibleEvent = <T extends TOverlayEventName>(
	view: View,
	name: T,
	event: TOverlayEventMap[T],
): void => {
	overlayEventRoutes[name](view, event);
};

const initOverlay = (opts: TInitOverlayOpts): TNewableQmlOverlay | null => {
	const { doc, three } = opts;
	if (!doc) {
		logger.error("Can't init QmlOverlayMaterial with no `doc`.");
		return null;
	}

	if (!three) {
		logger.error("Can't init QmlOverlayMaterial with no `three`.");
		return null;
	}

	const release = (): void => doc.makeCurrent();
	const QmlOverlayMaterial = initQmlOverlayMaterial(opts);
	if (!QmlOverlayMaterial) {
		return null;
	}
	const Material = QmlOverlayMaterial;
	const threeApi = three;

	class QmlOverlay extends View {
		private _isVisible = true;
		private _isDisabled = false;
		private _mat: TQmlMaterialInstance;
		private _mesh: THREE.Mesh;

		public constructor(opts: TOptsView = {}) {
			release();

			super({
				...opts,
				width: doc.w,
				height: doc.h,
			});

			release();

			this._mat = new Material();
			this._mesh = new threeApi.Mesh(new threeApi.PlaneGeometry(2, 2), this._mat);
			this._mesh.frustumCulled = false;
			this._mesh.renderOrder = Infinity;

			doc.on('resize', ({ width, height }: { width: number; height: number }) => {
				this.wh = [width, height];
			});

			this._mat.textureId = this.textureId;
			this.on('reset', (textureId: number) => {
				release();
				this._mat.textureId = textureId;
			});

			this.on('error', () => {
				/* nop */
			});

			for (const name of overlayEventNames) {
				doc.on(name, (event: TOverlayEventMap[typeof name]) =>
					this._routeEvent(name, event),
				);
			}
		}

		public _routeEvent<T extends TOverlayEventName>(name: T, event: TOverlayEventMap[T]): void {
			if (!this._isVisible || this.isDisabled) {
				this.emit(name, event);
				return;
			}

			routeVisibleEvent(this, name, event);
		}

		public get isVisible(): boolean {
			return this._isVisible;
		}
		public set isVisible(value: boolean) {
			this._isVisible = value;
		}

		public get isDisabled(): boolean {
			return this._isDisabled;
		}
		public set isDisabled(value: boolean) {
			this._isDisabled = value;
		}

		public get material(): TQmlMaterialInstance {
			return this._mat;
		}

		public get mesh(): THREE.Mesh {
			return this._mesh;
		}
	}

	return QmlOverlay as TNewableQmlOverlay;
};

let inited: TNewableQmlOverlay | null = null;

const init = (opts: TInitOverlayOpts): TNewableQmlOverlay | null => {
	if (inited) {
		return inited;
	}
	inited = initOverlay(opts);
	return inited;
};

export default init;
