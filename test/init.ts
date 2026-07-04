import { init, addThreeHelpers, gl } from '@node-3d/core';
import { init as initQml } from '../ts/index.ts';
import * as three from 'three';
import type { TCore3D } from '@node-3d/core';
import type { TQml3D } from '../ts/index.ts';

const initForTest = (): Omit<TCore3D, 'loop'> & TQml3D => {
	const node3d = init({
		isGles3: true,
		isWebGL2: true,
		width: 200,
		height: 200,
	});

	const { doc } = node3d;

	addThreeHelpers(three);

	const inited = initQml({ doc, gl, cwd: import.meta.dirname, three });
	return { ...node3d, ...inited };
};

export default initForTest;
