<template>
  <div class="p-3 flex flex-col gap-3">
    <MSearchAlert :total="tools?.length" />
    <label class="input w-full">
      <span class="textarea-md"> 🔍 </span>
      <input
        v-model="search"
        type="search"
        required
        placeholder="Search"
        @keydown="handleToSearch"
      />
    </label>
    <MGrid>
      <MCard :data="tools" />
    </MGrid>
    <MAllTools />
  </div>
</template>

<script setup lang="ts">
const search = ref<string>("");
const tools = ref<Menu[]>();

usePageSeo({
  canonicalPath: "/search/",
  title: `Tool Search: Instantly Find AI, Productivity - Marketing Tools`,
  seoDescription: `Instantly Search Our Curated Library of Tools – Find AI Products, Productivity Suites, and Marketing Resources to Match Your Exact Needs.`,
  keywords: [
    "tool search",
    "ai search",
    "ai tool search",
    "productivity lookup",
    "productivity tool lookup",
    "marketing tool search",
    "curated tool directory search",
  ],
});

const handleToSearch = (payload: KeyboardEvent) => {
  const { key } = payload;
  if (!(key === "Enter")) return;
  const blockSearch = search.value.trim().toLowerCase();
  tools.value =
    flattenMenu(menu).filter((item) => {
      const { name = "", seoDescription = "", updateTime = "", iframeUrl = "" } = item;
      const blokName = name.toLowerCase();
      const blockSeoDescription = seoDescription.toLowerCase();
      const blockUpdateTime = updateTime.toLowerCase();
      const blockIframeUrl = iframeUrl.toLowerCase();
      return (
        blokName.includes(blockSearch) ||
        blockSeoDescription.includes(blockSearch) ||
        blockUpdateTime.includes(blockSearch) ||
        blockIframeUrl.includes(blockSearch)
      );
    }) || [];
};
</script>

<style></style>
