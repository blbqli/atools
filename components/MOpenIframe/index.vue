<template>
  <div
    role="alert"
    class="alert rounded-none! w-full shadow-none! bg-base-100! border-none! inline"
  >
    ‼️ If The Page Fails To Load, You Can Click The Button On The Right.&nbsp;
    <a
      :title="seoTitle"
      :href="iframeUrl"
      target="_blank"
      class="link link-primary"
    >
      {{ getStarted }}
    </a>
  </div>
</template>

<script lang="ts" setup>
const { iframeUrl, seoTitle } = defineProps<{
  iframeUrl: string;
  seoTitle: string;
}>();
</script>

<style scoped></style>
