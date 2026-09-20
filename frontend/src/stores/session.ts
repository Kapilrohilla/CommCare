import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'commcare.session'
type Session = { token: string; user: string; tenant: string; role: string }

export const useSessionStore = defineStore('session', () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    const current = ref<Session | null>(stored ? JSON.parse(stored) : null)
    const isAuthenticated = computed(() => Boolean(current.value?.token))
    function signIn(email: string) { const next: Session = { token: `demo-token-${Date.now()}`, user: email.split('@')[0] || 'operator', tenant: 'Atlas Field Ops', role: 'Administrator' }; current.value = next; localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) }
    function clear() { current.value = null; localStorage.removeItem(STORAGE_KEY) }
    return { current, isAuthenticated, signIn, clear }
})
