<template>
  <ElConfigProvider size="default" :locale="locales[language]" :z-index="3000">
    <RouterView></RouterView>
  </ElConfigProvider>
</template>

<script setup lang="ts">
import en from 'element-plus/es/locale/lang/en'
import zh from 'element-plus/es/locale/lang/zh-cn'
import { useUserStore } from './store/modules/user'
import { systemUpgrade } from './utils/sys'

import { getMe } from './api/client'
import { supabase } from './api/supabase'
import { router } from './router'
import { checkStorageCompatibility } from './utils/storage'
import { setThemeTransitionClass } from './utils/theme/animation'

const userStore = useUserStore()
const { language } = storeToRefs(userStore)

const locales = {
  zh: zh,
  en: en
}

onBeforeMount(() =>
{
  setThemeTransitionClass(true)
})

onMounted(() =>
{
  supabase.auth.onAuthStateChange(async (event, session) =>
  {
    console.log(event)
    console.log(session)
    if (session == null) {
      userStore.setLoginStatus(false)
      router.push('/auth/login')
    } else {
      const userInfo = await getMe()
      userStore.setUserInfo(userInfo)
      userStore.setLoginStatus(true)
      router.push('/dashboard')
    }
  })
  // 检查存储兼容性
  checkStorageCompatibility()
  // 提升暗黑主题下页面刷新视觉体验
  setThemeTransitionClass(false)
  // 系统升级
  systemUpgrade()
})
</script>
