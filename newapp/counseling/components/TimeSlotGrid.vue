<script setup lang="ts">
import { computed } from 'vue'

interface Slot {
  startTime: string // HH:mm
  endTime: string
  booked: boolean
}

interface Props {
  slots: Slot[]
  /** 已选中的时段 key, 形如 "HH:mm-HH:mm" */
  selectedKey?: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedKey: '',
  loading: false,
})

const emit = defineEmits<{
  select: [slot: Slot]
}>()

const slotKey = (s: Slot) => `${s.startTime}-${s.endTime}`

function handleSelect(slot: Slot) {
  if (slot.booked) return
  emit('select', slot)
}

/** 简单分组: 上午(07-12) / 下午(12-18) / 晚上(18-23) */
const groups = computed(() => {
  const morning: Slot[] = []
  const afternoon: Slot[] = []
  const evening: Slot[] = []
  for (const s of props.slots) {
    const hour = Number(s.startTime.split(':')[0])
    if (hour < 12) morning.push(s)
    else if (hour < 18) afternoon.push(s)
    else evening.push(s)
  }
  return { morning, afternoon, evening }
})

function renderSlot(s: Slot) {
  const isSelected = slotKey(s) === props.selectedKey
  const cls = ['slot', { selected: isSelected, booked: s.booked }]
  return { cls, isSelected }
}
</script>

<template>
  <view class="time-slot-grid">
    <view v-if="loading" class="empty">加载中...</view>

    <template v-else>
      <view v-if="groups.morning.length" class="group">
        <text class="group-title">上午</text>
        <view class="grid">
          <view
            v-for="s in groups.morning"
            :key="slotKey(s)"
            :class="renderSlot(s).cls"
            @tap="handleSelect(s)"
          >
            <text class="time">{{ s.startTime }}-{{ s.endTime }}</text>
            <text class="status">{{ s.booked ? '已约满' : '可预约' }}</text>
          </view>
        </view>
      </view>

      <view v-if="groups.afternoon.length" class="group">
        <text class="group-title">下午</text>
        <view class="grid">
          <view
            v-for="s in groups.afternoon"
            :key="slotKey(s)"
            :class="renderSlot(s).cls"
            @tap="handleSelect(s)"
          >
            <text class="time">{{ s.startTime }}-{{ s.endTime }}</text>
            <text class="status">{{ s.booked ? '已约满' : '可预约' }}</text>
          </view>
        </view>
      </view>

      <view v-if="groups.evening.length" class="group">
        <text class="group-title">晚上</text>
        <view class="grid">
          <view
            v-for="s in groups.evening"
            :key="slotKey(s)"
            :class="renderSlot(s).cls"
            @tap="handleSelect(s)"
          >
            <text class="time">{{ s.startTime }}-{{ s.endTime }}</text>
            <text class="status">{{ s.booked ? '已约满' : '可预约' }}</text>
          </view>
        </view>
      </view>

      <view v-if="!groups.morning.length && !groups.afternoon.length && !groups.evening.length" class="empty">
        暂无可预约时段
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.time-slot-grid {
  padding: 0 $spacing-base $spacing-base;
}
.group {
  margin-bottom: $spacing-base;
}
.group-title {
  display: block;
  font-size: $font-size-sm;
  color: $text-secondary;
  margin-bottom: $spacing-sm;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-sm;
}
.slot {
  background: $bg-card;
  border: 2rpx solid $border-color;
  border-radius: $border-radius-base;
  padding: $spacing-sm 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  transition: all 0.15s ease;

  &.selected {
    background: $primary-color;
    border-color: $primary-color;
    .time,
    .status {
      color: #fff;
    }
  }
  &.booked {
    background: $bg-page;
    border-color: $border-color-light;
    opacity: 0.5;
    .time {
      color: $text-placeholder;
      text-decoration: line-through;
    }
    .status {
      color: $text-placeholder;
    }
  }
}
.time {
  font-size: $font-size-sm;
  color: $text-primary;
  font-weight: 500;
}
.status {
  font-size: $font-size-xs;
  color: $text-secondary;
}
.empty {
  text-align: center;
  padding: $spacing-xl 0;
  color: $text-secondary;
  font-size: $font-size-sm;
}
</style>