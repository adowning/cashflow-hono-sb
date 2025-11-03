<!-- Article list page -->
<template>
  <div class="page-content !mb-5">
    <ElRow justify="space-between" :gutter="10">
      <ElCol :lg="6" :md="6" :sm="14" :xs="16">
        <ElInput v-model="searchVal" :prefix-icon="Search" clearable placeholder="Enter the article title to query"
          @keyup.enter="searchGame" />
      </ElCol>
      <ElCol :lg="12" :md="12" :sm="0" :xs="0">
        <div class="custom-segmented">
          <ElSegmented v-model="categoryVal" :options="CATEGORY_OPTIONS" @change="searchGameByCategory" />
        </div>
      </ElCol>
      <ElCol :lg="6" :md="6" :sm="10" :xs="6" style="display: flex; justify-content: end">
        <ElButton @click="toAddGame" v-auth="'add'">Preview</ElButton>
      </ElCol>
    </ElRow>

    <div class="mt-5">
      <div class="grid grid-cols-5 gap-5 max-2xl:grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <div class="group c-p overflow-hidden border border-primary rounded-custom-sm" v-for="item in gameList"
          :key="item.id" @click="toDetail(item)">
          <div class="relative aspect-[3/4]" style="transform: scale(0.85); transform-origin: center;">
            <ElImage class="flex align-center justify-center w-full h-full object-cover bg-[#060e20]"
              :src="`https://images.cashflowcasino.com/all/${item.name.toLowerCase()}.avif`" lazy>
              <template #error>
                <div class="flex items-center justify-center w-full h-full bg-gray-100">
                  <img src="/images/logo.png" alt="Fallback" class="w-full h-full object-contain bg-[#060e20]" />
                </div>
              </template>
            </ElImage>
            <div class="absolute top-0 left-0 w-full">
              <div class="flex flex-row w-full justify-between">

                <ElTag v-if="item.category == 'FISH'" type="danger" size="small"
                  style="font-weight: bolder; font-size: 14px">
                  fish
                </ElTag>
                <ElTag v-if="item.category == 'SLOTS'" type="warning" size="small"
                  style="font-weight: bolder; font-size: 14px">
                  slots
                </ElTag>
                <el-check-tag :checked="item.isFeatured" round size="default"
                  style="transform: translateY(-20px) translateX(-5px)" @change="handleFeaturedToggle(item)"
                  @click.stop>
                  FEATURED
                </el-check-tag>
                <!-- <el-check-tag v-if="!item.isFeatured" :checked="item.isFeatured" round size="default"
                  style="opacity: .4;background-color: transaparent;  transform: translateY(-20px) translateX(-5px)"
                  @change="item.isFeatured = true">
                  NOT-FEATURED
                </el-check-tag> -->
                <span class="flex border-white/50 border-1 rounded bg-black/50 p-1"
                  @click.stop="item.isActive = !item.isActive">
                  <ArtSvgIcon :icon="item.isActive ? 'hugeicons:checkmark-circle-03' : 'hugeicons:circle'"
                    :class="item.isActive ? 'text-green-500 text-3xl font-bold' : 'text-red-500 text-3xl font-bold'" />
                </span>
              </div>

            </div>

            <!-- <span class="absolute top-0 left-0  " @click.stop="item.isFeatured = !item.isActive">
              <ElTag v-if="item.isFeatured" type="danger" size="small" style="font-weight: bolder; font-size: 14px">
                FEATURED
              </ElTag>
            </span> -->

            <img v-if="item.volatility" :src="`/images/vol${item.volatility}.png`"
              style="transform: translateX(11px) translateY(8px)" class="absolute bottom-0 right-0 w-12 h-15 z-10"
              alt="Volatility" />
          </div>


          <div class="px-2 py-1">
            <h2 class="text-base text-g-800 font-medium">{{ item.title }}</h2>
            <div class="flex-b w-full h-6 mt-1">
              <div class="flex-c justify-start gap-2 flex-row w-full text-g-500">

                <!-- <ArtSvgIcon icon="ri:eye-line" class="mr-1 text-sm" /> -->
                <!-- <span class="text-sm">{{ item.totalBetAmount }}</span>
                <span class="text-sm">{{ item.totalWonAmount }}</span>
                <ArtSvgIcon icon="ri:target-fill" class="mr-1 text-sm" /> -->
                <!-- <span class="text-g-900 "> -->
                <ElTag type="warning" size="small" style="font-weight: bolder; font-size: 14px">
                  RTP:{{ item.currentRtp }}
                </ElTag>
                <!-- </span> -->

                <ElTag type="success" size="small" style="font-weight: bolder; font-size: 14px">
                  GGR:{{ item.totalBetAmount - item.totalWonAmount }}
                </ElTag>
                <!-- <span class="text-sm">{{ item.targetRtp }}</span> -->
              </div>
              <ElButton class="opacity-0 group-hover:opacity-100" v-auth="'edit'" size="small"
                @click.stop="toEdit(item)">edit
              </ElButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div style="margin-top: 16vh" v-if="showEmpty">
      <ElEmpty :description="`No relevant data found ${EmojiText[0]}`" />
    </div>

    <div style="display: flex; justify-content: center; margin-top: 20px">
      <ElPagination size="default" background v-model:current-page="currentPage" :page-size="pageSize" :pager-count="9"
        layout="prev, pager, next, total,jumper" :total="total" :hide-on-single-page="true"
        @current-change="handleCurrentChange" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAllGames } from '@/api/client'
import { useCommon } from '@/composables/useCommon'
import { router } from '@/router'
import EmojiText from '@/utils/ui/emojo'
import { Search } from '@element-plus/icons-vue'

defineOptions({ name: 'GameList' })

interface Game
{
  "id": string
  "name": string
  "title": string
  "isActive": boolean
  "isFeatured": boolean
  "developer": string
  "category": string
  "volatility": number
  "thumbnailUrl": string
  "totalBetAmount": number
  "totalWonAmount": number
  "currentRtp": number
  "targetRtp": number
  "createdAt": string
  "updatedAt": string
}

interface GetGameListOptions
{
  backTop?: boolean
}

const CATEGORY_OPTIONS = ['All', 'Slot', 'Fish']
const PAGE_SIZE = 40

const categoryVal = ref('All')
const searchVal = ref('')
const gameList = ref<Game[]>([])
const currentPage = ref(1)
const pageSize = ref(PAGE_SIZE)
const total = ref(0)
const isLoading = ref(true)

const showEmpty = computed(() => gameList.value.length === 0 && !isLoading.value)

const getGameList = async ({ backTop = false }: GetGameListOptions = {}) =>
{
  isLoading.value = true

  try {
    if (searchVal.value) {
      categoryVal.value = 'All'
    }

    // Prepare API params with category filtering
    const params: any = {
      page: currentPage.value,
      perPage: pageSize.value,
    }

    // Add category filter if not 'All'
    if (categoryVal.value !== 'All') {
      // Map UI category names to database enum values
      const categoryMap: Record<string, string> = {
        'Slot': 'SLOTS',
        'Fish': 'FISH',
        'Table': 'TABLE'
      }
      params.category = categoryMap[categoryVal.value]
    }

    const res = await getAllGames(params)

    gameList.value = res as unknown as Game[] //GameList as Game[]

    if (backTop) {
      useCommon().scrollToTop()
    }
  } catch (error) {
    console.error('Failed to get game list:', error)
  } finally {
    isLoading.value = false
  }
}

const searchGame = () =>
{
  currentPage.value = 1
  getGameList({ backTop: true })
}

const searchGameByCategory = () =>
{
  currentPage.value = 1
  getGameList({ backTop: true })
}

const handleCurrentChange = (val: number) =>
{
  currentPage.value = val
  getGameList({ backTop: true })
}

const toDetail = (item: Game) =>
{
  router.push({ name: 'GameDetail', params: { id: item.id } })
}

const toEdit = (item: Game) =>
{
  router.push({ name: 'GamePublish', query: { id: item.id } })
}

const toAddGame = () =>
{
  router.push({ name: 'GamePublish' })
}

const handleFeaturedToggle = (item: Game) =>
{
  // Toggle the isFeatured status
  item.isFeatured = !item.isFeatured

  // Here you can add API call to update the server
  // await updateGameFeatureStatus(item.id, item.isFeatured)

  console.log(`Game "${item.title}" is now ${item.isFeatured ? 'featured' : 'not featured'}`)
}

onMounted(() =>
{
  getGameList()
})
</script>

<style lang="scss">
.custom-segmented .el-segmented {
  height: 40px;
  padding: 6px;

  --el-border-radius-base: 8px;
}
</style>
