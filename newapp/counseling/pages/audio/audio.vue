<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'

import { orderApi } from '@/api/modules'
import { useUserStore } from '@/stores/user'
import { consultPermissions } from '@/utils/permission'
import { durationLabel } from '@/utils/format'

import {
  ensureTencentCallKit,
  callAudio,
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
 * 当前咨询师的腾讯 IM userID
 *
 * 已确认：
 *
 * counselorId === 腾讯 IM userID
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
    orderInfo.value =
      await orderApi.detail(orderId.value)

    /**
     * 检查当前登录用户
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
     * 检查咨询师
     */
    if (!counselorUserId.value) {
      uni.showToast({
        title: '订单缺少咨询师信息',
        icon: 'none',
      })
    }

    /**
     * 页面进入后提前初始化 TUICallKit。
     *
     * 这样点击“开始咨询”时不会再临时初始化。
     */
    await ensureTencentCallKit()
  } catch (e: any) {
    console.error(
      '[Audio] page init failed:',
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
 * 开始语音咨询
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

  /**
   * 防止自己呼叫自己
   */
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
   * 麦克风权限
   */
  const ok =
    await consultPermissions.audio()

  if (!ok) {
    uni.showToast({
      title: '请授权麦克风权限',
      icon: 'none',
    })

    return
  }

  initializing.value = true
  status.value = 'connecting'

  try {
    /**
     * 确保：
     *
     * IM login
     * +
     * TUICallKit init
     *
     * 已经完成
     */
    await ensureTencentCallKit()

    /**
     * 真正发起腾讯音频通话
     *
     * counselorId 就是腾讯 IM userID
     */
    await callAudio(
      counselorUserId.value,
    )

    status.value = 'talking'

    duration.value = 0

    timer.value = setInterval(() => {
      duration.value += 1
    }, 1000)
  } catch (e: any) {
    console.error(
      '[Audio] call failed:',
      e,
    )

    status.value = 'idle'

    uni.showToast({
      title:
        e?.message ||
        '语音通话失败',
      icon: 'none',
    })
  } finally {
    initializing.value = false
  }
}

/**
 * 注意：
 *
 * TUICallKit 自己负责真正的挂断。
 *
 * 这里不能继续调用旧 useTRTC 的 hangup。
 *
 * 因为现在已经完全不用 useTRTC。
 */
async function endCall() {
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }

  status.value = 'ended'
}

/**
 * 页面显示时间
 */
const displayDuration = computed(() => {
  return durationLabel(duration.value)
})
</script>

<template>
  <view class="audio-page">
    <view class="status">
      <text v-if="status === 'idle'">
        未开始
      </text>

      <text
        v-else-if="status === 'connecting'"
      >
        连接中...
      </text>

      <text
        v-else-if="status === 'talking'"
      >
        {{ displayDuration }}
      </text>

      <text v-else>
        通话已结束
      </text>
    </view>

    <view class="avatar-area">
      <image
        class="avatar"
        :src="
          orderInfo?.counselorAvatar ||
          '/static/images/default-avatar.png'
        "
        mode="aspectFill"
      />

      <text class="name">
        {{ orderInfo?.counselorName || '咨询师' }}
      </text>

      <text
        v-if="counselorUserId"
        class="user-id"
      >
        {{ counselorUserId }}
      </text>
    </view>

    <view class="actions safe-bottom">
      <!--
        TUICallKit 自己管理通话中的麦克风、
        挂断等控制。

        因此这里不再调用 useTRTC.toggleMic。
      -->

      <view
        v-if="
          status === 'idle' ||
          status === 'ended'
        "
        class="action-btn start"
        @tap="startCall"
      >
        <u-icon
          name="phone"
          size="56"
          color="#fff"
        />

        <text style="color: #fff">
          开始咨询
        </text>
      </view>

      <view
        v-else
        class="action-btn"
      >
        <u-loading-icon color="#fff" />

        <text style="color: #fff">
          {{ status === 'connecting'
            ? '连接中'
            : '通话中' }}
        </text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.audio-page {
  @include column-center;

  height: 100vh;

  background:
    linear-gradient(
      180deg,
      #5b8ff9 0%,
      #2e5dc4 100%
    );

  color: #fff;

  padding: 80rpx 0;

  box-sizing: border-box;
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

    border:
      6rpx solid
      rgba(255, 255, 255, 0.4);
  }

  .name {
    margin-top: 32rpx;

    font-size: 36rpx;

    font-weight: 600;
  }

  .user-id {
    margin-top: 12rpx;

    font-size: 22rpx;

    opacity: 0.6;
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

  background:
    rgba(255, 255, 255, 0.2);

  color: #fff;

  font-size: 24rpx;

  gap: 8rpx;

  &.start {
    background: $success-color;
  }
}
</style>