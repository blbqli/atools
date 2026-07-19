<template>
  <div class="flex flex-col gap-3 p-3">
    <MGrid>
      <MCard :data="children" />
    </MGrid>
    <MAllTools />
  </div>
</template>

<script setup lang="ts">
const { category } = useRoute().params as any;
const {
  children = [],
  seoTitle = "",
  seoDescription = "",
  seoKeywords = [],
  tags = [],
} = getToolsByCategory(category) || {};

usePageSeo({
  canonicalPath: `/category/${category}/`,
  title: seoTitle,
  seoDescription,
  keywords: [...tags, ...seoKeywords],
});
</script>

<style scoped></style>

