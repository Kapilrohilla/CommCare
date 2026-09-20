export type AppRole = 'administrator' | 'operator' | 'integration-owner' | 'platform-administrator'

export const screenPermissions: Record<string, AppRole[]> = {
    overview: ['administrator', 'operator', 'integration-owner', 'platform-administrator'],
    setup: ['administrator', 'platform-administrator'],
    dialer: ['administrator', 'operator', 'platform-administrator'],
    calls: ['administrator', 'operator', 'integration-owner', 'platform-administrator'],
    people: ['administrator', 'platform-administrator'],
    users: ['administrator', 'platform-administrator'],
    extensions: ['administrator', 'platform-administrator'],
    inbound: ['administrator', 'platform-administrator'],
    ivr: ['administrator', 'platform-administrator'],
    trunks: ['administrator', 'platform-administrator'],
    recordings: ['administrator', 'operator', 'platform-administrator'],
    webhooks: ['administrator', 'integration-owner', 'platform-administrator'],
    webhookLogs: ['administrator', 'integration-owner', 'platform-administrator'],
    health: ['platform-administrator', 'administrator'],
    settings: ['administrator', 'platform-administrator'],
}

export function canAccess(screen: string, role: string | undefined): boolean {
    return screenPermissions[screen]?.includes((role?.toLowerCase() ?? 'operator') as AppRole) ?? false
}
