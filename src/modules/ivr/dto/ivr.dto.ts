import z from 'zod';
import { IVROptionDestinationType } from '../constants/ivr-options.constant';
import { IVRInvalidKeyAction } from '../constants/ivr.constant';

const finalTimeoutDestinationRefinement = (
	data: {
		finalTimeoutDestinationType?: IVROptionDestinationType;
		finalTimeoutDestinationId?: string | null;
		finalTimeoutDestinationValue?: string | null;
	},
	ctx: z.RefinementCtx,
) => {
	const destinationType =
		data.finalTimeoutDestinationType ?? IVROptionDestinationType.HANGUP;

	if (destinationType === IVROptionDestinationType.HANGUP) {
		if (data.finalTimeoutDestinationId || data.finalTimeoutDestinationValue) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					'finalTimeoutDestinationId and finalTimeoutDestinationValue must be empty for hangup',
				path: ['finalTimeoutDestinationType'],
			});
		}
		return;
	}

	if (destinationType === IVROptionDestinationType.PHONE_NUMBER) {
		if (!data.finalTimeoutDestinationValue?.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'finalTimeoutDestinationValue is required for PhoneNumber',
				path: ['finalTimeoutDestinationValue'],
			});
		}
		if (data.finalTimeoutDestinationId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'finalTimeoutDestinationId must be empty for PhoneNumber',
				path: ['finalTimeoutDestinationId'],
			});
		}
		return;
	}

	if (!data.finalTimeoutDestinationId) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'finalTimeoutDestinationId is required for this destination type',
			path: ['finalTimeoutDestinationId'],
		});
	}

	if (data.finalTimeoutDestinationValue) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'finalTimeoutDestinationValue must be empty for this destination type',
			path: ['finalTimeoutDestinationValue'],
		});
	}
};

const IvrBaseSchema = z.object({
	name: z.string().trim().min(1).max(120),
	description: z.string().trim().max(500).nullable().optional(),
	announcementRecordingId: z.string().uuid().nullable().optional(),
	enabled: z.boolean().optional(),
	inputTimeoutSeconds: z.number().int().min(1).max(60).optional(),
	maxInvalidRetries: z.number().int().min(0).max(10).optional(),
	invalidKeyAction: z.nativeEnum(IVRInvalidKeyAction).optional(),
	finalTimeoutDestinationType: z.nativeEnum(IVROptionDestinationType).optional(),
	finalTimeoutDestinationId: z.string().uuid().optional(),
	finalTimeoutDestinationValue: z.string().min(1).max(64).optional(),
});

export const CreateIvrDto = IvrBaseSchema.strict().superRefine(
	finalTimeoutDestinationRefinement,
);

export const UpdateIvrDto = IvrBaseSchema.partial()
	.strict()
	.superRefine(finalTimeoutDestinationRefinement);

export type CreateIvrDto = z.infer<typeof CreateIvrDto>;
export type UpdateIvrDto = z.infer<typeof UpdateIvrDto>;
