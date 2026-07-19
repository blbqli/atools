<template>
  <div
    role="alert"
    class="alert alert-info inline"
  >
    ❤ You have retrieved {{ total }} pieces of data
  </div>
</template>

<script lang="ts" setup>
const { total = 0 } = defineProps<{
  total?: number | undefined | null;
}>();
</script>

<style scoped></style>

