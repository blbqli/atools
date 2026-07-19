<template>
  <div class="flex flex-col p-3 gap-3">
    <MDetailAlert />
    <MDetailBreadcrumbs :tool="toolDetail" />
    <MDetailCard :tool="toolDetail" />
    <MDescription
      :tool="toolDetail"
      :moreTools="moreDescription || []"
    />
    <div class="divider divider-primary m-0! text-[12px]!">More Tools</div>
    <MGrid>
      <MCard :data="moreTools" />
    </MGrid>
    <MAllTools />
  </div>
</template>

<script setup lang="ts">
const { toolId } = useRoute().params as any;
const toolDetail = getToolDetail(toolId) || {};
const {
  name = "",
  tags = [],
  updateTime = "",
  seoTitle = "",
  seoDescription = "",
  seoKeywords = [],
} = toolDetail;
const { data: moreDescription } = await useFetch<Menu[]>("/api/getRandomTools", {
  method: "POST",
  body: {
    menu: flattenMenu(menu),
    count: 6,
  },
});
const { data: moreTools } = await useFetch<Menu[]>("/api/getRandomTools", {
  method: "POST",
  body: {
    menu: flattenMenu(menu),
    count: 12,
  },
});

usePageSeo({
  canonicalPath: `/detail/${toolId}/`,
  title: seoTitle,
  seoDescription,
  type: "article",
  publishedTime: new Date(updateTime).toISOString(),
  modifiedTime: new Date(updateTime).toISOString(),
  keywords: [...seoKeywords, ...tags],
});
</script>

<style></style>

