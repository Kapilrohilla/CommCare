<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import Sidebar from './Sidebar.vue'
import ScreenHeader from './ScreenHeader.vue'
import CreateTenantDialog from './CreateTenantDialog.vue'
import { useSessionStore } from '../stores/session'
import { authService } from '../lib/services/auth.service'
import { ApiError } from '../lib/api'
import { registerTenant, resolveTenantAfterAuth } from '../lib/auth/tenant-bootstrap'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const navOpen = ref(false)
const pageTitle = computed(() => String(route.meta.title ?? 'Overview'))
const showTenantModal = ref(false)
const tenantBusy = ref(false)
const tenantError = ref('')

onMounted(() => {
  void syncTenantRequirement()
})

async function syncTenantRequirement() {
  if (!session.isAuthenticated) return
  try {
    const resolution = await resolveTenantAfterAuth()
    showTenantModal.value = resolution.requiresTenant
  } catch {
    showTenantModal.value = Boolean(session.requiresTenant)
  }
}

function signOut() {
  void authService.logout().catch(() => undefined).finally(() => {
    session.clear()
    router.push({ name: 'sign-in' })
  })
}

async function onCreateTenant(payload: { name: string; region: string }) {
  tenantBusy.value = true
  tenantError.value = ''
  try {
    await registerTenant(payload.name)
    showTenantModal.value = false
  } catch (caught) {
    tenantError.value = caught instanceof ApiError ? caught.message : 'Could not create workspace.'
  } finally {
    tenantBusy.value = false
  }
}

function onTenantSignOut() {
  void authService.logout().catch(() => undefined).finally(() => {
    session.clear()
    showTenantModal.value = false
    router.push({ name: 'sign-in' })
  })
}
</script>

<template>
  <div class="app-frame">
    <div v-if="navOpen" class="scrim" @click="navOpen = false" />
    <Sidebar :open="navOpen" :role="session.current?.role?.toLowerCase()" @close="navOpen = false" @sign-out="signOut" />
    <main class="main-column">
      <ScreenHeader :title="pageTitle" @open-navigation="navOpen = true" />
      <div class="content-wrap"><RouterView /></div>
    </main>
    <CreateTenantDialog
      :open="showTenantModal"
      :submitting="tenantBusy"
      :error="tenantError"
      @submit="onCreateTenant"
      @sign-out="onTenantSignOut"
    />
  </div>
</template>
