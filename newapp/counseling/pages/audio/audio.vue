<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { orderApi } from '@/api/modules'
import { useTRTC } from '@/hooks/useTRTC'
import { consultPermissions } from '@/utils/permission'
import { durationLabel } from '@/utils/format'

const orderId = ref('')
const orderInfo = ref<any>(null)
const status = ref<'idle' | 'connecting' | 'talking' | 'ended'>('idle')
const timer = ref<any>(null)

const { inCall, errorMessage, start, hangup, toggleMic, trtcStore } = useTRTC('voice')

onLoad(async (q) => {
  orderId.value = q?.orderId || ''
  if (orderId.value) orderInfo.value = await orderApi.detail(orderId.value)
})

onUnload(() => cleanup())

async function cleanup() {
  if (timer.value) clearInterval(timer.value)
  if (inCall.value) await hangup()
}

async function startCall() {
  const ok = await consultPermissions.audio()
  if (!ok) {
    uni.showToast({ title: '请授权麦克风权限', icon: 'none' })
    return
  }
  status.value = 'connecting'
  try {
    await start(orderId.value)
    status.value = 'talking'
    timer.value = setInterval(() => trtcStore.tick(), 1000)
  } catch (e: any) {
    status.value = 'idle'
    uni.showToast({ title: errorMessage.value || '通话失败', icon: 'none' })
  }
}

async function endCall() {
  if (timer.value) clearInterval(timer.value)
  await hangup()
  status.value = 'ended'
}
</script>

<template>
  <view class="audio-page">
    <view class="status">
      <text v-if="status === 'idle'">未开始</text>
      <text v-else-if="status === 'connecting'">连接中...</text>
      <text v-else-if="status === 'talking'">{{ durationLabel(trtcStore.duration) }}</text>
      <text v-else>通话已结束</text>
    </view>

    <view class="avatar-area">
      <image class="avatar" :src="orderInfo?.counselorAvatar || '/static/images/default-avatar.png'" />
      <text class="name">{{ orderInfo?.counselorName || '咨询师' }}</text>
    </view>

    <view class="actions safe-bottom">
      <view class="action-btn" @tap="toggleMic">
        <u-icon :name="trtcStore.microphoneOn ? 'mic' : 'mic-off'" size="56" />
        <text>{{ trtcStore.microphoneOn ? '麦克风开' : '麦克风关' }}</text>
      </view>

      <view v-if="status === 'talking'" class="action-btn end" @tap="endCall">
        <u-icon name="phone" size="56" color="#fff" />
        <text style="color: #fff">挂断</text>
      </view>
      <view v-else-if="status === 'idle' || status === 'ended'" class="action-btn start" @tap="startCall">
        <u-icon name="phone" size="56" color="#fff" />
        <text style="color: #fff">开始咨询</text>
      </view>
      <view v-else class="action-btn">
        <u-loading-icon color="#fff" />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.audio-page {
  @include column-center;
  height: 100vh;
  background: linear-gradient(180deg, #5b8ff9 0%, #2e5dc4 100%);
  color: #fff;
  padding: 80rpx 0;
}
.status {
  font-size: 36rpx;
  margin-bottom: 60rpx;
}
.avatar-area {
  @include column-center;
  flex: 1;
  .avatar {
    width: 240rpx;
    height: 240rpx;
    border-radius: 50%;
    border: 6rpx solid rgba(255, 255, 255, 0.4);
  }
  .name {
    margin-top: 32rpx;
    font-size: 36rpx;
    font-weight: 600;
  }
}
.actions {
  display: flex;
  align-items: center;
  gap: 60rpx;
  margin-bottom: 60rpx;
}
.action-btn {
  @include column-center;
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 24rpx;
  gap: 8rpx;
  &.start {
    background: $success-color;
  }
  &.end {
    background: $error-color;
  }
}
</style>