<template>
  <div class="art-card p-5 pt-3.5 mb-5" style="height: 13.3rem">
    <div class="art-card-header">
      <div class="title">
        <h4 class="text-2xl font-medium">205,216</h4>
        <p>This Month's Growth</p>
      </div>
    </div>

    <ArtRingChart
      :data="[
        { value: 30, name: 'Completed' },
        { value: 25, name: 'Processing' },
        { value: 45, name: 'Pending Shipment' }
      ]"
      :color="['#4C87F3', '#93F1B4', '#8BD8FC']"
      :radius="['56%', '76%']"
      height="7rem"
      :showLabel="false"
      :borderRadius="0"
    />
  </div>
</template>
