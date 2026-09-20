import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from './stores/session'
import SignInView from './views/SignInView.vue'
import OtpView from './views/OtpView.vue'
import AppShell from './components/AppShell.vue'
import OverviewView from './views/OverviewView.vue'
import SetupChecklistView from './views/SetupChecklistView.vue'
import DialerView from './views/DialerView.vue'
import CallsView from './views/CallsView.vue'
import CallDetailView from './views/CallDetailView.vue'
import PeopleView from './views/PeopleView.vue'
import ExtensionsView from './views/ExtensionsView.vue'
import InboundRoutesView from './views/InboundRoutesView.vue'
import IvrMenusView from './views/IvrMenusView.vue'
import RecordingsView from './views/RecordingsView.vue'
import SipTrunksView from './views/SipTrunksView.vue'
import WebhooksView from './views/WebhooksView.vue'
import WebhookLogsView from './views/WebhookLogsView.vue'
import SystemHealthView from './views/SystemHealthView.vue'
import SettingsView from './views/SettingsView.vue'

const protectedRoute = (path: string, name: string, title: string, component: object, roles?: string[]) => ({ path, name, component, meta: { requiresAuth: true, title, roles } })

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/sign-in', name: 'sign-in', component: SignInView },
        { path: '/otp', name: 'otp', component: OtpView },
        {
            path: '/', component: AppShell, meta: { requiresAuth: true },
            children: [
                protectedRoute('', 'overview', 'Overview', OverviewView),
                protectedRoute('setup', 'setup', 'Setup checklist', SetupChecklistView),
                protectedRoute('dialer', 'dialer', 'Dialer', DialerView),
                protectedRoute('calls', 'calls', 'Calls', CallsView),
                protectedRoute('calls/:id', 'call-detail', 'Call details', CallDetailView),
                protectedRoute('people', 'people', 'People', PeopleView),
                protectedRoute('extensions', 'extensions', 'Extensions', ExtensionsView),
                protectedRoute('inbound', 'inbound-routes', 'Inbound routes', InboundRoutesView),
                protectedRoute('ivr', 'ivr-menus', 'IVR menus', IvrMenusView),
                protectedRoute('recordings', 'recordings', 'Recordings', RecordingsView),
                protectedRoute('trunks', 'sip-trunks', 'SIP trunks', SipTrunksView),
                protectedRoute('webhooks', 'webhooks', 'Webhooks', WebhooksView),
                protectedRoute('webhook-logs', 'webhook-logs', 'Delivery logs', WebhookLogsView),
                protectedRoute('health', 'system-health', 'System health', SystemHealthView, ['platform-administrator', 'administrator']),
                protectedRoute('settings', 'settings', 'Settings', SettingsView, ['administrator', 'platform-administrator']),
            ],
        },
        { path: '/:pathMatch(.*)*', redirect: '/' },
    ],
})

router.beforeEach((to) => {
    const session = useSessionStore()
    if (to.meta.requiresAuth && !session.isAuthenticated) return { name: 'sign-in', query: { redirect: to.fullPath } }
    if (to.name === 'sign-in' && session.isAuthenticated) return '/'
    const roles = to.meta.roles as string[] | undefined
    if (roles && session.current?.role && !roles.includes(session.current.role.toLowerCase())) return '/'
})
router.afterEach((to) => { document.title = `${String(to.meta.title ?? 'CommCare')} · CommCare` })
export default router
