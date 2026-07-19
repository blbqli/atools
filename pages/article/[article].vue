<template>
  <div
    v-html="richText"
    class="container p-3 max-w-[800px] mx-auto container-rich"
  ></div>
</template>

<script setup lang="ts">
const { article } = useRoute().params;
const blogDetail = flattenMenu(articles).find((item) => item.nameShort === article);
const { seoTitle = "", seoDescription = "", seoKeywords = [], richText = "" } = blogDetail || {};

usePageSeo({
  canonicalPath: `/article/${article}/`,
  title: seoTitle,
  seoDescription,
  keywords: [...seoKeywords, "Tools"],
  type: "article",
});
</script>

<style scoped>
.container * {
  all: revert;
}
</style>
