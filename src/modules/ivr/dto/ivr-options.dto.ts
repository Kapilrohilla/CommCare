import z from 'zod';
import {
	IVR_OPTION_DIGIT_PATTERN,
	IVROptionDestinationType,
} from '../constants/ivr-options.constant';

const ivrOptionDestinationRefinement = (
	data: {
		destinationType: IVROptionDestinationType;
		destinationId?: string | null;
		destinationValue?: string | null;
	},
	ctx: z.RefinementCtx,
) => {
	if (data.destinationType === IVROptionDestinationType.HANGUP) {
		if (data.destinationId || data.destinationValue) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'destinationId and destinationValue must be empty for hangup',
				path: ['destinationType'],
			});
		}
		return;
	}

	if (data.destinationType === IVROptionDestinationType.PHONE_NUMBER) {
		if (!data.destinationValue?.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'destinationValue is required for PhoneNumber',
				path: ['destinationValue'],
			});
		}
		if (data.destinationId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'destinationId must be empty for PhoneNumber',
				path: ['destinationId'],
			});
		}
		return;
	}

	if (!data.destinationId) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'destinationId is required for this destination type',
			path: ['destinationId'],
		});
	}

	if (data.destinationValue) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'destinationValue must be empty for this destination type',
			path: ['destinationValue'],
		});
	}
};

const IvrOptionBaseSchema = z.object({
	digit: z.string().regex(IVR_OPTION_DIGIT_PATTERN, 'digit must be 0-9, *, or #'),
	destinationType: z.nativeEnum(IVROptionDestinationType),
	destinationId: z.string().uuid().optional(),
	destinationValue: z.string().min(1).max(64).optional(),
});

export const CreateIvrOptionDto = IvrOptionBaseSchema.strict().superRefine(
	ivrOptionDestinationRefinement,
);

export const UpdateIvrOptionDto = IvrOptionBaseSchema.partial()
	.strict()
	.superRefine((data, ctx) => {
		if (data.destinationType === undefined) {
			return;
		}

		ivrOptionDestinationRefinement(
			{
				destinationType: data.destinationType,
				destinationId: data.destinationId ?? null,
				destinationValue: data.destinationValue ?? null,
			},
			ctx,
		);
	});

export type CreateIvrOptionDto = z.infer<typeof CreateIvrOptionDto>;
export type UpdateIvrOptionDto = z.infer<typeof UpdateIvrOptionDto>;
