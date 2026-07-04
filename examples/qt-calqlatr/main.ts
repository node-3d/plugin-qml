import * as three from 'three';
import { init, addThreeHelpers, gl, Image } from '@node-3d/core';
import { init as initQml } from '@node-3d/plugin-qml';

const cwd = import.meta.dirname;

const { doc } = init({
	isGles3: true,
	isWebGL2: true,
	autoEsc: true,
	vsync: true,
});

addThreeHelpers(three);

const { QmlOverlay, loop } = initQml({ doc, gl, cwd, three });

const icon = new Image(`${cwd}/../qml.png`);
icon.on('load', () => {
	if (icon.data) {
		doc.icon = { width: icon.width, height: icon.height, data: icon.data };
	}
});
doc.title = 'Calqlatr';

const scene = new three.Scene();
const cameraPerspective = new three.PerspectiveCamera(90, doc.w / doc.h, 1, 1000);
cameraPerspective.position.z = 9;

const renderer = new three.WebGLRenderer();
renderer.setPixelRatio(doc.devicePixelRatio);
renderer.setSize(doc.w, doc.h);

doc.on('resize', () => {
	cameraPerspective.aspect = doc.w / doc.h;
	cameraPerspective.updateProjectionMatrix();
	renderer.setSize(doc.w, doc.h);
});

const overlay = new QmlOverlay({ file: `${cwd}/calqlatr/Main.qml` });
// const overlay = new QmlOverlay({ file: `${cwd}/itemswitcher/qml/main.qml` });
scene.add(overlay.mesh);

const update = () => {
	renderer.render(scene, cameraPerspective);
};

loop(() => update());
