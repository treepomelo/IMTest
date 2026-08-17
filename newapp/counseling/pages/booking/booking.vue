<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import {
  counselorApi,
  orderApi,
  type Counselor,
  type CounselorAvailability,
  type ConsultType,
} from '@/api/modules'
import { useUserStore } from '@/stores/user'
import { formatMoney } from '@/utils'
import { wechatPay, PayError } from '@/utils/payment'
import CalendarStrip from '../../components/CalendarStrip.vue'
import TimeSlotGrid from '../../components/TimeSlotGrid.vue'

interface BookingPageQuery {
  counselorId: string
  type: ConsultType
}

const userStore = useUserStore()

const counselor = ref<Counselor | null>(null)
const availability = ref<CounselorAvailability | null>(null)
const loadingSlots = ref(false)

const counselorId = ref('')
const consultType = ref<ConsultType>('voice')

const selectedDate = ref(dayjs().format('YYYY-MM-DD'))
const selectedSlot = ref<{ startTime: string; endTime: string } | null>(null)

const submitting = ref(false)

const TYPE_LABEL: Record<ConsultType, string> = {
  text: '文字咨询',
  voice: '语音咨询',
  video: '视频咨询',
}

const DURATION_MIN = 60

onLoad((q?: BookingPageQuery | any) => {
  counselorId.value = q?.counselorId || ''
  const t = q?.type as ConsultType
  if (t === 'text' || t === 'voice' || t === 'video') consultType.value = t
  // 文字咨询本不该进预约页, 兜底跳回详情
  if (consultType.value === 'text') {
    uni.showToast({ title: '文字咨询无需预约', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 800)
    return
  }
  if (!counselorId.value) {
    uni.showToast({ title: '参数错误', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 800)
    return
  }
  fetchDetail()
  fetchSlots()
})

async function fetchDetail() {
  counselor.value = await counselorApi.detail(counselorId.value)
}

async function fetchSlots() {
  loadingSlots.value = true
  selectedSlot.value = null
  try {
    availability.value = await counselorApi.availability(counselorId.value, selectedDate.value)
  } finally {
    loadingSlots.value = false
  }
}

watch(selectedDate, () => {
  fetchSlots()
})

function handleSlotSelect(slot: { startTime: string; endTime: string; booked: boolean }) {
  selectedSlot.value = { startTime: slot.startTime, endTime: slot.endTime }
}

const slotKey = computed(() =>
  selectedSlot.value ? `${selectedSlot.value.startTime}-${selectedSlot.value.endTime}` : '',
)

const amount = computed(() => counselor.value?.pricePerHour ?? 0)

const canSubmit = computed(
  () => !!counselor.value && !!selectedSlot.value && !submitting.value,
)

async function submit() {
  if (!canSubmit.value || !counselor.value || !selectedSlot.value) return

  if (!userStore.isLogin) {
    uni.navigateTo({
      url: `/pages/login/login?redirect=${encodeURIComponent(getCurrentPageUrl())}`,
    })
    return
  }

  submitting.value = true
  uni.showLoading({ title: '创建订单...' })
  try {
    const scheduledAt = `${selectedDate.value} ${selectedSlot.value.startTime}:00`
    const order = await orderApi.create({
      counselorId: counselor.value.id,
      type: consultType.value,
      scheduledAt,
      duration: DURATION_MIN,
    })

    uni.showLoading({ title: '调起支付...' })
    const payRes = await orderApi.pay(order.id, 'wechat')
    await wechatPay(payRes.payParams ?? {})

    uni.hideLoading()
    uni.showToast({ title: '支付成功', icon: 'success' })

    // 跳到对应咨询页, redirectTo 避免回退到预约页
    const consultPage = consultType.value === 'voice' ? 'audio' : 'video'
    setTimeout(() => {
      uni.redirectTo({
        url: `/subPackages/counseling/pages/${consultPage}/${consultPage}?orderId=${order.id}`,
      })
    }, 600)
  } catch (e: any) {
    uni.hideLoading()
    if (e instanceof PayError) {
      uni.showToast({ title: e.message, icon: 'none' })
    } else {
      uni.showToast({ title: e?.message || '预约失败', icon: 'none' })
    }
    submitting.value = false
  }
}

function getCurrentPageUrl(): string {
  const pages = getCurrentPages()
  const cur = pages[pages.length - 1] as any
  return `/${cur?.route ?? ''}?counselorId=${counselorId.value}&type=${consultType.value}`
}
</script>

<template>
  <view v-if="counselor" class="booking-page">
    <!-- 咨询师信息 -->
    <view class="counselor card flex">
      <image class="avatar" :src="counselor.avatar" mode="aspectFill" />
      <view class="info flex-1">
        <text class="name">{{ counselor.name }}</text>
        <text class="title">{{ counselor.title }}</text>
        <text class="meta">★ {{ counselor.rating.toFixed(1) }} · {{ TYPE_LABEL[consultType] }}</text>
      </view>
    </view>

    <!-- 选择日期 -->
    <view class="section card">
      <view class="section-title">选择日期</view>
      <CalendarStrip v-model="selectedDate" />
    </view>

    <!-- 选择时段 -->
    <view class="section card">
      <view class="section-title">
        选择时段 <text class="section-sub">(共 {{ availability?.slots.length ?? 0 }} 个)</text>
      </view>
      <TimeSlotGrid
        :slots="availability?.slots ?? []"
        :loading="loadingSlots"
        :selected-key="slotKey"
        @select="handleSlotSelect"
      />
    </view>

    <!-- 占位, 避免底部按钮遮挡 -->
    <view class="placeholder" />

    <!-- 底部支付栏 -->
    <view class="action-bar safe-bottom">
      <view class="amount-box">
        <text class="amount-label">咨询费用</text>
        <text class="amount-num">{{ formatMoney(amount) }}</text>
      </view>
      <view class="btn" :class="{ disabled: !canSubmit }" @tap="submit">
        {{ selectedSlot ? '立即支付' : '请选择时段' }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.booking-page {
  padding: $spacing-base;
  padding-bottom: 200rpx;
}
.counselor {
  align-items: center;
  gap: $spacing-base;
  .avatar {
    width: 120rpx;
    height: 120rpx;
    border-radius: $border-radius-base;
    flex-shrink: 0;
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 4rpx;
  }
  .name {
    font-size: $font-size-lg;
    font-weight: 600;
  }
  .title {
    font-size: $font-size-xs;
    color: $text-secondary;
  }
  .meta {
    font-size: $font-size-xs;
    color: $text-regular;
    margin-top: 4rpx;
  }
}
.section {
  margin-top: $spacing-base;
  &-title {
    font-size: $font-size-base;
    font-weight: 600;
    margin-bottom: $spacing-sm;
  }
  &-sub {
    font-size: $font-size-xs;
    color: $text-secondary;
    font-weight: 400;
    margin-left: 8rpx;
  }
}
.placeholder {
  height: 80rpx;
}
.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  display: flex;
  align-items: center;
  padding: $spacing-sm $spacing-base;
  border-top: 2rpx solid $border-color-light;
  gap: $spacing-base;
}
.amount-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  .amount-label {
    font-size: $font-size-xs;
    color: $text-secondary;
  }
  .amount-num {
    font-size: $font-size-lg;
    color: $error-color;
    font-weight: 600;
  }
}
.btn {
  background: $primary-color;
  color: #fff;
  padding: $spacing-sm $spacing-xl;
  border-radius: $border-radius-base;
  font-size: $font-size-base;
  &.disabled {
    background: $text-placeholder;
    opacity: 0.7;
  }
}
</style>