<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

interface Props {
  /** 当前选中日期 YYYY-MM-DD */
  modelValue: string
  /** 最小时可选日期 (默认今天) */
  minDate?: string
  /** 显示天数 (默认 7) */
  daysToShow?: number
}

const props = withDefaults(defineProps<Props>(), {
  minDate: () => dayjs().format('YYYY-MM-DD'),
  daysToShow: 7,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const today = computed(() => dayjs(props.minDate).startOf('day'))

const days = computed(() => {
  const list: Array<{ date: string; weekday: string; day: string; isToday: boolean; disabled: boolean }> = []
  for (let i = 0; i < props.daysToShow; i++) {
    const d = today.value.add(i, 'day')
    list.push({
      date: d.format('YYYY-MM-DD'),
      weekday: i === 0 ? '今天' : i === 1 ? '明天' : d.format('ddd'),
      day: d.format('MM-DD'),
      isToday: i === 0,
      disabled: false,
    })
  }
  return list
})

function selectDate(date: string) {
  if (date === props.modelValue) return
  emit('update:modelValue', date)
}
</script>

<template>
  <scroll-view class="strip" scroll-x :show-scrollbar="false">
    <view
      v-for="d in days"
      :key="d.date"
      class="day"
      :class="{ active: d.date === modelValue }"
      @tap="selectDate(d.date)"
    >
      <text class="weekday">{{ d.weekday }}</text>
      <text class="num">{{ d.day }}</text>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.strip {
  white-space: nowrap;
  padding: $spacing-sm 0;
}
.day {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 120rpx;
  height: 120rpx;
  margin: 0 $spacing-xs;
  border-radius: $border-radius-base;
  background: $bg-card;
  border: 2rpx solid transparent;
  transition: all 0.15s ease;

  &.active {
    background: $primary-color;
    border-color: $primary-color;
    .weekday,
    .num {
      color: #fff;
    }
  }
}
.weekday {
  font-size: $font-size-xs;
  color: $text-secondary;
  line-height: 1.4;
}
.num {
  font-size: $font-size-base;
  color: $text-primary;
  font-weight: 500;
  line-height: 1.4;
}
</style>