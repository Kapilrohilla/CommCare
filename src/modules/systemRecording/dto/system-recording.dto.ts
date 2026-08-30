import z from 'zod';
import { SystemRecordingSourceType } from '../constants/system-recording.constant';
import {
	getFileExtension,
	isAllowedSystemRecordingExtension,
} from '../utils/system-recording-file.util';

const SystemRecordingFileNameSchema = z
	.string()
	.min(1)
	.max(255)
	.refine(
		(fileName) => {
			const extension = getFileExtension(fileName);
			return extension !== null && isAllowedSystemRecordingExtension(extension);
		},
		{ message: 'fileName must have a .wav, .mp3, or .gsm extension' },
	);

export const CreateSystemRecordingDto = z
	.object({
		name: z.string().min(1).max(255),
		description: z.string().max(5000).optional(),
	})
	.strict();

export const UpdateSystemRecordingDto = z
	.object({
		name: z.string().min(1).max(255).optional(),
		description: z.string().max(5000).optional(),
		sourceType: z.nativeEnum(SystemRecordingSourceType).optional(),
		ttsLanguage: z.string().min(2).max(16).optional(),
		ttsVoice: z.string().min(1).max(64).optional(),
		ttsText: z.string().min(1).max(10000).optional(),
	})
	.strict();

export const UploadSystemRecordingFileDto = z
	.object({
		fileName: SystemRecordingFileNameSchema,
	})
	.strict();

export const ConfirmUploadSystemRecordingDto = UploadSystemRecordingFileDto;

export type CreateSystemRecordingDto = z.infer<typeof CreateSystemRecordingDto>;
export type UpdateSystemRecordingDto = z.infer<typeof UpdateSystemRecordingDto>;
export type UploadSystemRecordingFileDto = z.infer<
	typeof UploadSystemRecordingFileDto
>;
export type ConfirmUploadSystemRecordingDto = z.infer<
	typeof ConfirmUploadSystemRecordingDto
>;
