import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from './stores/session'
import SignInView from './views/SignInView.vue'
import WorkspaceView from './views/WorkspaceView.vue'

const titles: Record<string, string> = { '/': 'Overview', '/calls': 'Call activity', '/people': 'People & extensions', '/inbound': 'Inbound & IVR', '/trunks': 'SIP trunks', '/webhooks': 'Webhooks', '/health': 'System health', '/settings': 'Settings' }
const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/sign-in', name: 'sign-in', component: SignInView },
        { path: '/:pathMatch(.*)*', name: 'workspace', component: WorkspaceView, meta: { requiresAuth: true } },
    ],
})
router.beforeEach((to) => {
    const session = useSessionStore()
    if (to.meta.requiresAuth && !session.isAuthenticated) return { name: 'sign-in', query: { redirect: to.fullPath } }
    if (to.name === 'sign-in' && session.isAuthenticated) return '/'
})
router.afterEach((to) => { document.title = `${titles[to.path] ?? 'CommCare'} · CommCare`; if (to.name !== 'sign-in') to.meta.title = titles[to.path] ?? 'Overview' })
export default router
