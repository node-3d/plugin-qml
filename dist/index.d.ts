import type { TInitOpts, TQml3D } from './types.ts';
/**
 * Initialize Qml3D.
 *
 * This function can be called repeatedly, but will ignore further calls.
 * The return value is cached and will be returned immediately for repeating calls.
 */
declare const init: (opts: TInitOpts) => TQml3D;
export { init };
export type { TInitOpts, TNewableQmlMaterial, TNewableQmlOverlay, TNewableQmlOverlayMaterial, TQml3D, TQmlMaterialInstance, TQmlOverlayInstance, TTextureFromId, TThree, } from './types.ts';
declare const _default: {
    init: typeof init;
};
export default _default;
