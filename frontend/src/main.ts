import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import { setAuthFailureHandler } from './lib/api'
import { useSessionStore } from './stores/session'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const session = useSessionStore(pinia)
setAuthFailureHandler(() => {
  session.clear()
  if (router.currentRoute.value.name !== 'sign-in') {
    void router.push({ name: 'sign-in', query: { redirect: router.currentRoute.value.fullPath } })
  }
})

app.mount('#app')
