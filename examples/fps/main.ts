// oxlint-disable max-lines
// Based on https://threejs.org/examples/?q=fps#games_fps
import * as three from 'three';
import { init, addThreeHelpers, gl, glfw, Image } from '@node-3d/core';
import { init as initQml } from '@node-3d/plugin-qml';
import { extraCodes } from '@node-3d/glfw';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const cwd = import.meta.dirname;

const { doc } = init({
	isGles3: true,
	isWebGL2: true,
	mode: 'borderless',
	vsync: true,
});

addThreeHelpers(three);

const { QmlOverlay, Property, Method, View, loop, release, textureFromId } = initQml({
	doc,
	gl,
	cwd,
	three,
});

const icon = new Image(`${cwd}/../qml.png`);
icon.on('load', () => {
	if (icon.data) {
		doc.icon = { width: icon.width, height: icon.height, data: icon.data };
	}
});
doc.title = 'QML FPS';

const GRAVITY = 20;
const NUM_SPHERES = 100;
const NUM_ENEMIES = 10;
const SPHERE_RADIUS = 0.1;
const ENEMY_RADIUS = 1;
const TTL_SEC_SPHERE = 10;
const TTL_SEC_ENEMY = 10;
const TTL_SEC_EXPLOSION = 0.2;
const STEPS_PER_FRAME = 5;
const POS_ACTOR_HIDDEN = new three.Vector3(0, -100, 0);
const POS_PLAYER_START = new three.Vector3(0, 0.35, 0);
const POS_PLAYER_END = new three.Vector3(0, 1, 0);
const POS_ENEMY_TARGET = new three.Vector3(-2, 0.78, 0);
const SPARK_SIZE = 0.1;
const SCALE_EXPLOSION_START = 0.01;
const GUN_REFILL_RATE = 0.3;
const GUN_CHARGE_RATE = 0.7;
const SPEED_JUMP = 12;
const LAYER_WORLD = 0;
const LAYER_GUN = 1;
const ENEMY_RATE_START = 0.0005;
const DIFFICULTY_START = 1;

const sphereGeometry = new three.IcosahedronGeometry(SPHERE_RADIUS, 5);
const sphereMaterial = new three.MeshStandardMaterial({
	color: 0xdede8d,
	emissive: 0x8ddede,
	emissiveIntensity: 0.2,
});

const worldOctree = new Octree();
const playerCollider = new Capsule(POS_PLAYER_START.clone(), POS_PLAYER_END.clone(), 0.35);
const playerVelocity = new three.Vector3();
const playerDirection = new three.Vector3();
let playerOnFloor = false;
let mouseTime = 0;
const keyStates: Record<string, boolean> = {};
const vector1 = new three.Vector3();
const vector2 = new three.Vector3();
const vector3 = new three.Vector3();

type THudState = 'start' | 'hud' | 'esc' | 'over';
let hudState: THudState = 'start';
let gameScore: number = 0;
let gunCharge: number = 0;
let gunFuel: number = 1;
let health: number = 100;
let enemyRate = ENEMY_RATE_START;
let difficulty = DIFFICULTY_START;

const clock = new three.Clock();

const enemyMovePatterns = [
	(collider: three.Sphere) => {
		const time = Date.now() * 0.0001;
		collider.center.set(Math.sin(time) * 18, 15, Math.cos(time) * 8);
	},
	(collider: three.Sphere) => {
		const time = Date.now() * 0.0002;
		collider.center.set(Math.sin(time) * 12, 16, 10);
	},
	(collider: three.Sphere) => {
		const time = Date.now() * 0.0003;
		collider.center.set(Math.cos(time) * 18, 19, Math.sin(time) * 8 + 2 * Math.cos(time));
	},
	(collider: three.Sphere) => {
		const time = Date.now() * 0.0001;
		collider.center.set(0, 21, Math.sin(time) * 50);
	},
	(collider: three.Sphere) => {
		const time = Date.now() * 0.0002;
		collider.center.set(Math.sin(time) * 14, 19, Math.cos(time) * 19);
	},
	(collider: three.Sphere) => {
		const time = Date.now() * 0.0003;
		collider.center.set(Math.sin(time) * 18, 27, Math.cos(time) * 18);
	},
	(collider: three.Sphere) => {
		const time = Date.now() * 0.0001;
		collider.center.set(Math.sin(time) * 12, 30, 26);
	},
	(collider: three.Sphere) => {
		const time = Date.now() * 0.0002;
		collider.center.set(Math.cos(time) * 40, 18, Math.sin(time) * 14);
	},
	(collider: three.Sphere) => {
		const time = Date.now() * 0.0003;
		collider.center.set(40, 28 + 10 * Math.cos(time), Math.sin(time) * 10 + 2 * Math.cos(time));
	},
	(collider: three.Sphere) => {
		const time = Date.now() * 0.0001;
		collider.center.set(Math.sin(time) * 22, 26 + 2 * Math.sin(time), Math.cos(time) * 30);
	},
] as const;
const enemyMoveCount = enemyMovePatterns.length;

const renderer = new three.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(doc.w, doc.h);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = three.VSMShadowMap;
renderer.toneMapping = three.ACESFilmicToneMapping;
renderer.autoClear = false;

const scene = new three.Scene();
scene.background = new three.Color(0x88ccee);
scene.fog = new three.Fog(0x88ccee, 0, 50);

const overlay = new QmlOverlay({ file: `${cwd}/qml/Hud.qml` });
scene.add(overlay.mesh);
overlay.mesh.layers.enable(LAYER_GUN);
overlay.mesh.layers.disable(LAYER_WORLD);

type TMethodFlash = (color: 'red' | 'green') => void;
const methodHudFlash: TMethodFlash = new Method({
	view: overlay,
	name: 'hud',
	key: 'flashColor',
});

const gun = new three.Object3D();
gun.visible = false;
scene.add(gun);
gun.layers.enable(LAYER_GUN);
gun.layers.disable(LAYER_WORLD);

const scoreView = new View({ file: `${cwd}/qml/Score.qml` });
const materialScore = new three.SpriteMaterial();
materialScore.map = textureFromId(scoreView.textureId, renderer);
scoreView.on('reset', (textureId: number): void => {
	release();
	materialScore.map = textureFromId(textureId, renderer);
});

const spriteScore = new three.Sprite(materialScore);
spriteScore.position.set(0, 5, 0);
spriteScore.scale.set(5, 5, 1);
scene.add(spriteScore);

const propScore = new Property<number>({
	view: scoreView,
	name: 'score',
	key: 'score',
	value: gameScore,
});

type TExplosion = {
	update: (dt: number) => void;
	explode: (pos: three.Vector3) => void;
};

const explosion: TExplosion = ((): TExplosion => {
	const material = new three.PointsMaterial({
		size: SPARK_SIZE,
		color: 0xff000f,
	});

	const particles = new three.Points(sphereGeometry, material);
	particles.scale.set(SCALE_EXPLOSION_START, SCALE_EXPLOSION_START, SCALE_EXPLOSION_START);
	particles.position.copy(POS_ACTOR_HIDDEN);
	particles.visible = false;
	scene.add(particles);

	let ttl = 0;
	let isVisible = false;
	// let timeoutExplosion: NodeJS.Timeout | null = null;

	const update = (dt: number): void => {
		if (!isVisible) {
			return;
		}

		if (ttl > 0) {
			ttl = Math.max(0, ttl - dt);
		}

		if (ttl === 0) {
			isVisible = false;
			particles.position.copy(POS_ACTOR_HIDDEN);
			particles.visible = false;
			return;
		}

		const ttlFract = ttl / TTL_SEC_EXPLOSION;
		const t = 1 - ttlFract * ttlFract;
		const ds = SCALE_EXPLOSION_START + 10 * t;
		particles.scale.set(ds, ds, ds);
	};

	const explode = (pos: three.Vector3): void => {
		ttl = TTL_SEC_EXPLOSION;
		isVisible = true;
		particles.scale.set(SCALE_EXPLOSION_START, SCALE_EXPLOSION_START, SCALE_EXPLOSION_START);
		particles.position.copy(pos);
		particles.visible = true;
	};

	return {
		update,
		explode,
	};
})();

const cameraGun = new three.PerspectiveCamera(40, doc.w / doc.h, 0.001, 100);
cameraGun.rotation.order = 'YXZ';
cameraGun.layers.enable(LAYER_GUN);
cameraGun.layers.disable(LAYER_WORLD);

const camera = new three.PerspectiveCamera(95, doc.w / doc.h, 0.001, 100);
camera.rotation.order = 'YXZ';

const pitchLimitRad: number = Math.PI * 0.5 - 0.05;
let targetRotY: number = camera.rotation.y;
let targetRotX: number = camera.rotation.x;

const ambientLight1 = new three.AmbientLight(0x88ccee, 1.0);
scene.add(ambientLight1);
ambientLight1.layers.enable(LAYER_GUN);

const fillLight1 = new three.DirectionalLight(0x88ccee, 0.5);
fillLight1.position.set(5, -25, 1);
scene.add(fillLight1);
fillLight1.layers.enable(LAYER_GUN);

const directionalLight = new three.DirectionalLight(0xffffff, 2.0);
directionalLight.position.set(-5, 25, -1);
directionalLight.castShadow = true;
directionalLight.shadow.camera.near = 0.01;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.right = 30;
directionalLight.shadow.camera.left = -30;
directionalLight.shadow.camera.top = 30;
directionalLight.shadow.camera.bottom = -30;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.radius = 4;
directionalLight.shadow.bias = -0.00006;
scene.add(directionalLight);
directionalLight.layers.enable(LAYER_GUN);

type TActor = {
	ttl: number;
	isActive: boolean;
	mesh: three.Object3D;
	collider: three.Sphere;
	velocity: three.Vector3;
	mixer?: three.AnimationMixer | null;
};
const spherePool: TActor[] = [];
const enemyPool: TActor[] = [];

for (let i = 0; i < NUM_SPHERES; i++) {
	const sphere = new three.Mesh(sphereGeometry, sphereMaterial);
	sphere.castShadow = true;
	sphere.receiveShadow = true;

	scene.add(sphere);

	spherePool.push({
		ttl: -1,
		isActive: false,
		mesh: sphere,
		collider: new three.Sphere(POS_ACTOR_HIDDEN.clone(), SPHERE_RADIUS),
		velocity: new three.Vector3(),
	});
}

const resetPlayer = () => {
	playerVelocity.set(0, 0, 0);
	playerDirection.set(0, 0, 0);
	playerCollider.start.copy(POS_PLAYER_START);
	playerCollider.end.copy(POS_PLAYER_END);
	playerCollider.radius = 0.35;
	camera.position.copy(playerCollider.end);
	camera.rotation.set(0, 0, 0);
	cameraGun.position.copy(playerCollider.end);
	cameraGun.rotation.set(0, 0, 0);
	playerOnFloor = false;
	targetRotY = 0;
	targetRotX = 0;
};

const resetActor = (actor: TActor) => {
	actor.mesh.visible = false;
	actor.isActive = false;
	actor.ttl = -1;
	actor.collider.center.copy(POS_ACTOR_HIDDEN);
};

const resetSpheres = () => {
	for (const sphere of spherePool) {
		resetActor(sphere);
	}
};

const resetEnemies = () => {
	for (const enemy of enemyPool) {
		resetActor(enemy);
	}
};

const propHudMode = new Property<THudState>({
	view: overlay,
	name: 'hud',
	key: 'mode',
});

const propHudCharge = new Property<number>({
	view: overlay,
	name: 'hud',
	key: 'charge',
});

const propHudFuel = new Property<number>({
	view: overlay,
	name: 'hud',
	key: 'fuel',
});

const propHudScore = new Property<number>({
	view: overlay,
	name: 'hud',
	key: 'score',
});

const propHudHealth = new Property<number>({
	view: overlay,
	name: 'hud',
	key: 'hp',
});

setInterval(() => {
	if (hudState !== 'hud') {
		return;
	}
	propHudCharge.value = gunCharge;
	propHudFuel.value = gunFuel;
}, 100);

const leaveGame = () => {
	gun.visible = false;
	propHudScore.value = gameScore;
	hudState = 'over';
	propHudMode.value = 'over';
	propHudHealth.value = 0;
	doc.releasePointerCapture();
};

type TEscEvent = Readonly<{ button: string }>;

const gunOffset = new three.Vector3();
const updateGunOffset = (vel: three.Vector3, dt: number) => {
	vector1.copy(vel);
	vector1.y = 0;

	if (vector1.lengthSq() < 1) {
		vector2.set(0, 0, 0);
	} else {
		const time = Date.now();
		const swingX = 0.001 * Math.cos(time * 0.007);
		const swingY = 0.0005 * Math.sin(time * 0.014);
		vector2.set(swingX, swingY, 0);
	}

	gunOffset.lerp(vector2.addScaledVector(vel, -0.0001), 2 * dt);
};

const throwBall = () => {
	if (!mouseTime) {
		return;
	}

	const sphere = spherePool.find((sphere) => !sphere.isActive);
	if (!sphere) {
		return;
	}

	sphere.mesh.visible = true;
	sphere.isActive = true;
	sphere.ttl = TTL_SEC_SPHERE;

	camera.getWorldDirection(playerDirection);
	sphere.collider.center
		.copy(playerCollider.end)
		.addScaledVector(playerDirection, playerCollider.radius * 1.5);

	vector1.copy(playerDirection);
	vector1.multiplyScalar(-0.0015 * gunCharge);
	gunOffset.add(vector1);

	// throw the ball with more force if we hold the button longer, and if we move forward
	const impulse = 10 + 50 * gunCharge;
	mouseTime = 0;
	gunCharge = 0;

	sphere.velocity.copy(playerDirection).multiplyScalar(impulse);
	sphere.velocity.addScaledVector(playerVelocity, 2);
};

const playerCollisions = () => {
	const result = worldOctree.capsuleIntersect(playerCollider);

	playerOnFloor = false;

	if (result) {
		playerOnFloor = result.normal.y > 0;

		if (!playerOnFloor) {
			playerVelocity.addScaledVector(result.normal, -result.normal.dot(playerVelocity));
		}

		playerCollider.translate(result.normal.multiplyScalar(result.depth));
	}
};

const updatePlayer = (deltaTime: number) => {
	let damping = Math.exp(-4 * deltaTime) - 1;

	if (!playerOnFloor) {
		playerVelocity.y -= GRAVITY * deltaTime;
		// small air resistance
		damping *= 0.1;
	}

	playerVelocity.addScaledVector(playerVelocity, damping);

	const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
	playerCollider.translate(deltaPosition);

	playerCollisions();

	camera.position.copy(playerCollider.end);
};

const playerSphereCollision = (sphere: TActor): void => {
	const center = vector1.addVectors(playerCollider.start, playerCollider.end).multiplyScalar(0.5);
	const sphere_center = sphere.collider.center;
	const r = playerCollider.radius + sphere.collider.radius;
	const r2 = r * r;

	// approximation: player = 3 spherePool

	for (const point of [playerCollider.start, playerCollider.end, center]) {
		const d2 = point.distanceToSquared(sphere_center);

		if (d2 < r2) {
			const normal = vector1.subVectors(point, sphere_center).normalize();
			const v1 = vector2.copy(normal).multiplyScalar(normal.dot(playerVelocity));
			const v2 = vector3.copy(normal).multiplyScalar(normal.dot(sphere.velocity));

			playerVelocity.add(v2).sub(v1);
			sphere.velocity.add(v1).sub(v2);

			const d = (r - Math.sqrt(d2)) / 2;
			sphere_center.addScaledVector(normal, -d);
		}
	}
};

const spawnEnemy = (rate: number = 0) => {
	if (Math.random() > (rate || enemyRate)) {
		return;
	}

	const randIdx = Math.floor(Math.random() * enemyPool.length);
	const randEnemy = enemyPool[randIdx];
	if (randEnemy.isActive) {
		return;
	}

	randEnemy.ttl = TTL_SEC_ENEMY;
	randEnemy.isActive = true;
	enemyMovePatterns[randIdx % enemyMoveCount](randEnemy.collider);
	randEnemy.mesh.position.copy(randEnemy.collider.center);
	randEnemy.mesh.visible = true;
};

const killEnenmy = (enemy: TActor) => {
	explosion.explode(enemy.collider.center);
	resetActor(enemy);

	if (!enemyPool.some((enemy) => enemy.isActive)) {
		setTimeout(() => {
			spawnEnemy(1);
		}, 4000);
	}
};

const spheresCollisions = () => {
	const spherePoolSize = spherePool.length;
	const enemyPoolSize = enemyPool.length;

	for (let i = 0; i < spherePoolSize; i++) {
		const s1 = spherePool[i];
		if (!s1.isActive) {
			continue;
		}

		// Sphere vs Sphere
		for (let j = i + 1; j < spherePoolSize; j++) {
			const s2 = spherePool[j];
			if (!s2.isActive) {
				continue;
			}

			const d2 = s1.collider.center.distanceToSquared(s2.collider.center);
			const r = s1.collider.radius + s2.collider.radius;
			const r2 = r * r;

			if (d2 < r2) {
				const normal = vector1
					.subVectors(s1.collider.center, s2.collider.center)
					.normalize();
				const v1 = vector2.copy(normal).multiplyScalar(normal.dot(s1.velocity));
				const v2 = vector3.copy(normal).multiplyScalar(normal.dot(s2.velocity));

				s1.velocity.add(v2).sub(v1);
				s2.velocity.add(v1).sub(v2);

				const d = (r - Math.sqrt(d2)) / 2;

				s1.collider.center.addScaledVector(normal, d);
				s2.collider.center.addScaledVector(normal, -d);
			}
		}

		// Sphere vs Enemy
		for (let j = 0; j < enemyPoolSize; j++) {
			const s2 = enemyPool[j];
			if (!s2.isActive) {
				continue;
			}

			const d2 = s1.collider.center.distanceToSquared(s2.collider.center);
			const r = s1.collider.radius + s2.collider.radius;
			const r2 = r * r;

			if (d2 < r2) {
				killEnenmy(s2);

				health = Math.min(100, health + 1);
				propHudHealth.value = health;
				gameScore += 10;
				propScore.value = gameScore;
				methodHudFlash('green');
			}
		}
	}
};

const updateSpheres = (deltaTime: number) => {
	for (const sphere of spherePool) {
		if (!sphere.isActive) {
			continue;
		}
		if (sphere.ttl > 0) {
			sphere.ttl = Math.max(0, sphere.ttl - deltaTime);
		}

		if (sphere.ttl === 0) {
			resetActor(sphere);
			continue;
		}

		sphere.collider.center.addScaledVector(sphere.velocity, deltaTime);

		const result = worldOctree.sphereIntersect(sphere.collider);

		if (result) {
			sphere.velocity.addScaledVector(
				result.normal,
				-result.normal.dot(sphere.velocity) * 1.5,
			);
			sphere.collider.center.add(result.normal.multiplyScalar(result.depth));
		} else {
			sphere.velocity.y -= GRAVITY * deltaTime;
		}

		const damping = Math.exp(-1.5 * deltaTime) - 1;
		sphere.velocity.addScaledVector(sphere.velocity, damping);

		playerSphereCollision(sphere);
	}

	spheresCollisions();

	for (const sphere of spherePool) {
		if (sphere.isActive) {
			sphere.mesh.position.copy(sphere.collider.center);
		}
	}
};

const updateEnemies = (deltaTime: number) => {
	for (let i = 0; i < NUM_ENEMIES; i++) {
		const enemy: TActor = enemyPool[i];
		if (!enemy.isActive) {
			continue;
		}
		if (enemy.ttl > 0) {
			enemy.ttl = Math.max(0, enemy.ttl - deltaTime * difficulty);
		}

		if (enemy.ttl === 0) {
			resetActor(enemy);
			continue;
		}

		enemyMovePatterns[i % enemyMoveCount](enemy.collider);
		enemy.collider.center.lerp(POS_ENEMY_TARGET, 1 - enemy.ttl / TTL_SEC_ENEMY);
		if (enemy.collider.distanceToPoint(POS_ENEMY_TARGET) < 0.3) {
			health = Math.max(0, health - 10);
			propHudHealth.value = health;
			methodHudFlash('red');
			killEnenmy(enemy);
			continue;
		}

		enemy.mesh.lookAt(enemy.collider.center);
		enemy.mesh.position.copy(enemy.collider.center);
		enemy.mixer?.update(deltaTime);
	}
};

const getForwardVector = () => {
	camera.getWorldDirection(playerDirection);
	playerDirection.y = 0;
	playerDirection.normalize();

	return playerDirection;
};

const getSideVector = () => {
	camera.getWorldDirection(playerDirection);
	playerDirection.y = 0;
	playerDirection.normalize();
	playerDirection.cross(camera.up);

	return playerDirection;
};

const controls = (deltaTime: number) => {
	// gives a bit of air control
	const speedDelta = deltaTime * (playerOnFloor ? 25 : 8);

	if (keyStates[glfw.KEY_W]) {
		playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));
	}

	if (keyStates[glfw.KEY_S]) {
		playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta));
	}

	if (keyStates[glfw.KEY_A]) {
		playerVelocity.add(getSideVector().multiplyScalar(-speedDelta));
	}

	if (keyStates[glfw.KEY_D]) {
		playerVelocity.add(getSideVector().multiplyScalar(speedDelta));
	}

	if (playerOnFloor && keyStates[glfw.KEY_SPACE]) {
		playerVelocity.y = SPEED_JUMP;
	}
};

const loader = new GLTFLoader();

const loadModel = (name: string, onLoad: (gltf: GLTF) => void): void => {
	loader.load(`${cwd}/models/${name}`, onLoad);
};

loadModel('collision-world.glb', (gltf) => {
	scene.add(gltf.scene);
	worldOctree.fromGraphNode(gltf.scene);
	gltf.scene.traverse((child: three.Object3D | three.Mesh) => {
		if (!(child instanceof three.Mesh)) {
			return;
		}

		child.castShadow = true;
		child.receiveShadow = true;

		if (child.material.map) {
			child.material.map.anisotropy = 4;
		}
	});

	const helper = new OctreeHelper(worldOctree) as three.Object3D;
	helper.visible = false;
	scene.add(helper);
});

for (let i = 0; i < NUM_ENEMIES; i++) {
	enemyPool.push({
		isActive: false,
		ttl: -1,
		mesh: new three.Object3D(),
		collider: new three.Sphere(POS_ACTOR_HIDDEN.clone(), ENEMY_RADIUS),
		velocity: new three.Vector3(),
		mixer: null,
	});
}

loadModel('Flamingo.glb', (gltf) => {
	const mesh = gltf.scene.children[0];

	if (!(mesh instanceof three.Mesh)) {
		return;
	}

	const s = 0.01;
	mesh.scale.set(s, s, s);
	mesh.position.copy(POS_ACTOR_HIDDEN);

	mesh.castShadow = true;
	mesh.receiveShadow = true;

	for (const enemy of enemyPool) {
		const meshClone = mesh.clone();
		scene.add(meshClone);

		const mixer = new three.AnimationMixer(meshClone);
		mixer.clipAction(gltf.animations[0]).setDuration(1).play();

		enemy.mesh = meshClone;
		enemy.mixer = mixer;
	}
});

loadModel('blasterG.glb', (gltf) => {
	const mesh = gltf.scene.children[0];

	gltf.scene.traverse((node) => {
		node.layers.enable(LAYER_GUN);
		node.layers.disable(LAYER_WORLD);
		if (node instanceof three.Mesh) {
			const mat = node.material as three.MeshStandardMaterial;
			const newMat = new three.MeshStandardMaterial({ color: mat.color });
			// newMat.depthTest = false;
			node.material = newMat;
			node.castShadow = false;
			node.receiveShadow = true;
		}
	});

	const s = 0.003;
	mesh.scale.set(s, s, s);
	mesh.position.set(0.002, -0.002, -0.007);
	mesh.rotation.y = Math.PI + 0.1;
	mesh.rotation.x = 0.1;

	gun.add(mesh);
});

loadModel('targetB.glb', (gltf) => {
	const mesh = gltf.scene.children[0];

	gltf.scene.traverse((node) => {
		if (node instanceof three.Mesh) {
			const mat = node.material as three.MeshStandardMaterial;
			const newMat = new three.MeshStandardMaterial({ color: mat.color });
			node.material = newMat;
			node.castShadow = true;
			node.receiveShadow = true;
		}
	});

	const s = 3.0;
	mesh.scale.set(s, s, s);
	mesh.position.copy(POS_ENEMY_TARGET);
	mesh.rotation.z = Math.PI / 2;

	scene.add(mesh);
});

const teleportPlayerIfOob = () => {
	if (camera.position.y > -25) {
		return;
	}

	resetPlayer();
};

const animate = () => {
	if (!health && hudState !== 'over') {
		leaveGame();
	}

	if (hudState === 'hud') {
		const deltaTime = Math.min(0.05, clock.getDelta());
		const deltaStep = deltaTime / STEPS_PER_FRAME;

		gunFuel = Math.min(1, gunFuel + deltaTime * GUN_REFILL_RATE);

		if (mouseTime) {
			const dc = Math.min(1 - gunCharge, gunFuel, deltaTime * GUN_CHARGE_RATE);
			gunFuel -= dc;
			gunCharge += dc;
		}

		// we look for collisions in substeps to mitigate the risk of
		// an object traversing another too quickly for detection.

		for (let i = 0; i < STEPS_PER_FRAME; i++) {
			controls(deltaStep);
			updatePlayer(deltaStep);
			updateSpheres(deltaStep);
			teleportPlayerIfOob();
		}

		updateEnemies(deltaTime);

		explosion.update(deltaTime);

		enemyRate += deltaTime * 0.0001;
		difficulty += deltaTime * 0.01;
		spawnEnemy();

		camera.rotation.y = targetRotY;
		camera.rotation.x = targetRotX;
		updateGunOffset(playerVelocity, deltaTime);
	}

	renderer.render(scene, camera);

	const backgroundPrev = scene.background;
	const fogPrev = scene.fog;
	scene.background = null;
	scene.fog = null;

	if (hudState === 'hud') {
		cameraGun.position.copy(camera.position);
		cameraGun.rotation.copy(camera.rotation);
		gun.position.copy(camera.position).add(gunOffset);
		gun.rotation.copy(camera.rotation);
	}
	renderer.render(scene, cameraGun);

	scene.background = backgroundPrev;
	scene.fog = fogPrev;
};

const restartGame = () => {
	resetPlayer();
	mouseTime = 0;
	resetSpheres();
	resetEnemies();
	spawnEnemy(1);

	enemyRate = ENEMY_RATE_START;
	difficulty = DIFFICULTY_START;

	gunCharge = 0;
	gunFuel = 1;
	health = 100;
	hudState = 'hud';
	propHudMode.value = 'hud';

	propHudCharge.value = gunCharge;
	propHudFuel.value = gunFuel;
	propHudHealth.value = health;
	gun.visible = true;

	gameScore = 0;
	propScore.value = gameScore;

	doc.setPointerCapture();
};

doc.on('keydown', (e) => {
	release();
	if (hudState !== 'hud') {
		return;
	}
	keyStates[e['keyCode']] = true;
});

doc.on('keyup', (e) => {
	release();
	keyStates[e['keyCode']] = false;
	if (e['keyCode'] === extraCodes[glfw.KEY_ESCAPE]) {
		if (hudState !== 'hud' && hudState !== 'esc') {
			return;
		}
		hudState = hudState === 'hud' ? 'esc' : 'hud';
		if (hudState === 'hud') {
			doc.setPointerCapture();
		} else {
			doc.releasePointerCapture();
		}
		propHudMode.value = hudState;
	}
});

doc.on('mousedown', () => {
	if (hudState !== 'hud') {
		return;
	}
	release();
	mouseTime = Date.now();
});

doc.on('mouseup', () => {
	if (hudState !== 'hud') {
		return;
	}
	release();
	throwBall();
});

doc.on('mousemove', (event) => {
	if (hudState !== 'hud') {
		return;
	}
	release();

	const newYaw: number = targetRotY - event['movementX'] * 0.001;
	const newPitch: number = targetRotX - event['movementY'] * 0.001;

	targetRotY = newYaw;
	targetRotX = Math.min(pitchLimitRad, Math.max(-pitchLimitRad, newPitch));
});

doc.on('resize', () => {
	release();
	camera.aspect = doc.w / doc.h;
	camera.updateProjectionMatrix();
	cameraGun.aspect = doc.w / doc.h;
	cameraGun.updateProjectionMatrix();
	renderer.setSize(doc.w, doc.h);
});

overlay.on('custom-esc', (event: TEscEvent) => {
	release();
	if (event.button === 'resume') {
		mouseTime = 0;
		hudState = 'hud';
		propHudMode.value = hudState;
		doc.setPointerCapture();
	}
	if (event.button === 'start') {
		restartGame();
	}
	if (event.button === 'restart') {
		restartGame();
	}
	if (event.button === 'leave') {
		leaveGame();
	}
	if (event.button === 'quit') {
		process.exit(0);
	}
});

loop(animate);
