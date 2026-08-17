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

const { inCall, errorMessage, start, hangup, toggleMic, flipCamera, localView, trtcStore } =
  useTRTC('video')

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
  const ok = await consultPermissions.video()
  if (!ok) {
    uni.showToast({ title: '请授权相机/麦克风', icon: 'none' })
    return
  }
  status.value = 'connecting'
  try {
    await start(orderId.value)
    status.value = 'talking'
    timer.value = setInterval(() => trtcStore.tick(), 1000)
  } catch (e: any) {
    status.value = 'idle'
    uni.showToast({ title: errorMessage.value || '视频连接失败', icon: 'none' })
  }
}

async function endCall() {
  if (timer.value) clearInterval(timer.value)
  await hangup()
  status.value = 'ended'
}
</script>

<template>
  <view class="video-page">
    <view v-if="status === 'talking'" class="video-stage">
      <view class="remote">
        <image class="remote-avatar" :src="orderInfo?.counselorAvatar || '/static/images/default-avatar.png'" />
        <text class="status-tip">{{ durationLabel(trtcStore.duration) }}</text>
      </view>
      <view class="local">
        <!-- #ifdef MP-WEIXIN -->
        <live-pusher id="local-pusher-view" class="local-view" />
        <!-- #endif -->
        <text class="self-tip">我</text>
      </view>
    </view>

    <view v-else class="placeholder">
      <image class="avatar" :src="orderInfo?.counselorAvatar || '/static/images/default-avatar.png'" />
      <text class="name">{{ orderInfo?.counselorName || '咨询师' }}</text>
      <text class="sub">
        {{ status === 'connecting' ? '连接中...' : '点击下方按钮开始视频咨询' }}
      </text>
    </view>

    <view class="actions safe-bottom">
      <view class="action-btn" @tap="toggleMic">
        <u-icon :name="trtcStore.microphoneOn ? 'mic' : 'mic-off'" size="48" />
      </view>
      <view class="action-btn" @tap="flipCamera">
        <u-icon name="reload" size="48" />
      </view>
      <view v-if="status === 'talking'" class="action-btn end" @tap="endCall">
        <u-icon name="phone" size="48" color="#fff" />
      </view>
      <view v-else-if="status === 'idle' || status === 'ended'" class="action-btn start" @tap="startCall">
        <u-icon name="video-play" size="48" color="#fff" />
      </view>
      <view v-else class="action-btn">
        <u-loading-icon color="#fff" />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.video-page {
  height: 100vh;
  background: #1a1a1a;
  color: #fff;
  position: relative;
  display: flex;
  flex-direction: column;
}
.video-stage {
  flex: 1;
  position: relative;
}
.remote {
  width: 100%;
  height: 100%;
  @include column-center;
  background: #000;
  position: relative;
  .remote-avatar {
    width: 240rpx;
    height: 240rpx;
    border-radius: 50%;
  }
  .status-tip {
    position: absolute;
    top: 100rpx;
    left: 32rpx;
    background: rgba(0, 0, 0, 0.4);
    padding: 8rpx 16rpx;
    border-radius: 8rpx;
    font-size: 24rpx;
  }
}
.local {
  position: absolute;
  top: 80rpx;
  right: 32rpx;
  width: 200rpx;
  height: 280rpx;
  background: #333;
  border-radius: 16rpx;
  overflow: hidden;
  border: 2rpx solid rgba(255, 255, 255, 0.3);
  .local-view {
    width: 100%;
    height: 100%;
  }
  .self-tip {
    position: absolute;
    bottom: 8rpx;
    left: 8rpx;
    font-size: 22rpx;
    background: rgba(0, 0, 0, 0.4);
    padding: 4rpx 12rpx;
    border-radius: 4rpx;
  }
}
.placeholder {
  flex: 1;
  @include column-center;
  gap: 16rpx;
  .avatar {
    width: 200rpx;
    height: 200rpx;
    border-radius: 50%;
  }
  .name {
    font-size: 36rpx;
    font-weight: 600;
  }
  .sub {
    color: rgba(255, 255, 255, 0.6);
    font-size: 26rpx;
  }
}
.actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40rpx;
  padding: 32rpx 24rpx;
  background: rgba(0, 0, 0, 0.5);
}
.action-btn {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  @include center;
  &.start {
    background: $success-color;
  }
  &.end {
    background: $error-color;
  }
}
</style>