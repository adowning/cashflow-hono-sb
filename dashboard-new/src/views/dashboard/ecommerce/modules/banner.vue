<template>
  <ArtBasicBanner
    class="justify-center mb-5"
    height="13.3rem"
    :title="`Welcome back ${userInfo.userName}`"
    boxStyle="!bg-theme/10"
    titleColor="var(--art-gray-900)"
    :decoration="false"
    :meteorConfig="{
      enabled: true,
      count: 10
    }"
    :buttonConfig="{
      show: false,
      text: ''
    }"
    :imageConfig="{
      src: bannerCover,
      width: '18rem',
      bottom: '-7.5rem'
    }"
    @click="handleBannerClick"
  >
    <div class="flex mt-6">
      <div class="mr-8 pr-8 border-r border-g-300">
        <p class="text-3xl">
          <ArtCountTo
            class="number box-title"
            :target="2340"
            :duration="1500"
            prefix="¥"
            separator=","
          />
          <ArtSvgIcon icon="ri:arrow-right-up-line" class="text-xl text-success relative -top-2" />
        </p>
        <p class="mt-1 text-sm text-g-700">Today's Sales</p>
      </div>
      <div class="mr-8">
        <p class="text-3xl">
          <ArtCountTo class="number box-title" :target="35" :duration="1500" suffix="%" />
          <ArtSvgIcon icon="ri:arrow-right-up-line" class="text-xl text-success relative -top-2" />
        </p>
        <p class="mt-1 text-sm text-g-700">Compared to Yesterday</p>
      </div>
    </div>
  </ArtBasicBanner>
</template>

<script setup lang="ts">
  import bannerCover from '@imgs/login/lf_icon2.webp'
  import { useUserStore } from '@/store/modules/user'

  const userStore = useUserStore()

  /**
   * Get current user information
   */
  const userInfo = computed(() => userStore.getUserInfo)

  /**
   * Handle banner click event
   */
  const handleBannerClick = (): void => {
    // TODO: Add banner click handling logic
  }
</script>
