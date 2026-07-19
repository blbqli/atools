<template>
  <footer
    class="text-center text-[12px]! p-3"
    style="zoom: 0.8"
  >
    © 2025
    <MA class="font-bold">{{ h1Title }}</MA>
    . All rights reserved.
  </footer>
</template>

<script lang="ts" setup>
const { h1Title } = useAppConfig();
</script>

<style scoped></style>
