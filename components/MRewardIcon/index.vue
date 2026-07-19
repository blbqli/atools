<template>
  <MA
    :href="REWARD_URL"
    :title="REWARD_TEXT"
  >
    <button
      class="btn btn-ghost px-2"
      :title="REWARD_TEXT"
      :aria-label="REWARD_TEXT"
    >
      {{ REWARD_TEXT }}
    </button>
  </MA>
</template>

<script lang="ts" setup>
import { REWARD_TEXT, REWARD_URL } from "~/utils/reward";
</script>

<style scoped></style>
