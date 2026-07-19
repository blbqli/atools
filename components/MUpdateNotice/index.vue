<template>
  <div
    role="alert"
    class="alert alert-success flex items-center justify-between capitalize"
  >
    <div class="flex flex-col w-full font-bold">
      <div class="line-clamp-1 break-all w-full">
        {{ tool?.seoTitle }}
      </div>
      <div
        class="text-xs line-clamp-1 break-all w-full"
        style="zoom: 0.8"
      >
        New tools released today
      </div>
    </div>
    <MA
      target="_blank"
      :href="`/detail/${tool?.name}/`"
      :title="tool?.name"
    >
      <button class="btn btn-sm font-bold btn-soft btn-primary">See</button>
    </MA>
  </div>
</template>

<script lang="ts" setup>
const { tool = {} } = defineProps<{
  tool: Menu;
}>();
</script>

<style scoped></style>
