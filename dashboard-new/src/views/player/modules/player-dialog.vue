<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogType === 'add' ? 'Add User' : 'Edit User'"
    width="30%"
    align-center
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="80px">
      <ElFormItem label="Username" prop="playername">
        <ElInput v-model="formData.playername" placeholder="Please enter username" />
      </ElFormItem>
      <ElFormItem label="Phone" prop="phone">
        <ElInput v-model="formData.phone" placeholder="Please enter phone number" />
      </ElFormItem>
      <ElFormItem label="Gender" prop="gender">
        <ElSelect v-model="formData.gender">
          <ElOption label="Male" value="男" />
          <ElOption label="Female" value="女" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="Role" prop="role">
        <ElSelect v-model="formData.role" multiple>
          <ElOption
            v-for="role in roleList"
            :key="role.roleCode"
            :value="role.roleCode"
            :label="role.roleName"
          />
        </ElSelect>
      </ElFormItem>
    </ElForm>
    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">Cancel</ElButton>
        <ElButton type="primary" @click="handleSubmit">Submit</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { ROLE_LIST_DATA } from '@/mock/temp/formData'
  import type { FormInstance, FormRules } from 'element-plus'

  interface Props {
    visible: boolean
    type: string
    playerData?: Partial<Api.SystemManage.PlayerListItem>
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

// Role list data
  const roleList = ref(ROLE_LIST_DATA)

  // Dialog display control
  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const dialogType = computed(() => props.type)

  // Form instance
  const formRef = ref<FormInstance>()

  // Form data
  const formData = reactive({
    playername: '',
    phone: '',
    gender: '男',
    role: [] as string[]
  })

  // Form validation rules
  const rules: FormRules = {
    playername: [
      { required: true, message: 'Please enter username', trigger: 'blur' },
      { min: 2, max: 20, message: 'Length must be between 2 and 20 characters', trigger: 'blur' }
    ],
    phone: [
      { required: true, message: 'Please enter phone number', trigger: 'blur' },
      { pattern: /^1[3-9]\d{9}$/, message: 'Please enter correct phone number format', trigger: 'blur' }
    ],
    gender: [{ required: true, message: 'Please select gender', trigger: 'blur' }],
    role: [{ required: true, message: 'Please select role', trigger: 'blur' }]
  }

  /**
   * Initialize form data
   * Fill form according to dialog type (add/edit)
   */
  const initFormData = () => {
    const isEdit = props.type === 'edit' && props.playerData
    const row = props.playerData

    Object.assign(formData, {
      playername: isEdit && row ? row.playerName || '' : '',
      phone: isEdit && row ? row.playerPhone || '' : '',
      gender: isEdit && row ? row.playerGender || '男' : '男',
      role: isEdit && row ? (Array.isArray(row.playerRoles) ? row.playerRoles : []) : []
    })
  }

  /**
   * Watch dialog state changes
   * Initialize form data and clear validation state when dialog opens
   */
  watch(
    () => [props.visible, props.type, props.playerData],
    ([visible]) => {
      if (visible) {
        initFormData()
        nextTick(() => {
          formRef.value?.clearValidate()
        })
      }
    },
    { immediate: true }
  )

  /**
   * Submit form
   * Trigger submit event after validation passes
   */
  const handleSubmit = async () => {
    if (!formRef.value) return

    await formRef.value.validate((valid) => {
      if (valid) {
        ElMessage.success(dialogType.value === 'add' ? 'Added successfully' : 'Updated successfully')
        dialogVisible.value = false
        emit('submit')
      }
    })
  }
</script>
