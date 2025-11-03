<template>
  <div class="art-card p-5 mb-5 h-105">
    <div class="art-card-header">
      <div class="title">
        <h4>Sales Trends</h4>
        <p>Monthly sales comparison</p>
      </div>
    </div>

    <ArtDualBarCompareChart :positiveData="[50, 80, 120, 90, 60]" :negativeData="[30, 60, 90, 70, 40]"
      :xAxisData="['January', 'February', 'March', 'April', 'May']" height="19rem" />
  </div>
</template>
