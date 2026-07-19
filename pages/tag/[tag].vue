<template>
  <div class="flex flex-col gap-3 p-3">
    <MSearchAlert :total="tools?.length" />
    <MGrid>
      <MCard :data="tools" />
    </MGrid>
    <MAllTools />
  </div>
</template>

<script setup lang="ts">
const { tag } = useRoute().params as any;
const { data: tools } = await useFetch<Menu[]>("/api/getToolsByTag", {
  method: "POST",
  body: {
    tags: [tag],
  },
});
const toolList = tools?.value || [];

usePageSeo({
  canonicalPath: `/tag/${tag}/`,
  title: `From ${filterStrUpperCase(tag)}, Many Free Online Tools Are Made For You`,
  seoDescription: `From ${filterStrUpperCase(
    tag,
  )}, Plenty Of Free Online Tools Are Ready For You To Use Directly. We Sincerely Hope They Are Of Great Help In Your Work And Daily Life. Thank You.`,
  keywords: Array.from(
    new Set([tag, `${tag} tools`, ...toolList.flatMap((item) => item.tags || [])]),
  ),
});
</script>

<style scoped></style>

