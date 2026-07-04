import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import initForTest from './init.ts';

const inited = initForTest();
const { QmlOverlay, QmlMaterial, QmlOverlayMaterial, loop, doc } = inited;

const initResults = [
	'QmlOverlay',
	'QmlMaterial',
	'QmlOverlayMaterial',
	'Property',
	'Method',
	'View',
	'loop',
	'release',
	'textureFromId',
] as const satisfies readonly (keyof typeof inited)[];

const initedClasses = [
	{
		name: 'QmlOverlay',
		ctor: QmlOverlay,
		create() {
			return new QmlOverlay({ file: `${import.meta.dirname}/test.qml` });
		},
		props: ['isVisible', 'isDisabled', 'material', 'mesh'] as const,
	},
	{
		name: 'QmlMaterial',
		ctor: QmlMaterial,
		create() {
			return new QmlMaterial();
		},
		props: ['textureId'] as const,
	},
	{
		name: 'QmlOverlayMaterial',
		ctor: QmlOverlayMaterial,
		create() {
			return new QmlOverlayMaterial();
		},
		props: ['textureId'] as const,
	},
] as const;

const tested = describe('Qml 3D Inited', () => {
	it('returns all init results', () => {
		for (const name of initResults) {
			assert.strictEqual(typeof inited[name], 'function', `Init field "${name}" is missing.`);
		}
	});

	for (const current of initedClasses) {
		it(`exports class "${current.name}"`, () => {
			assert.strictEqual(typeof current.ctor, 'function');
		});

		const instance = current.create();

		it(`is valid instance of ${current.name}`, () => {
			assert.ok(
				instance instanceof current.ctor,
				`Can't instantiate class "${current.name}".`,
			);
		});

		it(`exposes properties of "${current.name}"`, () => {
			for (const prop of current.props) {
				assert.ok(prop in instance, `Property "${current.name}.${prop}" not found.`);
			}
		});
	}
});

const stop = loop(() => {
	// do nothing
});
await tested;
stop();
doc.destroy();
setTimeout(() => {
	/* nop */
}, 500);
