<template>
  <article class="w-full flex justify-center p-3">
    <div class="legal-content w-full max-w-4xl bg-base-100 rounded-box p-4 flex flex-col gap-3">
      <div v-html="content"></div>
      <slot />
    </div>
  </article>
</template>

<script setup lang="ts">
import { legalPageProps } from "./type";

defineProps(legalPageProps);
</script>

<style scoped>
.legal-content :deep(h1) {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.25;
  margin: 0 0 1rem;
}

.legal-content :deep(h2) {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.35;
  margin: 1.5rem 0 0.5rem;
}

.legal-content :deep(p) {
  line-height: 1.75;
  margin: 0.75rem 0;
}

.legal-content :deep(ul) {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  list-style: disc;
  margin: 0.75rem 0;
  padding-left: 1.5rem;
}

.legal-content :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 0.2rem;
}
</style>
