<script setup lang="ts">
import { computed } from 'vue'
import { Download, Plus, RefreshCw } from 'lucide-vue-next'

const props = defineProps<{ title: string; description: string }>()
const fixtures: Record<string, { columns: string[]; rows: string[][] }> = {
  'Users': { columns: ['Name', 'Status', 'Extensions', 'Updated'], rows: [['Maya Chen', 'Active', '201, 202', 'Today'], ['Liam Patel', 'Active', '204', 'Yesterday']] },
  'People': { columns: ['Name', 'Status', 'Extensions', 'Updated'], rows: [['Maya Chen', 'Active', '201, 202', 'Today'], ['Liam Patel', 'Active', '204', 'Yesterday']] },
  'Extensions': { columns: ['Extension', 'Availability', 'Assigned to', 'Provisioning'], rows: [['201', 'Assigned', 'Maya Chen', 'Ready'], ['204', 'Available', '—', 'Ready'], ['205', 'Reserved', '—', 'Pending']] },
  'Inbound routes': { columns: ['Source', 'Destination', 'State', 'Updated'], rows: [['+1 415 555 0100', 'Main IVR', 'Enabled', 'Today'], ['+1 415 555 0120', 'Extension 201', 'Disabled', 'Sep 18']] },
  'IVR menus': { columns: ['Menu', 'Announcement', 'Options', 'State'], rows: [['Main menu', 'Welcome message', '4 options', 'Active'], ['After hours', 'Closed message', '2 options', 'Draft']] },
  'SIP trunks': { columns: ['Trunk', 'Auth mode', 'Endpoint', 'State'], rows: [['Primary carrier', 'IP allowlist', 'carrier-primary', 'Connected'], ['Backup carrier', 'Credentials', 'backup-carrier', 'Pending']] },
  'Recordings': { columns: ['Name', 'Source', 'Status', 'Duration'], rows: [['Welcome message', 'Uploaded audio', 'Ready', '00:18'], ['After hours', 'Uploaded audio', 'Processing', '—']] },
  'Webhooks': { columns: ['Name', 'Event', 'State', 'Last delivery'], rows: [['Call lifecycle', 'Caller connected', 'Active', 'Delivered'], ['Ops alerts', 'Call failed', 'Paused', 'Failed']] },
  'Delivery logs': { columns: ['Webhook', 'Event', 'Status', 'Received'], rows: [['Call lifecycle', 'caller.connected', 'Delivered', '09:42 AM'], ['Ops alerts', 'call.failed', 'Failed', '08:56 AM']] },
}
const table = computed(() => fixtures[props.title])
</script>

<template>
  <div class="page-enter">
    <section class="page-heading"><div><p class="eyebrow">Workspace</p><h1>{{ title }}</h1><p class="page-heading__copy">{{ description }}</p></div><div class="heading-actions"><button class="button button--secondary"><Download :size="15" /> Export</button><button class="button button--primary"><Plus :size="15" /> New</button></div></section>
    <section v-if="table" class="surface table-surface module-table"><div class="surface__header table-header"><div><span class="overline">Tenant scoped</span><h2>{{ title }} inventory</h2></div><button class="button button--secondary"><RefreshCw :size="15" /> Refresh</button></div><div class="table-scroll"><table><thead><tr><th v-for="column in table.columns" :key="column">{{ column }}</th><th /></tr></thead><tbody><tr v-for="row in table.rows" :key="row[0]"><td v-for="cell in row" :key="cell">{{ cell }}</td><td><button class="button button--secondary">View</button></td></tr></tbody></table></div></section>
    <section v-else class="surface coming-soon"><div class="coming-soon__icon"><RefreshCw :size="22" /></div><span class="overline">Workspace module</span><h2>{{ title }}</h2><p>{{ description }}</p><button class="button button--secondary" type="button">Refresh data</button></section>
  </div>
</template>
