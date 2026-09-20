<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Activity, ChevronDown, Command, LayoutDashboard, LogOut, Phone, Radio, Settings2, ShieldCheck, Users, X } from 'lucide-vue-next'
import type { Component } from 'vue'
import { useSessionStore } from '../stores/session'

export type NavItem = { label: string; to: string; icon: Component; roles?: string[] }
export type NavGroup = { label: string; items: NavItem[] }

const props = defineProps<{ open: boolean; role?: string }>()
const emit = defineEmits<{ close: []; signOut: [] }>()

const session = useSessionStore()

const workspaceTitle = computed(() => session.current?.tenant || 'Workspace')
const userName = computed(() => session.current?.user || 'Account')
const userRole = computed(() => props.role ?? session.current?.role?.toLowerCase() ?? 'administrator')
const workspaceInitials = computed(() => initials(workspaceTitle.value))
const userInitials = computed(() => initials(userName.value))

const groups: NavGroup[] = [
  { label: 'Command center', items: [{ label: 'Overview', to: '/', icon: LayoutDashboard }, { label: 'Setup checklist', to: '/setup', icon: Settings2 }] },
  { label: 'Calling', items: [{ label: 'Dialer', to: '/dialer', icon: Phone }, { label: 'Calls', to: '/calls', icon: Activity }, { label: 'Recordings', to: '/recordings', icon: Radio }] },
  { label: 'Configuration', items: [{ label: 'Users', to: '/users', icon: Users }, { label: 'Extensions', to: '/extensions', icon: Users }, { label: 'Inbound routes', to: '/inbound', icon: Radio }, { label: 'IVR menus', to: '/ivr', icon: Radio }, { label: 'SIP trunks', to: '/trunks', icon: Settings2 }] },
  { label: 'Integrations & system', items: [{ label: 'Webhooks', to: '/webhooks', icon: Activity }, { label: 'Delivery logs', to: '/webhook-logs', icon: Activity }, { label: 'System health', to: '/health', icon: ShieldCheck }, { label: 'Settings', to: '/settings', icon: Settings2, roles: ['administrator', 'platform-administrator'] }] },
]

function visible(item: NavItem) {
  return !item.roles || item.roles.includes(userRole.value)
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}
</script>

<template>
  <aside class="rail" :class="{ 'rail--open': open }">
    <div class="rail__topline">
      <RouterLink to="/" class="brand" @click="emit('close')"><span class="brand__mark"><Command :size="17" /></span><span>commcare</span></RouterLink>
      <button class="icon-button mobile-only" aria-label="Close navigation" @click="emit('close')"><X :size="18" /></button>
    </div>
    <div class="workspace-switcher">
      <span class="workspace-switcher__avatar">{{ workspaceInitials }}</span>
      <span class="workspace-switcher__copy">
        <strong>{{ workspaceTitle }}</strong>
        <small>Operations workspace</small>
      </span>
      <ChevronDown :size="15" class="muted" />
    </div>
    <nav class="nav-list" aria-label="Main navigation">
      <section v-for="group in groups" :key="group.label" class="nav-group">
        <p class="nav-list__label">{{ group.label }}</p>
        <RouterLink v-for="item in group.items.filter(visible)" :key="item.to" :to="item.to" class="nav-link" active-class="nav-link--active" @click="emit('close')"><component :is="item.icon" :size="16" stroke-width="1.8" /><span>{{ item.label }}</span></RouterLink>
      </section>
    </nav>
    <div class="rail__bottom">
      <button class="profile-chip" @click="emit('signOut')">
        <span class="profile-chip__avatar">{{ userInitials }}</span>
        <span>
          <strong>{{ userName }}</strong>
          <small>{{ session.current?.role ?? 'Administrator' }}</small>
        </span>
        <LogOut :size="15" class="muted" />
      </button>
    </div>
  </aside>
</template>
