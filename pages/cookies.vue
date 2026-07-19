<template>
  <MLegalPage :content="legalContent.cookies">
    <div class="flex flex-wrap items-center gap-2 pt-2">
      <button
        class="btn btn-primary"
        type="button"
        @click="openPreferences"
      >
        Open Cookie Settings
      </button>
    </div>
  </MLegalPage>
</template>

<script setup lang="ts">
import { createLegalContent, LEGAL_PAGE_SEO } from "~/utils/legal";

const { h1Title } = useAppConfig();
const legalContent = createLegalContent(h1Title);
const { openPreferences } = useCookieConsent();

usePageSeo(LEGAL_PAGE_SEO.cookies);
</script>
