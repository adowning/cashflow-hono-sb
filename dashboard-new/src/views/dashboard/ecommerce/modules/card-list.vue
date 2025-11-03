<template>
  <ElRow :gutter="20" class="flex">
    <ElCol v-for="(item, index) in dataList" :key="index" :sm="12" :md="6" :lg="6">
      <div class="art-card b-primary relative flex flex-col justify-center h-30 px-5 mb-5">
        <span class="text-g-700 text-sm">{{ item.des }}</span>
        <ArtCountTo class="text-3xl mt-2" :target="item.num" :duration="1300" />
        <div class="flex-c mt-1">
          <span class="text-xs text-g-600">Previous Week</span>
          <span class="ml-1 text-xs font-semibold"
            :class="[item.change.indexOf('+') === -1 ? 'text-danger' : 'text-success']">
            {{ item.change }}
          </span>
        </div>
        <div class="absolute top-0 bottom-0 right-5 m-auto size-12.5 rounded-xl flex-cc bg-theme/10">
          <ArtSvgIcon :icon="item.icon" class="text-xl text-theme" />
        </div>
      </div>
    </ElCol>
    <ElCol :sm="12" :md="6" :lg="6">
      <div class="art-card b-primary relative flex flex-col justify-center h-30 px-5 mb-5">
        <span class="text-g-700 text-sm">{{ currentBalance.des }}</span>

        <ArtCountTo class="text-3xl mt-2" :class="balanceColorClass" :target="currentBalance.num" :duration="1300" />
        <div class="flex-c mt-1" v-if="currentBalance.num < 25000">
          <a href="#" class="text-xs text-blue-500 hover:text-blue-700 underline">top up</a>
        </div>
        <div class="flex-c mt-1" v-else>
          <span class="text-xs text-g-600">Previous Week</span>
          <span class="ml-1 text-xs font-semibold"
            :class="[currentBalance.change.indexOf('+') === -1 ? 'text-danger' : 'text-success']">
            {{ currentBalance.change }}
          </span>
        </div>
        <div class="absolute top-0 bottom-0 right-5 m-auto size-12.5 rounded-xl flex-cc bg-theme/10">
          <ArtSvgIcon :icon="currentBalance.icon" class="text-xl text-theme" />
        </div>
      </div>
    </ElCol>
  </ElRow>
</template>

<script setup lang="ts">
interface CardDataItem
{
  des: string
  icon: string
  startVal: number
  duration: number
  num: number
  change: string
}

/**
 * Card statistics list
 * Display core data indicators such as total visits, online visitors, click count and new users
 */
const dataList = reactive<CardDataItem[]>([
  {
    des: 'Gross Gaming Revenue',
    icon: 'hugeicons:money-03',
    startVal: 0,
    duration: 1000,
    num: 9120,
    change: '+20%'
  },
  {
    des: 'New Players',
    icon: 'ri:group-line',
    startVal: 0,
    duration: 1000,
    num: 14,
    change: '+10%'
  },
  {
    des: 'Total Deposits',
    icon: 'mdi:finance',
    startVal: 0,
    duration: 1000,
    num: 9520,
    change: '-12%'
  },

])
const currentBalance = {
  des: 'Current Balance',
  icon: 'ri:bank-line',
  startVal: 0,
  duration: 1000,
  num: 156,
  change: '+30%'
}

/**
 * Computed property to determine color class based on current balance
 * - If currentBalance.num < 10000: apply error color (text-red-500)
 * - If currentBalance.num >= 10000 AND currentBalance.num <= 25000: apply warning color (text-orange-500)
 * - If currentBalance.num > 25000: apply success color (text-green-500)
 */
const balanceColorClass = computed(() =>
{
  const balance = currentBalance.num
  if (balance < 10000) {
    return 'text-red-500'
  } else if (balance >= 10000 && balance <= 25000) {
    return 'text-orange-500'
  } else {
    return 'text-green-500'
  }
})
</script>
