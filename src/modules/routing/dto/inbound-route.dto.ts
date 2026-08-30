import z from 'zod';
import {
	InboundRouteDestinationType,
	InboundRouteSourceType,
} from '../constants/inbound-routes.constant';

const sourceRefinement = (
	data: {
		sourceType: InboundRouteSourceType;
		sourceId?: string | null;
		sourceValue?: string | null;
	},
	ctx: z.RefinementCtx,
) => {
	switch (data.sourceType) {
		case InboundRouteSourceType.Extension:
			if (!data.sourceId) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'sourceId is required for extension source',
					path: ['sourceId'],
				});
			}
			return;
		case InboundRouteSourceType.PhoneNumber:
			if (!data.sourceValue?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'sourceValue is required for phone_number source',
					path: ['sourceValue'],
				});
			}
			return;
		case InboundRouteSourceType.FeatureCode:
			if (!data.sourceValue?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'sourceValue is required for feature_code source',
					path: ['sourceValue'],
				});
			}
			return;
	}
};

const destinationRefinement = (
	data: {
		destinationType: InboundRouteDestinationType;
		destinationId?: string | null;
		destinationValue?: string | null;
	},
	ctx: z.RefinementCtx,
) => {
	switch (data.destinationType) {
		case InboundRouteDestinationType.Hangup:
			if (data.destinationId || data.destinationValue) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'destinationId and destinationValue must be empty for hangup',
					path: ['destinationType'],
				});
			}
			return;
		case InboundRouteDestinationType.ExternalNumber:
			if (!data.destinationValue?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'destinationValue is required for external_number destination',
					path: ['destinationValue'],
				});
			}
			if (data.destinationId) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'destinationId must be empty for external_number destination',
					path: ['destinationId'],
				});
			}
			return;
		case InboundRouteDestinationType.Extension:
		case InboundRouteDestinationType.Queue:
		case InboundRouteDestinationType.IVR:
		case InboundRouteDestinationType.Voicemail:
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
			return;
	}
};

const InboundRouteBaseSchema = z.object({
	sourceType: z.nativeEnum(InboundRouteSourceType),
	sourceId: z.string().uuid().optional(),
	sourceValue: z.string().min(1).max(64).optional(),
	destinationType: z.nativeEnum(InboundRouteDestinationType),
	destinationId: z.string().uuid().optional(),
	destinationValue: z.string().min(1).max(64).optional(),
	enabled: z.boolean().optional(),
});

export const CreateInboundRouteDto = InboundRouteBaseSchema.strict()
	.superRefine((data, ctx) => {
		sourceRefinement(data, ctx);
		destinationRefinement(data, ctx);
	});

export const UpdateInboundRouteDto = InboundRouteBaseSchema.partial()
	.strict()
	.superRefine((data, ctx) => {
		if (data.sourceType !== undefined) {
			sourceRefinement(
				{
					sourceType: data.sourceType,
					sourceId: data.sourceId ?? null,
					sourceValue: data.sourceValue ?? null,
				},
				ctx,
			);
		}
		if (data.destinationType !== undefined) {
			destinationRefinement(
				{
					destinationType: data.destinationType,
					destinationId: data.destinationId ?? null,
					destinationValue: data.destinationValue ?? null,
				},
				ctx,
			);
		}
	});

export type CreateInboundRouteDto = z.infer<typeof CreateInboundRouteDto>;
export type UpdateInboundRouteDto = z.infer<typeof UpdateInboundRouteDto>;
