<script setup lang="ts">
withDefaults(defineProps<{
  id: string
  src: string
  alt: string
  title?: string
  caption: string
  source?: string
  license?: string
  width?: 'narrow' | 'normal' | 'wide' | 'full'
  zoomable?: boolean
}>(), { width: 'normal', zoomable: true })
</script>

<template>
  <figure :id="id" class="book-figure" :class="`book-figure--${width}`">
    <a v-if="zoomable" class="book-figure__media" :href="src" target="_blank" :aria-label="`查看原图：${title || caption}`">
      <img :src="src" :alt="alt" loading="lazy">
    </a>
    <div v-else class="book-figure__media"><img :src="src" :alt="alt" loading="lazy"></div>
    <figcaption>
      <strong v-if="title">{{ title }}</strong><span>{{ caption }}</span>
      <small v-if="source || license">来源：{{ source || '本书生成' }}<template v-if="license"> · {{ license }}</template></small>
    </figcaption>
  </figure>
</template>
