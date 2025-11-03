<template>
  <div class="art-card p-5 mb-5 h-105">
    <div class="art-card-header">
      <div class="title">
        <h4>Sales Classification</h4>
        <p>By game category</p>
      </div>
    </div>

    <ArtRingChart :data="[
      { value: 30, name: 'Slots' },
      { value: 55, name: 'Fish' },
      { value: 36, name: 'Other' }
    ]" :color="['#4C87F3', '#EDF2FF', '#8BD8FC']" :radius="['70%', '80%']" height="16.5rem" :showLabel="false"
      :borderRadius="0" centerText="¥300,458" />
    <div class="flex justify-around">
      <div class="flex-c">
        <div class="flex-cc size-10.5 mr-2.5 text-theme bg-theme/10 rounded-lg">
          <ArtSvgIcon icon="ri:money-dollar-circle-line" class="text-xl" />
        </div>
        <div>
          <p class="text-lg">$500,458</p>
          <span class="text-sm">total revenue</span>
        </div>
      </div>
      <div class="flex-c">
        <div class="flex-cc size-10.5 mr-2.5 text-theme bg-theme/10 rounded-lg">
          <ArtSvgIcon icon="ri:heart-3-line" class="text-xl" />
        </div>
        <div>
          <p class="text-lg">$130,580</p>
          <span class="text-sm">net profit</span>
        </div>
      </div>
    </div>
  </div>
</template>
