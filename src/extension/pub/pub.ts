import * as fs from "fs";
import * as path from "path";
import { commands, Uri, window } from "vscode";
import { Logger, Sdks } from "../../shared/interfaces";
import { PackageMap } from "../../shared/pub/package_map";
import { fsPath, isWithinPath } from "../../shared/utils/fs";

// TODO: Wrap these up into a class.

export function isPubGetProbablyRequired(sdks: Sdks, logger: Logger, folderUri: Uri): boolean {
	const folder = fsPath(folderUri);
	const pubspecPath = path.join(folder, "pubspec.yaml");
	const packagesPath = path.join(folder, ".packages");
	if (!folder || !fs.existsSync(pubspecPath))
		return false;

	// If we don't appear to have deps listed in pubspec, then no point prompting.
	const regex = new RegExp("dependencies\\s*:", "i");
	if (!regex.test(fs.readFileSync(pubspecPath).toString()))
		return false;

	// If we don't have .packages, we probably need running.
	if (!fs.existsSync(packagesPath))
		return true;

	const pubspecModified = fs.statSync(pubspecPath).mtime;
	const packagesModified = fs.statSync(packagesPath).mtime;

	if (pubspecModified > packagesModified)
		return true;

	// If we're a Flutter project and our SDK doesn't match the one used
	// in the package file, we also need running.
	if (sdks.flutter) {
		const packageMap = PackageMap.loadForProject(logger, folder);
		const flutterPackagePath = packageMap.getPackagePath("flutter");
		if (flutterPackagePath && !isWithinPath(flutterPackagePath, sdks.flutter)) {
			return true;
		}
	}

	return false;
}

export function promptToRunPubGet(folders: Uri[]) {
	const label = "Get packages";
	window.showInformationMessage("Some packages are missing or out of date, would you like to get them now?", label).then((clickedButton) => {
		if (clickedButton === label)
			getPackages(folders);
	});
}

function getPackages(folders: Uri[]) {
	let task = commands.executeCommand("dart.getPackages", folders[0]);
	for (let i = 1; i < folders.length; i++) {
		task = task.then((code) => {
			if (code === 0) // Continue with next one only if success
				return commands.executeCommand("dart.getPackages", folders[i]);
		});
	}
}
