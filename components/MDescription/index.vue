<template>
  <div class="flex flex-col gap-3 rounded-[var(--radius-box)] bg-base-100 p-3">
    <h2 class="font-bold">📌 Project Overview</h2>
    <p class="text-xs leading-normal">
      this page is curated based on themes such as "{{ seoTitle || name }}", with a primary focus on
      our project: aggregating and categorizing popular global tools to provide clean navigation,
      comparisons, and quick access.
    </p>
    <p class="text-xs leading-normal">
      the page utilizes site-level metadata "{{ seoDescription }}" and keywords ({{
        seoKeywords?.join(", ")
      }}) to ensure visitors understand the value of this platform while remaining search-engine
      friendly.
    </p>
    <p class="text-xs leading-normal">
      we continuously expand the directory by update time and usage scenarios, allowing you to
      filter, learn, and navigate within the same interface without frequent searching.
    </p>
    <h2 class="font-bold">🚀 More Direct Tool Access</h2>
    <ul class="list-disc pl-5 text-xs flex flex-col gap-3">
      <li
        v-for="({ name, seoTitle, seoDescription }, index) in moreTools || []"
        :key="index"
        class="leading-normal"
      >
        <MA
          target="_blank"
          :href="`/detail/${name}`"
          class="font-bold text-primary underline underline-offset-2"
        >
          {{ seoTitle }}
        </MA>
        <span class="text-base-content/70"> —— {{ seoDescription }} </span>
      </li>
    </ul>
    <h2 class="font-bold">🏷️ More Tags</h2>
    <div class="flex flex-wrap gap-3">
      <MA
        target="_blank"
        :href="`/tag/${label}`"
        v-for="{ label, value } in tagsCount || []"
        :title="label"
      >
        <button
          class="btn capitalize btn-soft btn-primary btn-sm"
          :title="label"
        >
          {{ label }}
          <div class="badge badge-sm badge-secondary">{{ value }}</div>
        </button>
      </MA>
    </div>
  </div>
</template>

<script lang="ts" setup>
const { tool = {}, moreTools = [] } = defineProps<{
  tool: Menu;
  moreTools: Menu[];
}>();
const { tags = [], name = "", seoTitle = "", seoDescription = "", seoKeywords = [] } = tool || {};

const { data: tagsCount } = await useFetch<LabelValue[]>("/api/getTags", {
  method: "POST",
  body: {
    tags,
  },
});
</script>

<style scoped></style>
