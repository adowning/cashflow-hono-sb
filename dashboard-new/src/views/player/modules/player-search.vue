<template>
  <ArtSearchBar
    ref="searchBarRef"
    v-model="formData"
    :items="formItems"
    :rules="rules"
    @reset="handleReset"
    @search="handleSearch"
  >
  </ArtSearchBar>
</template>

<script setup lang="ts">
  interface Props {
    modelValue: Record<string, any>
  }
  interface Emits {
    (e: 'update:modelValue', value: Record<string, any>): void
    (e: 'search', params: Record<string, any>): void
    (e: 'reset'): void
  }
  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

// Form data two-way binding
  const searchBarRef = ref()
  const formData = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  // Validation rules
  const rules = {
    // playerName: [{ required: true, message: 'Please enter username', trigger: 'blur' }]
  }

  // Dynamic options
  const statusOptions = ref<{ label: string; value: string; disabled?: boolean }[]>([])

  // Mock interface to return status data
  function fetchStatusOptions(): Promise<typeof statusOptions.value> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { label: 'Online', value: '1' },
          { label: 'Offline', value: '2' },
          { label: 'Error', value: '3' },
          { label: 'Deleted', value: '4' }
        ])
      }, 1000)
    })
  }

  onMounted(async () => {
    statusOptions.value = await fetchStatusOptions()
  })

  // Form configuration
  const formItems = computed(() => [
    {
      label: 'Username',
      key: 'playerName',
      type: 'input',
      placeholder: 'Please enter username',
      clearable: true
    },
    {
      label: 'Phone',
      key: 'playerPhone',
      type: 'input',
      props: { placeholder: 'Please enter phone number', maxlength: '11' }
    },
    {
      label: 'Email',
      key: 'playerEmail',
      type: 'input',
      props: { placeholder: 'Please enter email' }
    },
    {
      label: 'Status',
      key: 'status',
      type: 'select',
      props: {
        placeholder: 'Please select status',
        options: statusOptions.value
      }
    },
    {
      label: 'Gender',
      key: 'playerGender',
      type: 'radiogroup',
      props: {
        options: [
          { label: 'Male', value: '1' },
          { label: 'Female', value: '2' }
        ]
      }
    }
  ])

  // Events
  function handleReset() {
    console.log('Reset form')
    emit('reset')
  }

  async function handleSearch() {
    await searchBarRef.value.validate()
    emit('search', formData.value)
    console.log('Form data', formData.value)
  }
</script>
