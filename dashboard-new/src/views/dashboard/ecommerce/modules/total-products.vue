<template>
  <div class="art-card p-5 pt-3.5 mb-5" style="height: 13.3rem">
    <div class="art-card-header">
      <div class="title">
        <h4 class="text-2xl font-medium">55,231</h4>
        <p>Total Products</p>
      </div>
    </div>

    <ArtBarChart
      :showAxisLabel="false"
      :showAxisLine="false"
      :showSplitLine="false"
      :data="[50, 80, 40, 90, 60, 70]"
      height="7rem"
      barWidth="18px"
    />
  </div>
</template>
