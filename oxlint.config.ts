import { defineConfig } from 'oxlint';
import type { OxlintConfig } from 'oxlint';
import sharedConfig from '@node-3d/addon-tools/oxlint';

const config: OxlintConfig = {
	...sharedConfig,
	ignorePatterns: [
		...sharedConfig.ignorePatterns,
		'examples/qt-calqlatr/calqlatr/content/calculator.js',
	],
};

export default defineConfig(config);
