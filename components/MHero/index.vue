<template>
  <div
    class="hero min-h-[400px] sm:min-h-[450px] md:min-h-[500px] bg-center! rounded-[var(--radius-box)] overflow-hidden capitalize"
    :style="`background: url(${tool?.bgImg}) no-repeat;`"
  >
    <div class="hero-overlay"></div>
    <div class="hero-content text-neutral-content text-center">
      <div class="max-w-[1000px]">
        <h2 class="mb-5 text-3xl font-bold">{{ tool?.seoTitle }}</h2>
        <p class="mb-5">
          {{ tool?.seoDescription }}
        </p>
        <MA
          :href="`/detail/${tool?.name}/`"
          target="_blank"
        >
          <button class="btn btn-primary btn-soft">{{ getStarted }}</button>
        </MA>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
const { tool = {} } = defineProps<{
  tool: Menu;
}>();
</script>

<style scoped></style>
