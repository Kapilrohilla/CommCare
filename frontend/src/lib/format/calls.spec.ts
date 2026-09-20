import { describe, expect, it } from 'vitest'
import {
  callParticipant,
  formatCallDuration,
  formatStatusLabel,
  formatTalkTime,
} from './calls'

describe('call format helpers', () => {
  it('formats durations and talk time', () => {
    expect(formatCallDuration(278)).toBe('04:38')
    expect(formatCallDuration(0)).toBe('—')
    expect(formatTalkTime(6720)).toBe('1h 52m')
  })

  it('formats status labels and participants', () => {
    expect(formatStatusLabel('no_answer')).toBe('No Answer')
    expect(callParticipant({ id: '1', status: 'completed', callerNumber: '+14155550138', agentExtension: '201' })).toEqual({
      name: 'Ext 201',
      number: '+14155550138',
    })
  })
})
