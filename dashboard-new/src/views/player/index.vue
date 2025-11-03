<!-- User management page -->
<!-- art-full-height automatically calculates remaining page height -->
<!-- art-table-card a class that conforms to system style, automatically fills remaining height -->
<!-- For more useTable usage examples, please refer to Advanced Table Examples under Feature Examples or check official documentation -->
<!-- useTable documentation: https://www.artd.pro/docs/zh/guide/hooks/use-table.html -->
<template>
  <div class="player-page art-full-height">
    <!-- Search bar -->
    <PlayerSearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams"></PlayerSearch>

    <ElCard class="art-table-card" shadow="never">
      <!-- Table header -->
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElSpace wrap>
            <ElButton @click="showDialog('add')" v-ripple>Add User</ElButton>
          </ElSpace>
        </template>
      </ArtTableHeader>

      <!-- Table -->
      <ArtTable :loading="loading" :data="data" :columns="columns" :pagination="pagination"
        @selection-change="handleSelectionChange" @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange">
      </ArtTable>

      <!-- User dialog -->
      <PlayerDialog v-model:visible="dialogVisible" :type="dialogType" :player-data="currentPlayerData"
        @submit="handleDialogSubmit" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
import { getAllUsersWithBalance } from '@/api/client'
import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
import { useTable } from '@/composables/useTable'
import { ACCOUNT_TABLE_DATA } from '@/mock/temp/formData'
import { ElImage, ElMessageBox, ElTag } from 'element-plus'
import { UserWithBalance } from '../../../../backend/src/shared/types'
import PlayerDialog from './modules/player-dialog.vue'
import PlayerSearch from './modules/player-search.vue'

defineOptions({ name: 'Player' })

type PlayerListItem = UserWithBalance

// Dialog related
const dialogType = ref<Form.DialogType>('add')
const dialogVisible = ref(false)
const currentPlayerData = ref<Partial<PlayerListItem>>({})

// Selected rows
const selectedRows = ref<PlayerListItem[]>([])

const formatDate = (date: string | Date): string =>
{
  return useDateFormat(date, 'YYYY-MM-DD').value
}
// Search form
const searchForm = ref({
  playerName: undefined,
  playerGender: undefined,
  playerPhone: undefined,
  playerEmail: undefined,
  status: '1'
})

// User status configuration
const USER_STATUS_CONFIG = {
  'ONLINE': { type: 'success' as const, text: 'Online' },
  'OFFLINE': { type: 'info' as const, text: 'Offline' },
  'BANNED': { type: 'warning' as const, text: 'Error' },
  'PENDING': { type: 'danger' as const, text: 'Deleted' }
} as const

/**
 * Get user status configuration
 */
const getPlayerStatusConfig = (status: string) =>
{
  return (
    USER_STATUS_CONFIG[status as keyof typeof USER_STATUS_CONFIG] || {
      type: 'info' as const,
      text: 'Unknown'
    }
  )
}

const {
  columns,
  columnChecks,
  data,
  loading,
  pagination,
  getData,
  searchParams,
  resetSearchParams,
  handleSizeChange,
  handleCurrentChange,
  refreshData
} = useTable({
  // Core configuration
  core: {
    apiFn: getAllUsersWithBalance,
    apiParams: {
      page: 1,
      perPage: 20,
      ...searchForm.value
    },
    // Custom pagination field mapping, uses global configuration tableConfig.ts paginationKey when not set
    paginationKey: {
      page: 'pageNum',
      perPage: 'pageSize'
    },
    columnsFactory: () => [
      { type: 'selection' }, // Selection column
      { type: 'index', width: 60, label: 'No.' }, // Sequence number
      {
        prop: 'avatar',
        label: 'Username',
        width: 280,
        formatter: (row) =>
        {
          return h('div', { class: 'player flex-c' }, [
            h(ElImage, {
              class: 'avatar',
              src: row.avatarUrl,
              previewSrcList: [row.avatarUrl],
              // Whether image preview is inserted into body element, used to resolve abnormal styles of image preview inside table
              previewTeleported: true
            }),
            h('div', {}, [
              h('p', { class: 'player-name' }, row.username),
              h('p', { class: 'email' }, formatDate(row.createdAt))

            ])
          ])
        }
      },
      {
        prop: 'userBalances.realBalance',
        label: 'Real Balance',
        sortable: true,
        // checked: false, // Hide column
        formatter: (row) => {
          const realBalance = row.userBalances?.[0]?.realBalance
          return realBalance !== undefined ? realBalance : 'N/A'
        }
      },
      {
        prop: 'userBalances.bonusBalance',
        label: 'Bonus Balance',
        sortable: true,
        // checked: false, // Hide column
        formatter: (row) => {
          const bonusBalance = row.userBalances?.[0]?.bonusBalance
          return bonusBalance !== undefined ? bonusBalance : 'N/A'
        }
      },
      { prop: 'playerPhone', label: 'Phone' },
      {
        prop: 'status',
        label: 'Status',
        formatter: (row) =>
        {
          const statusConfig = getPlayerStatusConfig(row.status)
          return h(ElTag, { type: statusConfig.type }, () => statusConfig.text)
        }
      },
      {
        prop: 'createdAt',
        label: 'Created Date',
        sortable: true
      },
      {
        prop: 'operation',
        label: 'Actions',
        width: 120,
        fixed: 'right', // Fixed column
        formatter: (row) =>
          h('div', [
            h(ArtButtonTable, {
              type: 'edit',
              onClick: () => showDialog('edit', row)
            }),
            h(ArtButtonTable, {
              type: 'delete',
              onClick: () => deletePlayer(row)
            })
          ])
      }
    ]
  },
  // Data processing
  transform: {
    // Data transformer - replace avatar
    dataTransformer: (records) =>
    {
      // Type guard check
      if (!Array.isArray(records)) {
        console.warn('Data transformer: Expected array type, actually received:', typeof records)
        return []
      }

      // Use local avatar to replace avatar returned by interface
      return records.map((item, index: number) =>
      {
        return {
          ...item,
          avatar: ACCOUNT_TABLE_DATA[index % ACCOUNT_TABLE_DATA.length].avatar
        }
      })
    }
  }
})

/**
 * Search handling
 * @param params Parameters
 */
const handleSearch = (params: Record<string, any>) =>
{
  console.log(params)
  // Search parameter assignment
  Object.assign(searchParams, params)
  getData()
}

/**
 * Show user dialog
 */
const showDialog = (type: Form.DialogType, row?: PlayerListItem): void =>
{
  console.log('Open dialog:', { type, row })
  dialogType.value = type
  currentPlayerData.value = row || {}
  nextTick(() =>
  {
    dialogVisible.value = true
  })
}

/**
 * Delete user
 */
const deletePlayer = (row: PlayerListItem): void =>
{
  console.log('Delete user:', row)
  ElMessageBox.confirm(`Are you sure you want to delete this user?`, 'Delete User', {
    confirmButtonText: 'Confirm',
    cancelButtonText: 'Cancel',
    type: 'error'
  }).then(() =>
  {
    ElMessage.success('Deleted successfully')
  })
}

/**
 * Handle dialog submit event
 */
const handleDialogSubmit = async () =>
{
  try {
    dialogVisible.value = false
    currentPlayerData.value = {}
  } catch (error) {
    console.error('Submission failed:', error)
  }
}

/**
 * Handle table row selection change
 */
const handleSelectionChange = (selection: PlayerListItem[]): void =>
{
  selectedRows.value = selection
  console.log('Selected row data:', selectedRows.value)
}
</script>

<style scoped>
.player-page :deep(.player .avatar) {
  width: 40px;
  height: 40px;
  margin-left: 0;
  border-radius: 6px;
}

.player-page :deep(.player > div) {
  margin-left: 10px;
}

.player-page :deep(.player > div .player-name) {
  font-weight: 500;
  color: var(--art-gray-800);
}
</style>
