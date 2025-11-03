<!-- 电子商务页面 -->
<template>
  <div class="ecommerce">
    <!-- <ElRow :gutter="20">
      <ElCol :sm="24" :md="24" :lg="16">
        <Banner />
      </ElCol>
      <ElCol :sm="12" :md="12" :lg="4">
        <TotalOrderVolume />
      </ElCol>
      <ElCol :sm="12" :md="12" :lg="4">
        <TotalProducts />
      </ElCol>
    </ElRow> -->
    <CardList></CardList>
    <!-- <ElRow :gutter="20">
      <ElCol :sm="12" :md="12" :lg="8">
        <SalesTrend />
      </ElCol>
      <ElCol :sm="12" :md="12" :lg="8">
        <SalesClassification />
      </ElCol>
      <ElCol :sm="24" :md="24" :lg="8">
        <ElRow :gutter="20">
          <ElCol :sm="24" :md="12" :lg="12">
            <ProductSales />
          </ElCol>
          <ElCol :sm="24" :md="12" :lg="12">
            <SalesGrowth />
          </ElCol>
          <ElCol :span="24" class="no-margin-bottom">
            <CartConversionRate />
          </ElCol>
        </ElRow>
      </ElCol>
    </ElRow> -->

    <ElRow :gutter="20">
      <ElCol :sm="24" :md="12" :lg="8">
        <HotCommodity />
      </ElCol>
      <ElCol :sm="24" :md="12" :lg="8">
        <!-- <AnnualSales /> -->
        <!-- <ArtDonutChartCard :value="36358" title="粉丝量" :percentage="18" percentageLabel="较去年" :data="[50, 40]"
          :height="9.5" currentValue="2022" previousValue="2021" :radius="['50%', '70%']" /> -->
        <div class="art-card p-5 mb-5 h-105">
          <div class="art-card-header">
            <div class="title">
              <h4>Bonus Classification</h4>
              <p>By bonus type</p>
            </div>
          </div>

          <ArtRingChart :data="[
            { value: 30, name: 'Welcome' },
            { value: 25, name: '7 day login' },
            { value: 65, name: 'Deposit match' }
          ]" :color="['#4C87F3', '#EDF2FF', '#8BD8FC']" :radius="['70%', '80%']" height="16.5rem" :showLabel="false"
            :borderRadius="0" centerText="$12,000" />
          <div class="flex justify-around">
            <div class="flex-c">
              <div class="flex-cc size-10.5 mr-2.5 text-theme bg-theme/10 rounded-lg">
                <ArtSvgIcon icon="mdi:currency-usd" class="text-xl" />
              </div>
              <div>
                <p class="text-lg">$55,458</p>
                <span class="text-sm">generated</span>
              </div>
            </div>
            <div class="flex-c">
              <div class="flex-cc size-10.5 mr-2.5 text-theme bg-theme/10 rounded-lg">
                <ArtSvgIcon icon="mdi:finance" class="text-xl" />
              </div>
              <div>
                <p class="text-lg">$130,580</p>
                <span class="text-sm">projected </span>
              </div>
            </div>
          </div>
        </div>
        <!-- <ArtDonutChartCard :value="36358" title="粉丝量" :percentage="18" percentageLabel="较去年" :data="[50, 40]"
          :height="9.5" currentValue="2022" previousValue="2021" :radius="['50%', '70%']" /> -->

      </ElCol>
      <ElCol :sm="24" :md="24" :lg="8">
        <TransactionList />
      </ElCol>
    </ElRow>

    <ElRow :gutter="20">
      <ElCol :md="24" :lg="8">
        <RecentTransaction />
      </ElCol>
      <ElCol :md="24" :lg="16" class="no-margin-bottom">
        <HotProductsList />
      </ElCol>
    </ElRow>
  </div>
</template>

<script setup lang="ts">
import CardList from './modules/card-list.vue'
import HotCommodity from './modules/hot-commodity.vue'
import HotProductsList from './modules/hot-products-list.vue'
import RecentTransaction from './modules/recent-transaction.vue'
import TransactionList from './modules/transaction-list.vue'

defineOptions({ name: 'Ecommerce' })
</script>
