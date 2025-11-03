<template>
  <ArtDataListCard
    class="mb-5"
    :maxCount="4"
    :list="dataList"
    title="Recent Activities"
    subtitle="Order Processing Status"
    :showMoreButton="true"
    @more="handleMore"
  />
</template>

<script setup lang="ts">
  interface TransactionItem {
    title: string
    status: string
    time: string
    class: string
    icon: string
  }

  /**
   * Recent activities data list
   * Display business activity status such as order processing, refund applications, complaint handling, etc.
   */
  const dataList: TransactionItem[] = [
    {
      title: 'New order #38291',
      status: 'Pending',
      time: '5 minutes',
      class: 'bg-theme/12 text-theme',
      icon: 'ri:shopping-bag-4-line'
    },
    {
      title: 'Refund application #12845',
      status: 'Processing',
      time: '10 minutes',
      class: 'bg-secondary/12 text-secondary',
      icon: 'ri:profile-line'
    },
    {
      title: 'Customer complaint handling',
      status: 'Pending',
      time: '15 minutes',
      class: 'bg-warning/12 text-warning',
      icon: 'ri:customer-service-2-line'
    },
    {
      title: 'Low stock alert',
      status: 'Urgent',
      time: '20 minutes',
      class: 'bg-danger/12 text-danger',
      icon: 'ri:box-1-line'
    },
    {
      title: 'Order #29384 shipped',
      status: 'Completed',
      time: '20 minutes',
      class: 'bg-success/12 text-success',
      icon: 'ri:shopping-bag-3-line'
    }
  ]

  /**
   * Handle view more button click event
   */
  const handleMore = (): void => {
    // TODO: Add view more logic
  }
</script>
