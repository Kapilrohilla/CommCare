import z from 'zod';
import { SipTrunkAuthMode } from '../constants/sip-trunk.constant';

const identifyIpSchema = z
	.string()
	.trim()
	.min(1)
	.max(80);

const baseTrunkFields = {
	name: z.string().trim().min(1).max(128),
	authMode: z.nativeEnum(SipTrunkAuthMode),
	username: z.string().trim().min(1).max(80).nullable().optional(),
	password: z.string().min(1).max(128).nullable().optional(),
	enabled: z.boolean().optional(),
	identifyIps: z.array(identifyIpSchema).optional(),
};

const trunkAuthRefinement = (
	data: {
		authMode: SipTrunkAuthMode;
		username?: string | null;
		password?: string | null;
		identifyIps?: string[];
	},
	ctx: z.RefinementCtx,
) => {
	if (data.authMode === SipTrunkAuthMode.Ip) {
		if (!data.identifyIps?.length) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'identifyIps is required for ip auth mode',
				path: ['identifyIps'],
			});
		}
		return;
	}

	if (!data.username?.trim()) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'username is required for credentials auth mode',
			path: ['username'],
		});
	}
	if (!data.password?.trim()) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'password is required for credentials auth mode',
			path: ['password'],
		});
	}
};

export const CreateSipTrunkDto = z
	.object(baseTrunkFields)
	.superRefine(trunkAuthRefinement);

export type CreateSipTrunkDto = z.infer<typeof CreateSipTrunkDto>;

export const UpdateSipTrunkDto = z
	.object({
		name: z.string().trim().min(1).max(128).optional(),
		authMode: z.nativeEnum(SipTrunkAuthMode).optional(),
		username: z.string().trim().min(1).max(80).nullable().optional(),
		password: z.string().min(1).max(128).nullable().optional(),
		enabled: z.boolean().optional(),
		identifyIps: z.array(identifyIpSchema).optional(),
	})
	.superRefine((data, ctx) => {
		if (data.authMode === undefined) {
			return;
		}
		trunkAuthRefinement(
			{
				authMode: data.authMode,
				username: data.username,
				password: data.password,
				identifyIps: data.identifyIps,
			},
			ctx,
		);
	});

export type UpdateSipTrunkDto = z.infer<typeof UpdateSipTrunkDto>;
