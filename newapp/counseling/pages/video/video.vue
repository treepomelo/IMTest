<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'

import { orderApi } from '@/api/modules'
import { useUserStore } from '@/stores/user'
import { consultPermissions } from '@/utils/permission'
import { durationLabel } from '@/utils/format'

import {
  ensureTencentCallKit,
  callVideo,
} from '../../utils/tencent-call'

const userStore = useUserStore()

const orderId = ref('')
const orderInfo = ref<any>(null)

const status = ref<
  'idle' | 'connecting' | 'talking' | 'ended'
>('idle')

const timer = ref<any>(null)
const duration = ref(0)

const initializing = ref(false)

/**
 * counselorId 就是腾讯 IM userID
 */
const counselorUserId = computed(() => {
  if (!orderInfo.value?.counselorId) {
    return ''
  }

  return String(orderInfo.value.counselorId)
})

/**
 * 当前用户腾讯 IM userID
 */
const currentUserId = computed(() => {
  return String(userStore.userId || '')
})

onLoad(async (q?: { orderId?: string }) => {
  orderId.value = q?.orderId || ''

  if (!orderId.value) {
    uni.showToast({
      title: '缺少订单号',
      icon: 'none',
    })

    setTimeout(() => {
      uni.navigateBack()
    }, 800)

    return
  }

  try {
    /**
     * 保留原有订单逻辑
     */
    orderInfo.value =
      await orderApi.detail(orderId.value)

    /**
     * 当前用户必须已经登录
     */
    if (!currentUserId.value) {
      uni.showToast({
        title: '请先登录',
        icon: 'none',
      })

      setTimeout(() => {
        uni.navigateBack()
      }, 800)

      return
    }

    /**
     * 咨询师 ID
     */
    if (!counselorUserId.value) {
      uni.showToast({
        title: '订单缺少咨询师信息',
        icon: 'none',
      })
    }

    /**
     * 提前初始化腾讯 IM + TUICallKit
     */
    await ensureTencentCallKit()
  } catch (e: any) {
    console.error(
      '[Video] page init failed:',
      e,
    )

    uni.showToast({
      title:
        e?.message ||
        '音视频服务初始化失败',
      icon: 'none',
    })
  }
})

onUnload(() => {
  cleanup()
})

function cleanup() {
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
}

/**
 * 发起视频咨询
 */
async function startCall() {
  if (initializing.value) {
    return
  }

  if (!currentUserId.value) {
    uni.showToast({
      title: '请先登录',
      icon: 'none',
    })

    return
  }

  if (!counselorUserId.value) {
    uni.showToast({
      title: '咨询师信息不存在',
      icon: 'none',
    })

    return
  }

  if (
    currentUserId.value ===
    counselorUserId.value
  ) {
    uni.showToast({
      title: '不能呼叫自己',
      icon: 'none',
    })

    return
  }

  /**
   * 请求相机 + 麦克风权限
   */
  const ok =
    await consultPermissions.video()

  if (!ok) {
    uni.showToast({
      title: '请授权相机/麦克风',
      icon: 'none',
    })

    return
  }

  initializing.value = true
  status.value = 'connecting'

  try {
    /**
     * 确保腾讯 IM + TUICallKit 已登录
     */
    await ensureTencentCallKit()

    /**
     * 发起真正的视频通话
     */
    await callVideo(
      counselorUserId.value,
    )

    status.value = 'talking'

    duration.value = 0

    timer.value = setInterval(() => {
      duration.value += 1
    }, 1000)
  } catch (e: any) {
    console.error(
      '[Video] call failed:',
      e,
    )

    status.value = 'idle'

    uni.showToast({
      title:
        e?.message ||
        '视频通话失败',
      icon: 'none',
    })
  } finally {
    initializing.value = false
  }
}

/**
 * 这里只负责结束本页面自己的计时状态。
 *
 * 真正的腾讯通话 UI / 挂断由 TUICallKit 管理。
 */
function endCall() {
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }

  status.value = 'ended'
}

const displayDuration = computed(() => {
  return durationLabel(duration.value)
})
</script>

<template>
  <view class="video-page">
    <!--
      注意：

      TUICallKit 的通话界面由腾讯组件负责。

      这里保留原 counselling 的页面外壳，
      不再使用原来的 live-pusher / useTRTC。
    -->

    <view
      v-if="status === 'talking'"
      class="video-stage"
    >
      <view class="remote">
        <image
          class="remote-avatar"
          :src="
            orderInfo?.counselorAvatar ||
            '/static/images/default-avatar.png'
          "
          mode="aspectFill"
        />

        <text class="status-tip">
          {{ displayDuration }}
        </text>
      </view>

      <view class="local">
        <text class="self-tip">
          我
        </text>
      </view>
    </view>

    <view
      v-else
      class="placeholder"
    >
      <image
        class="avatar"
        :src="
          orderInfo?.counselorAvatar ||
          '/static/images/default-avatar.png'
        "
        mode="aspectFill"
      />

      <text class="name">
        {{
          orderInfo?.counselorName ||
          '咨询师'
        }}
      </text>

      <text class="sub">
        {{
          status === 'connecting'
            ? '连接中...'
            : '点击下方按钮开始视频咨询'
        }}
      </text>
    </view>

    <view class="actions safe-bottom">
      <view
        v-if="
          status === 'talking'
        "
        class="action-btn end"
        @tap="endCall"
      >
        <u-icon
          name="phone"
          size="48"
          color="#fff"
        />
      </view>

      <view
        v-else-if="
          status === 'idle' ||
          status === 'ended'
        "
        class="action-btn start"
        @tap="startCall"
      >
        <u-icon
          name="video-play"
          size="48"
          color="#fff"
        />
      </view>

      <view
        v-else
        class="action-btn"
      >
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

    background:
      rgba(0, 0, 0, 0.4);

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

  border:
    2rpx solid
    rgba(255, 255, 255, 0.3);

  .self-tip {
    position: absolute;

    bottom: 8rpx;
    left: 8rpx;

    font-size: 22rpx;

    background:
      rgba(0, 0, 0, 0.4);

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
    color:
      rgba(255, 255, 255, 0.6);

    font-size: 26rpx;
  }
}

.actions {
  display: flex;

  align-items: center;

  justify-content: center;

  gap: 40rpx;

  padding: 32rpx 24rpx;

  background:
    rgba(0, 0, 0, 0.5);
}

.action-btn {
  width: 120rpx;
  height: 120rpx;

  border-radius: 50%;

  background:
    rgba(255, 255, 255, 0.2);

  @include center;

  &.start {
    background: $success-color;
  }

  &.end {
    background: $error-color;
  }
}
</style>