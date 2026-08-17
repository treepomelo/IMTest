<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { counselorApi, orderApi, type Counselor } from '@/api/modules'
import { useUserStore } from '@/stores/user'
import { formatMoney } from '@/utils'
import CustomNavbar from '@/components/common/CustomNavbar.vue'

const userStore = useUserStore()
const counselor = ref<Counselor | null>(null)
const counselorId = ref('')
const isFavorited = ref(false)

onLoad((q) => {
  counselorId.value = q?.id || ''
  if (counselorId.value) fetchDetail()
})

async function fetchDetail() {
  counselor.value = await counselorApi.detail(counselorId.value)
}

async function book(type: 'text' | 'voice' | 'video') {
  if (!userStore.isLogin) {
    uni.navigateTo({
      url:
        '/pages/login/login?redirect=' +
        encodeURIComponent(`/subPackages/counseling/pages/detail/detail?id=${counselorId.value}`),
    })
    return
  }
  // 文字咨询: 异步收发, 直接下单 → 跳聊天页 (不需要预约时间)
  if (type === 'text') {
    const order = await orderApi.create({
      counselorId: counselorId.value,
      type,
      duration: 60,
    })
    await orderApi.pay(order.id, 'wechat')
    uni.navigateTo({ url: `/subPackages/counseling/pages/chat/chat?orderId=${order.id}` })
    return
  }
  // 语音 / 视频: 跳预约页选时间
  uni.navigateTo({
    url: `/subPackages/counseling/pages/booking/booking?counselorId=${counselorId.value}&type=${type}`,
  })
}

let togglingFavorite = false

async function toggleFavorite() {
  if (!counselor.value || togglingFavorite) return
  togglingFavorite = true
  const next = !isFavorited.value
  isFavorited.value = next
  try {
    if (next) {
      await counselorApi.favorite(counselor.value.id)
      uni.showToast({ title: '已收藏', icon: 'success' })
    } else {
      await counselorApi.unfavorite(counselor.value.id)
      uni.showToast({ title: '已取消收藏', icon: 'none' })
    }
  } catch {
    isFavorited.value = !next
    uni.showToast({ title: '操作失败, 请重试', icon: 'none' })
  } finally {
    togglingFavorite = false
  }
}
</script>

<template>
  <view v-if="counselor" class="detail-page">
    <CustomNavbar title="咨询师详情" />

    <view class="content">
      <view class="header card">
        <view class="header-blob" />
        <image class="avatar" :src="counselor.avatar" mode="aspectFill" />
        <view class="info">
          <view class="name-row">
            <text class="name">{{ counselor.name }}</text>
            <view class="verified-badge">
              <u-icon name="checkmark-circle-fill" size="20" color="#4a90e2" />
              <text>已认证</text>
            </view>
          </view>
          <text class="title">{{ counselor.title }}</text>
          <view v-if="counselor.tags?.length" class="persona-tags">
            <text v-for="t in counselor.tags" :key="t" class="persona-tag">{{ t }}</text>
          </view>
        </view>
        <view class="favorite-btn" @tap="toggleFavorite">
          <u-icon
            :name="isFavorited ? 'star-fill' : 'star'"
            size="48"
            :color="isFavorited ? '#FF9900' : '#c0c4cc'"
          />
        </view>
      </view>

      <view class="stats-card card">
        <view class="stat">
          <text class="stat-num">{{ counselor.rating.toFixed(1) }}<text class="stat-unit">分</text></text>
          <text class="stat-label">评分</text>
        </view>
        <view class="stat-divider" />
        <view class="stat">
          <text class="stat-num">{{ counselor.servedCount }}<text class="stat-unit">次</text></text>
          <text class="stat-label">已咨询</text>
        </view>
        <view class="stat-divider" />
        <view class="stat">
          <text class="stat-num">{{ counselor.years }}<text class="stat-unit">年</text></text>
          <text class="stat-label">从业年限</text>
        </view>
      </view>

      <view class="trust-line">
        <u-icon name="checkmark-circle-fill" size="28" color="#4a90e2" />
        <text class="trust-text">咨询师实名认证</text>
        <text class="trust-dot">·</text>
        <text class="trust-text">隐私加密保护</text>
        <text class="trust-dot">·</text>
        <text class="trust-text">不满意可申诉</text>
      </view>

      <view class="section card">
        <view class="section-title">擅长领域</view>
        <view class="tags">
          <text v-for="t in counselor.specialties" :key="t" class="tag">{{ t }}</text>
        </view>
      </view>

      <view class="section card">
        <view class="section-title">个人介绍</view>
        <text class="intro">{{ counselor.intro }}</text>
      </view>

      <view class="section card">
        <view class="section-title">咨询价格</view>
        <view class="price-list">
          <view class="price-item">
            <text>文字咨询</text>
            <text>{{ formatMoney(counselor.pricePerText) }} / 小时</text>
          </view>
          <view class="price-item">
            <text>语音咨询</text>
            <text>{{ formatMoney(counselor.pricePerVoice) }} / 分钟</text>
          </view>
          <view class="price-item">
            <text>视频咨询</text>
            <text>{{ formatMoney(counselor.pricePerVideo) }} / 分钟</text>
          </view>
        </view>
      </view>
    </view>

    <view class="action-bar safe-bottom">
      <view class="btn btn-text" @tap="book('text')">
        <u-icon name="chat-fill" size="26" color="#fff" />
        <text>文字咨询</text>
      </view>
      <view class="btn btn-audio" @tap="book('voice')">
        <u-icon name="mic" size="26" color="#606266" />
        <text>语音咨询</text>
      </view>
      <view class="btn btn-video" @tap="book('video')">
        <u-icon name="camera-fill" size="26" color="#606266" />
        <text>视频咨询</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f0f4ff 0%, #f8f9fa 240rpx, #f8f9fa 100%);
}
.content {
  padding: 0 24rpx 200rpx;
}
.card {
  background: $bg-card;
  border-radius: $radius-card;
  box-shadow: $shadow-soft;
  padding: 32rpx;
  margin-top: 24rpx;
}
.header {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
  gap: 24rpx;
  .header-blob {
    position: absolute;
    top: -40rpx;
    right: -40rpx;
    width: 160rpx;
    height: 160rpx;
    border-radius: 50%;
    background: rgba(74, 144, 226, 0.15);
    filter: blur(40rpx);
    pointer-events: none;
  }
  .avatar {
    position: relative;
    z-index: 1;
    width: 140rpx;
    height: 140rpx;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .info {
    position: relative;
    z-index: 1;
    flex: 1;
  }
  .name-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
  }
  .name {
    font-size: 40rpx;
    font-weight: 700;
    color: $text-primary;
  }
  .verified-badge {
    display: flex;
    align-items: center;
    gap: 4rpx;
    background: rgba(74, 144, 226, 0.1);
    border-radius: 999rpx;
    padding: 4rpx 12rpx 4rpx 8rpx;
    text {
      font-size: 20rpx;
      color: $primary-color-v2;
      font-weight: 500;
    }
  }
  .title {
    margin-top: 8rpx;
    font-size: 24rpx;
    color: $text-secondary;
    display: block;
  }
  .persona-tags {
    margin-top: 16rpx;
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    gap: 10rpx;
    white-space: nowrap;
  }
  .persona-tag {
    flex-shrink: 0;
    background: $bg-page;
    color: $text-regular;
    padding: 4rpx 14rpx;
    border-radius: $radius-container;
    font-size: 22rpx;
  }
  .favorite-btn {
    position: relative;
    z-index: 1;
    flex-shrink: 0;
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    @include center;
    transition: background-color 0.2s;
    &:active {
      background: rgba(0, 0, 0, 0.04);
    }
  }
}
.stats-card {
  display: flex;
  align-items: center;
  .stat {
    flex: 1;
    @include column-center;
    gap: 10rpx;
    .stat-num {
      font-size: 48rpx;
      font-weight: 700;
      color: $primary-color-v2;
      line-height: 1;
    }
    .stat-unit {
      font-size: 22rpx;
      font-weight: 400;
      margin-left: 2rpx;
    }
    .stat-label {
      font-size: 23rpx;
      color: $text-secondary;
    }
  }
  .stat-divider {
    width: 2rpx;
    height: 48rpx;
    background: $border-color;
  }
}
.trust-line {
  margin-top: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  background: rgba(74, 144, 226, 0.06);
  border-radius: $radius-container;
  padding: 20rpx;
  .trust-text {
    font-size: 24rpx;
    color: $primary-color-v2;
  }
  .trust-dot {
    font-size: 24rpx;
    color: $primary-color-v2;
    opacity: 0.5;
  }
}
.section {
  &-title {
    @include headline-sm;
    color: $text-primary;
    margin-bottom: 20rpx;
  }
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  .tag {
    background: rgba(74, 144, 226, 0.1);
    color: $primary-color-v2;
    padding: 12rpx 24rpx;
    border-radius: $radius-container;
    font-size: 24rpx;
  }
}
.intro {
  color: $text-regular;
  line-height: 1.6;
  font-size: 28rpx;
}
.price-list {
  .price-item {
    display: flex;
    justify-content: space-between;
    padding: 16rpx 0;
    border-bottom: 1rpx solid $border-color-light;
    &:last-child {
      border-bottom: none;
    }
  }
}
.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  display: flex;
  padding: 16rpx 24rpx;
  gap: 16rpx;
  border-radius: $radius-card $radius-card 0 0;
  box-shadow: $shadow-soft;
  /* 三个按钮不再靠橘/绿描边区分语音/视频, 统一中性灰描边,
     只让"文字咨询"(最轻量、最常见的入门选择) 用渐变实心当唯一强调 */
  .btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
    padding: 20rpx 0;
    border-radius: $radius-container;
    font-size: 28rpx;
    font-weight: 600;
    border: 2rpx solid transparent;
    &-text {
      background: linear-gradient(135deg, #81a3ff 0%, #4a90e2 100%);
      color: #fff;
      box-shadow: 0 6rpx 16rpx rgba(74, 144, 226, 0.35);
    }
    &-audio,
    &-video {
      background: #fff;
      border-color: $border-color;
      color: $text-regular;
    }
  }
}
</style>