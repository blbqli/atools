<template>
  <div class="py-[10px] my-[0px] h-max">
    <div class="text-center text-white font-semibold">Advertisement</div>
    <ins
      :style="{
        width: '100%',
        height: height,
        display: 'block',
      }"
      :data-ad-client="123"
      :data-ad-slot="adsenceSlot"
      data-ad-format="auto"
      data-full-width-responsive="true"
    ></ins>
  </div>
</template>

<script lang="ts" setup>
const { adsenceSlot, height = "100%" } = defineProps<{
  /** Adsence广告配置slot */
  adsenceSlot: string;
  /** 广告高度 */
  height?: string;
}>();

onMounted(() => {
  if (!adsenceSlot) return;
  const dom = document.getElementById(adsenceSlot);
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          initAdsence();
          observer.disconnect();
        }
      });
    },
    {
      threshold: 0,
    },
  );
  dom && observer.observe(dom);
});

/** Adsence手动广告 */
const initAdsence = () => {
  (window.adsbygoogle = window.adsbygoogle || []).push({});
};

/** Adsence激励视频广告 */
const initPlayMRV = () => {
  const slotVars = {
    google_ad_loaded_callback: (load: any) => {
      const btnId = document.getElementById("playBtn");
      btnId?.addEventListener("click", () => {
        load?.show((e: any) => {
          console.log(e);
        });
      });
    },
    google_ad_slot: adsenceSlot,
    google_ad_format: "rewarded",
  };
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.push({
    params: slotVars,
  });
};
</script>

<style scoped></style>
