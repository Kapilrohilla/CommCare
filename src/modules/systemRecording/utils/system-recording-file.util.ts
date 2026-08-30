import {
	SYSTEM_RECORDING_ALLOWED_EXTENSIONS,
	SystemRecordingAllowedExtension,
} from '../constants/system-recording.constant';

export function getFileExtension(fileName: string): string | null {
	const lastDot = fileName.lastIndexOf('.');
	if (lastDot <= 0 || lastDot === fileName.length - 1) {
		return null;
	}

	return fileName.slice(lastDot + 1).toLowerCase();
}

export function isAllowedSystemRecordingExtension(
	extension: string,
): extension is SystemRecordingAllowedExtension {
	return SYSTEM_RECORDING_ALLOWED_EXTENSIONS.includes(
		extension as SystemRecordingAllowedExtension,
	);
}

export function assertAllowedSystemRecordingFileName(fileName: string): void {
	const extension = getFileExtension(fileName);

	if (!extension || !isAllowedSystemRecordingExtension(extension)) {
		throw new Error(
			`Unsupported file format. Allowed extensions: ${SYSTEM_RECORDING_ALLOWED_EXTENSIONS.join(', ')}`,
		);
	}
}

export function getAllowedExtensionFromFileName(
	fileName: string,
): SystemRecordingAllowedExtension {
	const extension = getFileExtension(fileName);

	if (!extension || !isAllowedSystemRecordingExtension(extension)) {
		throw new Error(
			`Unsupported file format. Allowed extensions: ${SYSTEM_RECORDING_ALLOWED_EXTENSIONS.join(', ')}`,
		);
	}

	return extension;
}
