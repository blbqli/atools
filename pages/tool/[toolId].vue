<template>
  <div class="flex flex-col flex-1">
    <MOpenIframe
      :seoTitle="seoTitle"
      :iframeUrl="iframeUrl"
    />
    <iframe
      :id="toolContainer"
      :title="seoTitle"
      class="w-full h-full flex-1"
      :src="iframeUrl"
      frameborder="0"
    ></iframe>
  </div>
</template>

<script setup lang="ts">
const { toolId } = useRoute().params as any;
const {
  iframeUrl = "",
  seoTitle = "",
  seoDescription = "",
  tags = [],
  seoKeywords = [],
} = getToolDetail(toolId) || {};

usePageSeo({
  canonicalPath: `/detail/${toolId}/`,
  title: seoTitle,
  seoDescription,
  keywords: [`${seoTitle}`, `${seoTitle} online`, `${seoTitle} demo`, ...tags, ...seoKeywords],
});
</script>

<style scoped></style>
