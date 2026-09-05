/**
 * Stasis appArgs convention: [workflow, tenantId, correlationId, ...workflowSpecific]
 *
 * @see openspec/changes/remove-freepbx-direct-asterisk-routing/design.md
 */
export const STASIS_WORKFLOW = {
	CLICK2CALL: 'click2call',
	IVR: 'ivr',
	INBOUND_ROUTE: 'inbound-route',
	AUTO_ATTENDANT: 'auto-attendant',
} as const;

export type StasisWorkflow = (typeof STASIS_WORKFLOW)[keyof typeof STASIS_WORKFLOW];

/** @deprecated Use STASIS_WORKFLOW.CLICK2CALL — kept for migration reads */
export const CLICK2CALL_APP_ARGS = {
	WORKFLOW: STASIS_WORKFLOW.CLICK2CALL,
	LEG_AGENT: 'agent',
	LEG_CALLEE: 'callee',
} as const;

export function buildClick2CallAppArgs(input: {
	tenantId: string;
	callId: string;
	toNumber: string;
	type: 'internal' | 'external';
	leg: 'agent' | 'callee';
}): string[] {
	return [
		STASIS_WORKFLOW.CLICK2CALL,
		input.tenantId,
		input.callId,
		input.toNumber,
		input.type,
		input.leg,
	];
}

export function buildIvrAppArgs(input: {
	tenantId: string;
	ivrSessionId: string;
	ivrId: string;
}): string[] {
	return [
		STASIS_WORKFLOW.IVR,
		input.tenantId,
		input.ivrSessionId,
		input.ivrId,
	];
}

export function buildInboundRouteAppArgs(input: {
	did: string;
	callerNumber: string;
}): string[] {
	return [STASIS_WORKFLOW.INBOUND_ROUTE, '', input.did, input.callerNumber];
}

export function parseStasisAppArgs(args: string[] | undefined): {
	workflow: string;
	tenantId: string;
	correlationId: string;
	rest: string[];
} | null {
	if (!args?.length) {
		return null;
	}

	const [workflow, tenantId = '', correlationId = '', ...rest] = args;
	if (!workflow) {
		return null;
	}

	return { workflow, tenantId, correlationId, rest };
}
