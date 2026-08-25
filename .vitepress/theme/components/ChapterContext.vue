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
      <div><dt>主线</dt><dd>{{ track }}</dd></div>
      <div v-if="upstream"><dt>上游</dt><dd>{{ upstream }}</dd></div>
      <div v-if="downstream"><dt>下游</dt><dd>{{ downstream }}</dd></div>
      <div v-if="inputs"><dt>输入</dt><dd>{{ inputs }}</dd></div>
      <div v-if="outputs"><dt>输出</dt><dd>{{ outputs }}</dd></div>
    </dl>
  </aside>
</template>
