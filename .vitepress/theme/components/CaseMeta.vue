<script setup lang="ts">
defineProps<{
  type: 'public-case' | 'field-case' | 'reproduced-test' | 'capacity-example' | 'synthetic-case' | 'composite-case'
  dataNature: string
  scope?: string
  assumptions?: string
  reproducible?: string
}>()
</script>

<template>
  <aside class="case-meta" aria-label="案例数据说明">
    <span class="case-meta__type">{{ type }}</span>
    <dl>
      <div><dt>数据性质</dt><dd>{{ dataNature }}</dd></div>
      <div v-if="scope"><dt>范围</dt><dd>{{ scope }}</dd></div>
      <div v-if="assumptions"><dt>假设</dt><dd>{{ assumptions }}</dd></div>
      <div v-if="reproducible"><dt>来源/复现</dt><dd><code>{{ reproducible }}</code></dd></div>
    </dl>
  </aside>
</template>
