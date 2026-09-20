const VISITOR_ID_KEY = 'commcare.visitorId'

export function getOrCreateVisitorId(): string {
  const existing = localStorage.getItem(VISITOR_ID_KEY)
  if (existing) return existing
  const visitorId = crypto.randomUUID()
  localStorage.setItem(VISITOR_ID_KEY, visitorId)
  return visitorId
}

export function getVisitorId(): string | null {
  return localStorage.getItem(VISITOR_ID_KEY)
}
