<template>
  <a :href="normalizedHref">
    <slot></slot>
  </a>
</template>

<script lang="ts" setup>
import { normalizeInternalHref } from "~/utils/url";

const { href = "/" } = defineProps<{
  href?: string;
}>();

const normalizedHref = computed(() => normalizeInternalHref(href));
</script>

<style scoped></style>

