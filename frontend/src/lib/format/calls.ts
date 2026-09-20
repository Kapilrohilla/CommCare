import type { Call } from '../services/types'

export function formatCallDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) return '—'
  if (seconds <= 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function formatTalkTime(seconds?: number | null): string {
  if (seconds === undefined || seconds === null) return '—'
  if (seconds <= 0) return '0m'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export function formatCallTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatStatusLabel(status?: string | null): string {
  if (!status) return 'Unknown'
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatDirectionLabel(direction?: string | null): string {
  if (!direction) return '—'
  return direction.charAt(0).toUpperCase() + direction.slice(1)
}

export function formatWorkflowLabel(workflow?: string | null): string {
  if (!workflow) return '—'
  return workflow
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function callParticipant(call: Call): { name: string; number: string } {
  const number = call.callerNumber || call.callToNumber || call.fromNumber || call.toNumber || 'Unknown'
  const name = call.agentExtension ? `Ext ${call.agentExtension}` : number
  return { name, number }
}

export function callInitials(label: string): string {
  const parts = label.replace(/^\+/, '').split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return label.slice(0, 2).toUpperCase() || '?'
}
