import z from "zod";

export const CreateUploadUrlDto = z.object({
	path: z.string().min(1)
});

export const CreateDownloadUrlDto = z.object({
	path: z.string().min(1),
	expiresIn: z.number().min(1)
});

export const DeleteFileDto = z.object({
	path: z.string().min(1)
});

export const ExistsDto = z.object({
	path: z.string().min(1)
});

export const PutObjectDto = z.object({
	path: z.string().min(1),
	body: z.instanceof(Buffer),
	contentType: z.string().min(1),
});


export const CreateUploadUrlResponseDto = z.object({
	url: z.string().min(1)
});

export const CreateDownloadUrlResponseDto = z.object({
	url: z.string().min(1)
});

export const DeleteFileResponseDto = z.object({
	success: z.boolean()
});

export const ExistsResponseDto = z.object({
	exists: z.boolean()
});

export type CreateUploadUrlDto = z.infer<typeof CreateUploadUrlDto>;
export type CreateDownloadUrlDto = z.infer<typeof CreateDownloadUrlDto>;
export type DeleteFileDto = z.infer<typeof DeleteFileDto>;
export type ExistsDto = z.infer<typeof ExistsDto>;
export type PutObjectDto = z.infer<typeof PutObjectDto>;

export type UploadUrl = z.infer<typeof CreateUploadUrlResponseDto>;
export type DownloadUrl = z.infer<typeof CreateDownloadUrlResponseDto>;