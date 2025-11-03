<!-- Article publish page -->
<template>
  <div>
    <div>
      <div class="max-w-250 mx-auto my-5">
        <!-- Article title, type -->
        <ElRow :gutter="10">
          <ElCol :span="18">
            <ElInput
              v-model.trim="gameName"
              placeholder="Please enter article title (max 100 characters)"
              maxlength="100"
            />
          </ElCol>
          <ElCol :span="6">
            <ElSelect v-model="gameType" placeholder="Please select article type" filterable>
              <ElOption
                v-for="item in gameTypes"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </ElSelect>
          </ElCol>
        </ElRow>

        <!-- Rich text editor -->
        <ArtWangEditor class="mt-2.5" v-model="editorHtml" />

        <div class="p-5 mt-5 art-card-xs">
          <h2 class="mb-5 text-xl font-medium">Publish Settings</h2>
          <!-- Image upload -->
          <ElForm>
            <ElFormItem label="Cover">
              <div class="mt-2.5">
                <ElUpload
                  :action="uploadImageUrl"
                  :headers="uploadHeaders"
                  :show-file-list="false"
                  :on-success="onSuccess"
                  :on-error="onError"
                  :before-upload="beforeUpload"
                >
                  <div
                    v-if="!cover"
                    class="flex-cc flex-col w-65 h-40 border border-dashed border-[#d9d9d9] rounded-md"
                  >
                    <ElIcon class="!text-xl !text-g-600"><Plus /></ElIcon>
                    <div class="mt-2 text-sm text-g-600">Click to upload cover</div>
                  </div>
                  <img v-else :src="cover" class="block w-65 h-40 object-cover" />
                </ElUpload>
                <div class="mt-2 text-xs text-g-700">Recommended size 16:9, jpg/png format</div>
              </div>
            </ElFormItem>
            <ElFormItem label="Visible">
              <ElSwitch v-model="visible" />
            </ElFormItem>
          </ElForm>

          <div class="flex justify-end">
            <ElButton type="primary" @click="submit" class="w-25">
              {{ pageMode === PageModeEnum.Edit ? 'Save' : 'Publish' }}
            </ElButton>
          </div>
        </div>
      </div>
    </div>

    <!-- <div class="box-border w-70 p-5 border border-[#e3e3e3] rounded-lg">
        <div v-for="(item, index) in outlineList" :key="index">
          <p :class="['h-7.5 text-xs leading-7.5 c-p', item.level === 3 && 'pl-2.5']">{{ item.text }}</p>
        </div>
      </div> -->
  </div>
</template>

<script setup lang="ts">
  import { Plus } from '@element-plus/icons-vue'
  import { ApiStatus } from '@/utils/http/status'
  import { useUserStore } from '@/store/modules/user'
  import EmojiText from '@/utils/ui/emojo'
  import { PageModeEnum } from '@/enums/formEnum'
  import axios from 'axios'
  import { useCommon } from '@/composables/useCommon'

  defineOptions({ name: 'GamePublish' })

  interface GameType {
    id: number
    name: string
  }

  interface UploadResponse {
    data: {
      url: string
    }
  }

  interface GameDetailResponse {
    code: number
    data: {
      title: string
      blog_class: string
      html_content: string
    }
  }

  const MAX_IMAGE_SIZE = 2 // MB
  const EMPTY_EDITOR_CONTENT = '<p><br></p>'

  const route = useRoute()
  const userStore = useUserStore()
  const { accessToken } = userStore

  const uploadImageUrl = `${import.meta.env.VITE_API_URL}/api/common/upload`
  const uploadHeaders = { Authorization: accessToken }

  const pageMode = ref<PageModeEnum>(PageModeEnum.Add)
  const gameName = ref('')
  const gameType = ref<number>()
  const gameTypes = ref<GameType[]>([])
  const editorHtml = ref('')
  const createDate = ref('')
  const cover = ref('')
  const visible = ref(true)

  /**
   * Initialize page mode (add or edit)
   */
  const initPageMode = () => {
    const { id } = route.query
    pageMode.value = id ? PageModeEnum.Edit : PageModeEnum.Add

    if (pageMode.value === PageModeEnum.Edit) {
      getGameDetail()
    } else {
      createDate.value = formatDate(useNow().value)
    }
  }

  /**
   * Get article category list
   */
  const getGameTypes = async () => {
    try {
      const { data } = await axios.get('https://www.qiniu.lingchen.kim/classify.json')
      if (data.code === 200) {
        gameTypes.value = data.data
      }
    } catch (error) {
      console.error('Failed to get article categories:', error)
      ElMessage.error('Failed to get article categories')
    }

    // TODO: Replace with real API call
    // const res = await GameService.getGameTypes({})
    // if (res.code === ApiStatus.success) {
    //   gameTypes.value = res.data
    // }
  }

  /**
   * Get article details (edit mode)
   */
  const getGameDetail = async () => {
    try {
      const { data } = await axios.get<GameDetailResponse>(
        'https://www.qiniu.lingchen.kim/blog_list.json'
      )

      if (data.code === ApiStatus.success) {
        const { title, blog_class, html_content } = data.data
        gameName.value = title
        gameType.value = Number(blog_class)
        editorHtml.value = html_content
      }
    } catch (error) {
      console.error('Failed to get article details:', error)
      ElMessage.error('Failed to get article details')
    }
  }

  /**
   * Format date to YYYY-MM-DD format
   */
  const formatDate = (date: string | Date): string => {
    return useDateFormat(date, 'YYYY-MM-DD').value
  }

  /**
   * Validate article form data
   */
  const validateGame = (): boolean => {
    if (!gameName.value.trim()) {
      ElMessage.error('Please enter article title')
      return false
    }

    if (!gameType.value) {
      ElMessage.error('Please select article type')
      return false
    }

    if (!editorHtml.value || editorHtml.value === EMPTY_EDITOR_CONTENT) {
      ElMessage.error('Please enter article content')
      return false
    }

    if (!cover.value) {
      ElMessage.error('Please upload cover image')
      return false
    }

    return true
  }

  /**
   * Clean up extra spaces in code blocks
   */
  const cleanCodeContent = (content: string): string => {
    return content.replace(/(\s*)<\/code>/g, '</code>')
  }

  /**
   * Add article
   */
  const addGame = async () => {
    if (!validateGame()) return

    try {
      const cleanedContent = cleanCodeContent(editorHtml.value)

      // TODO: Replace with real API call
      // const params = {
      //   title: gameName.value,
      //   type: gameType.value,
      //   content: cleanedContent,
      //   cover: cover.value,
      //   visible: visible.value
      // }
      // const res = await GameService.addGame(params)
      // if (res.code === ApiStatus.success) {
      //   ElMessage.success('Article published successfully')
      //   router.push({ name: 'GameList' })
      // }

      console.log('Add article:', { cleanedContent })
    } catch (error) {
      console.error('Failed to publish article:', error)
      ElMessage.error('Failed to publish article')
    }
  }

  /**
   * Edit article
   */
  const editGame = async () => {
    if (!validateGame()) return

    try {
      const cleanedContent = cleanCodeContent(editorHtml.value)

      // TODO: Replace with real API call
      // const params = {
      //   id: route.query.id,
      //   title: gameName.value,
      //   type: gameType.value,
      //   content: cleanedContent,
      //   cover: cover.value,
      //   visible: visible.value
      // }
      // const res = await GameService.editGame(params)
      // if (res.code === ApiStatus.success) {
      //   ElMessage.success('Article saved successfully')
      //   router.push({ name: 'GameList' })
      // }

      console.log('Edit article:', { cleanedContent })
    } catch (error) {
      console.error('Failed to save article:', error)
      ElMessage.error('Failed to save article')
    }
  }

  /**
   * Submit form (add or edit)
   */
  const submit = () => {
    if (pageMode.value === PageModeEnum.Edit) {
      editGame()
    } else {
      addGame()
    }
  }

  /**
   * Image upload success callback
   */
  const onSuccess = (response: UploadResponse) => {
    cover.value = response.data.url
    ElMessage.success(`Image uploaded successfully ${EmojiText[200]}`)
  }

  /**
   * Image upload failure callback
   */
  const onError = () => {
    ElMessage.error(`Image upload failed ${EmojiText[500]}`)
  }

  /**
   * File validation before upload
   */
  const beforeUpload = (file: File): boolean => {
    const isImage = file.type.startsWith('image/')
    const isLt2M = file.size / 1024 / 1024 < MAX_IMAGE_SIZE

    if (!isImage) {
      ElMessage.error('Only image files can be uploaded')
      return false
    }

    if (!isLt2M) {
      ElMessage.error(`Image size cannot exceed ${MAX_IMAGE_SIZE}MB`)
      return false
    }

    return true
  }

  onMounted(() => {
    useCommon().scrollToTop()
    getGameTypes()
    initPageMode()
  })
</script>

<style scoped></style>
