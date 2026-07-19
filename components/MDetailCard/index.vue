<template>
  <div
    class="hero capitalize min-h-[400px] sm:min-h-[450px] md:min-h-[500px] rounded-[var(--radius-box)] relative overflow-hidden"
  >
    <div class="absolute left-0 top-0 w-full h-full flex">
      <img
        v-if="bgImg"
        :src="bgImg"
        :alt="bgImg"
        loading="lazy"
        class="absolute left-1/2 top-1/2 -translate-1/2 size-auto object-cover blur-xs"
      />
      <div class="bg-base-100 opacity-70 absolute left-0 top-0 w-full h-full"></div>
    </div>
    <div class="hero-content p-0! text-neutral-content text-center">
      <div class="max-w-[1000px]">
        <h2 class="mb-5 px-3 text-3xl font-bold text-base-content">{{ seoTitle }}</h2>
        <p class="mb-5 px-3 font-bold text-base-content">{{ seoDescription }}</p>
        <MA :href="`/tool/${name}`">
          <button class="btn btn-primary btn-soft">{{ getStarted }}</button>
        </MA>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { tool = {} } = defineProps<{
  tool: Menu;
}>();
const { name, seoDescription, bgImg, seoTitle } = tool;
</script>

<style></style>
