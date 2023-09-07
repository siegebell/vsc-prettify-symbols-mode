import * as path from 'path';
import * as tmp from 'tmp-promise';

import { runTests } from '@vscode/test-electron';

async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		const storagePath = await tmp.dir();
		const userDataDir = path.join(storagePath.path, 'settings');
    // const userSettingsPath = path.join(userDataDir, 'User');
		const launchArgs = [path.resolve(__dirname, '../../testFixture'), "--disable-extensions", "--user-data-dir=" + userDataDir];

		// Download VS Code, unzip it and run the integration test
		await runTests({ extensionDevelopmentPath, extensionTestsPath, launchArgs });
	} catch (err) {
		console.error('Failed to run tests');
		process.exit(1);
	}
}

main();