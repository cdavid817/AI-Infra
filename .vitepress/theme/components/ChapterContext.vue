<script setup lang="ts">
defineProps<{
  track: string
  question: string
  upstream?: string
  downstream?: string
  inputs?: string
  outputs?: string
}>()
</script>

<template>
  <aside class="chapter-context" aria-label="章节上下文">
    <p class="chapter-context__question">{{ question }}</p>
    <dl>
      <div v-if="upstream"><dt>先知道</dt><dd>{{ upstream }}</dd></div>
      <div v-if="outputs"><dt>本章产出</dt><dd>{{ outputs }}</dd></div>
    </dl>
  </aside>
</template>
