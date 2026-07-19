<template>
  <div
    :key="index"
    v-for="({ name, seoDescription, updateTime, path, icon }, index) in data || []"
    class="transition-all w-full h-full bg-base-100 hover:bg-primary/10 p-3 rounded-[var(--radius-box)] cursor-pointer"
  >
    <div class="flex items-center gap-1">
      <div class="text-4xl">{{ icon }}</div>
      <div class="flex flex-col gap-1">
        <div
          :title="name"
          class="line-clamp-1 break-all flex-1 font-bold text-sm"
        >
          {{ name }}
        </div>
        <div
          :title="seoDescription"
          class="line-clamp-1 text-[12px]"
        >
          {{ seoDescription }}
        </div>
      </div>
    </div>
    <div class="flex justify-between items-center mt-3">
      <div
        class="text-[12px] font-bold text-gray-500"
        style="zoom: 0.8"
      >
        {{ updateTime }}
      </div>
      <MA
        target="_blank"
        :href="path ?? `/detail/${name}`"
        aria-label="Read Detail Tool Information"
      >
        <button
          class="btn btn-sm btn-primary btn-soft"
          title="Look"
          aria-label="Read Detail Tool Information"
        >
          Look
        </button>
      </MA>
    </div>
  </div>
</template>

<script lang="ts" setup>
const { data = [] } = defineProps<{
  data: Menu[] | null | undefined;
}>();
</script>

<style scoped></style>
