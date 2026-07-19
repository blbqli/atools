<template>
  <div
    v-if="isOpen"
    class="fixed inset-x-0 bottom-0 z-50 p-3 flex justify-center"
  >
    <section
      aria-labelledby="cookie-consent-title"
      aria-live="polite"
      class="w-full max-w-4xl bg-base-100 border border-base-300 rounded-box shadow-xl p-4 flex flex-col gap-3"
      role="dialog"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex flex-col gap-2">
          <h2
            class="font-bold text-lg"
            id="cookie-consent-title"
          >
            Cookie and Advertising Preferences
          </h2>
          <p class="text-sm leading-relaxed">
            We use necessary browser storage for site preferences. With your permission, we also
            load advertising and analytics services from Monetag, Google AdSense, and Microsoft
            Clarity.
          </p>
        </div>
        <button
          v-if="choice !== null"
          aria-label="Close Cookie Settings"
          class="btn btn-sm btn-ghost shrink-0"
          type="button"
          @click="closePreferences"
        >
          ✕
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <MA
          class="link link-hover"
          href="/privacy"
        >
          Privacy Policy
        </MA>
        <MA
          class="link link-hover"
          href="/cookies"
        >
          Cookie Policy
        </MA>
      </div>
      <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button
          class="btn btn-outline"
          type="button"
          @click="reject"
        >
          Reject Optional Cookies
        </button>
        <button
          class="btn btn-primary"
          type="button"
          @click="accept"
        >
          Accept Optional Cookies
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const { accept, choice, closePreferences, initialize, isOpen, reject } = useCookieConsent();

onMounted(initialize);
</script>
