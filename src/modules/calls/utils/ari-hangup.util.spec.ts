import { CallLegStatus, CallStatus } from '../constants/call.constant';
import {
	ASTERISK_HANGUP_CAUSE,
	isNoAnswerCallStatus,
	isNoAnswerHangupCause,
	resolveCallEndStatus,
	resolveLegEndStatus,
} from './ari-hangup.util';

describe('ari-hangup.util', () => {
	describe('resolveLegEndStatus', () => {
		it('returns COMPLETED when bridged and leg was answered', () => {
			expect(
				resolveLegEndStatus({
					legWasAnswered: true,
					wasBridged: true,
					hangupCause: ASTERISK_HANGUP_CAUSE.NORMAL_CLEARING,
				}),
			).toBe(CallLegStatus.COMPLETED);
		});

		it('returns NO_ANSWER when caller leg never answered', () => {
			expect(
				resolveLegEndStatus({
					legWasAnswered: false,
					wasBridged: false,
					hangupCause: null,
				}),
			).toBe(CallLegStatus.NO_ANSWER);
		});

		it('returns BUSY for busy cause', () => {
			expect(
				resolveLegEndStatus({
					legWasAnswered: false,
					wasBridged: false,
					hangupCause: ASTERISK_HANGUP_CAUSE.USER_BUSY,
				}),
			).toBe(CallLegStatus.BUSY);
		});
	});

	describe('resolveCallEndStatus', () => {
		it('returns NO_ANSWER when callee leg never answered', () => {
			expect(
				resolveCallEndStatus({
					isCallerLeg: false,
					isCalleeLeg: true,
					legWasAnswered: false,
					wasBridged: false,
					hangupCause: ASTERISK_HANGUP_CAUSE.NO_ANSWER,
				}),
			).toBe(CallStatus.NO_ANSWER);
		});

		it('returns COMPLETED when call was bridged', () => {
			expect(
				resolveCallEndStatus({
					isCallerLeg: true,
					isCalleeLeg: false,
					legWasAnswered: true,
					wasBridged: true,
					hangupCause: ASTERISK_HANGUP_CAUSE.NORMAL_CLEARING,
				}),
			).toBe(CallStatus.COMPLETED);
		});
	});

	describe('isNoAnswerHangupCause', () => {
		it('recognizes standard no-answer causes', () => {
			expect(isNoAnswerHangupCause(ASTERISK_HANGUP_CAUSE.NO_ANSWER)).toBe(true);
			expect(isNoAnswerHangupCause(ASTERISK_HANGUP_CAUSE.USER_BUSY)).toBe(false);
		});
	});

	describe('isNoAnswerCallStatus', () => {
		it('detects no_answer call status', () => {
			expect(isNoAnswerCallStatus(CallStatus.NO_ANSWER)).toBe(true);
			expect(isNoAnswerCallStatus(CallStatus.COMPLETED)).toBe(false);
		});
	});
});
