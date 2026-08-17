<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { orderApi } from '@/api/modules'
import { useIM } from '@/hooks/useIM'
import { useUserStore } from '@/stores/user'
import { useConversationStore } from '@/stores/conversation'
import { uploadFile } from '@/utils/upload'
import type { Order } from '@/api/modules'

const userStore = useUserStore()
const convStore = useConversationStore()

const orderId = ref('')
const orderInfo = ref<Order | null>(null)
const inputText = ref('')
const conversationId = ref('')
const scrollIntoView = ref('')
const sending = ref(false)

const isMockMode = import.meta.env.VITE_USE_MOCK === 'true'

const im = useIM(() => conversationId.value)

onLoad(async (q?: { orderId?: string; conversationId?: string }) => {
  orderId.value = q?.orderId || ''
  if (q?.conversationId) conversationId.value = decodeURIComponent(q.conversationId)
  if (!orderId.value) return
  orderInfo.value = await orderApi.detail(orderId.value)
  if (!conversationId.value) {
    conversationId.value =
      orderInfo.value?.conversationId || `C2C${orderInfo.value?.counselorId}`
  }

  await im.setup()
  await im.loadHistory(true)
  await ensureOrderCard()
  await im.readMark()
  convStore.markRead(conversationId.value)
  scrollToBottom()
})

/** 首次进入会话时发一张订单卡片 (幂等: 已发过则跳过) */
async function ensureOrderCard() {
  if (!orderInfo.value || orderInfo.value.type !== 'text') return
  const alreadySent = im.messages.value.some(
    (m) => m.type === 'TIMCustomElem' && parseCustom(m)?.id === orderInfo.value?.id,
  )
  if (alreadySent) return
  await im.sendOrderCard({
    id: orderInfo.value.id,
    amount: orderInfo.value.amount,
    counselorName: orderInfo.value.counselorName,
  })
}

/** 解析自定义消息 payload.data (JSON 字符串) */
function parseCustom(m: any): any {
  try {
    return JSON.parse(m?.payload?.data || '{}')
  } catch {
    return {}
  }
}

function goOrderDetail(orderId: string) {
  uni.navigateTo({ url: `/subPackages/order/pages/detail/detail?id=${orderId}` })
}

/* ---------------- 文字消息 ---------------- */

async function handleSend() {
  const text = inputText.value.trim()
  if (!text || sending.value) return
  inputText.value = ''
  sending.value = true
  try {
    await im.send(text)
    const lastMsg = im.messages.value[im.messages.value.length - 1]
    if (lastMsg) {
      convStore.upsertLastMessage(conversationId.value, {
        text: '[文字]',
        time: lastMsg.time || Date.now(),
        from: 'me',
        type: lastMsg.type,
      })
    }
    scrollToBottom()
  } catch (e: any) {
    inputText.value = text
    uni.showToast({ title: e?.message || '发送失败', icon: 'none' })
  } finally {
    sending.value = false
  }
}

/* ---------------- 图片消息 ---------------- */

function showImagePicker() {
  uni.showActionSheet({
    itemList: ['从相册选择', '拍照'],
    success: (res) => {
      if (res.tapIndex === 0) pickAndSendImage(['album'])
      else if (res.tapIndex === 1) pickAndSendImage(['camera'])
    },
  })
}

async function pickAndSendImage(sourceType: ('album' | 'camera')[]) {
  if (sending.value) return
  try {
    const chooseRes = await uni.chooseImage({
      count: 1,
      sourceType,
      sizeType: ['compressed'],
    })
    const tempFilePath = chooseRes.tempFilePaths[0]
    if (!tempFilePath) return

    sending.value = true
    uni.showLoading({ title: '发送中...' })

    // mock 模式: 直接用 tempFilePath 作为图片 URL, 跳过真上传
    // 真后端: 走 /upload/image 上传, 返回 url
    let imageUrl = tempFilePath
    if (!isMockMode) {
      const res = await uploadFile<{ url: string }>({
        url: '/upload/image',
        filePath: tempFilePath,
        name: 'file',
      })
      imageUrl = res.url
    }

    await im.sendImage(imageUrl)
    const lastMsg = im.messages.value[im.messages.value.length - 1]
    if (lastMsg) {
      convStore.upsertLastMessage(conversationId.value, {
        text: '[图片]',
        time: lastMsg.time || Date.now(),
        from: 'me',
        type: lastMsg.type,
      })
    }
    scrollToBottom()
  } catch (e: any) {
    // 用户取消选择不报错
    if (e?.errMsg?.includes('cancel')) return
    uni.showToast({ title: e?.message || '图片发送失败', icon: 'none' })
  } finally {
    uni.hideLoading()
    sending.value = false
  }
}

/* ---------------- 工具 ---------------- */

function scrollToBottom() {
  setTimeout(() => {
    const len = im.messages.value.length
    if (len > 0) scrollIntoView.value = `msg-${len - 1}`
  }, 50)
}

function avatarOf(fromId: string) {
  return fromId === userStore.userId
    ? userStore.avatar || '/static/images/default-avatar.png'
    : orderInfo.value?.counselorAvatar
}

function previewImage(url: string, urls: string[]) {
  uni.previewImage({ urls, current: url })
}

/** 收集所有图片消息的 URL (用于 previewImage 轮播) */
function collectImageUrls(): string[] {
  return im.messages.value
    .filter((m) => m.type === 'TIMImageElem')
    .map((m) => m.payload?.url || m.payload?.imageUrl)
    .filter(Boolean)
}

function onImageTap(url: string) {
  previewImage(url, collectImageUrls())
}
</script>

<template>
  <view class="chat-page">
    <scroll-view class="messages" scroll-y :scroll-into-view="scrollIntoView">
      <view v-if="im.loading.value && im.messages.value.length === 0" class="loading">
        <u-loading-icon />
      </view>
      <view v-else-if="im.messages.value.length === 0" class="empty">暂无消息,说点什么吧</view>
      <view
        v-for="(m, i) in im.messages.value"
        :id="'msg-' + i"
        :key="m.ID || i"
        :class="['msg', { mine: m.from === userStore.userId }]"
      >
        <image class="avatar" :src="avatarOf(m.from)" mode="aspectFill" />
        <view class="bubble-wrap">
          <!-- 文字消息 -->
          <view v-if="m.type === 'TIMTextElem'" class="bubble text-bubble">
            <text>{{ m.payload?.text }}</text>
          </view>
          <!-- 图片消息 -->
          <view
            v-else-if="m.type === 'TIMImageElem'"
            class="bubble image-bubble"
            @tap="onImageTap(m.payload?.url || m.payload?.imageUrl)"
          >
            <image
              class="msg-image"
              :src="m.payload?.url || m.payload?.imageUrl"
              mode="widthFix"
              @longpress="onImageTap(m.payload?.url || m.payload?.imageUrl)"
            />
          </view>
          <!-- 自定义消息 (订单卡片等) -->
          <view v-else-if="m.type === 'TIMCustomElem'" class="bubble custom-bubble">
            <view
              v-if="parseCustom(m).type === 'order'"
              class="order-card"
              @tap="goOrderDetail(parseCustom(m).id)"
            >
              <view class="order-card-header">
                <u-icon name="file-text-fill" size="28" color="#5B8FF9" />
                <text class="order-card-title">{{ m.payload?.description || '订单提醒' }}</text>
              </view>
              <view class="order-card-row">
                <text class="order-card-label">咨询师</text>
                <text class="order-card-value">{{ parseCustom(m).counselorName }}</text>
              </view>
              <view class="order-card-row">
                <text class="order-card-label">金额</text>
                <text class="order-card-amount">¥{{ parseCustom(m).amount }}</text>
              </view>
              <view class="order-card-footer">查看订单 ›</view>
            </view>
            <text v-else class="custom-fallback">{{ m.payload?.description || '卡片消息' }}</text>
          </view>
          <view v-else class="bubble text-bubble">
            <text>[{{ m.type }}]</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="input-bar safe-bottom">
      <view class="plus-btn" @tap="showImagePicker">
        <u-icon name="plus-circle-fill" size="40" color="#5B8FF9" />
      </view>
      <view class="input-wrap">
        <input
          v-model="inputText"
          class="native-input"
          placeholder="说点什么..."
          placeholder-class="input-placeholder"
          :adjust-position="true"
          :hold-keyboard="true"
          confirm-type="send"
          :disabled="sending"
          @confirm="handleSend"
        />
      </view>
      <view
        class="send-btn"
        :class="{ disabled: !inputText.trim() || sending }"
        @tap="handleSend"
      >
        发送
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-page;
}
.messages {
  flex: 1;
  min-height: 0;
  padding: 16rpx 24rpx;
}
.loading,
.empty {
  padding: 80rpx 0;
  text-align: center;
  color: $text-secondary;
}
.msg {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
  &.mine {
    flex-direction: row-reverse;
    .text-bubble {
      background: $primary-color;
      color: #fff;
    }
    .image-bubble {
      background: transparent;
      padding: 0;
      border: none;
    }
  }
  .avatar {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    flex-shrink: 0;
  }
}
.bubble-wrap {
  max-width: 70%;
  display: flex;
  flex-direction: column;
}
.bubble {
  background: #fff;
  padding: 16rpx 24rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  word-break: break-all;
}
.text-bubble {
  /* default 样式 */
}
.image-bubble {
  background: transparent;
  padding: 8rpx;
  border-radius: 12rpx;
  overflow: hidden;
}
.custom-bubble {
  padding: 0;
  background: transparent;
}
.custom-fallback {
  display: block;
  background: #fff;
  padding: 16rpx 24rpx;
  border-radius: 16rpx;
  color: $text-secondary;
}
.order-card {
  width: 420rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  border: 2rpx solid $border-color-light;
  &-header {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding-bottom: 16rpx;
    margin-bottom: 16rpx;
    border-bottom: 2rpx solid $border-color-light;
  }
  &-title {
    font-size: 26rpx;
    font-weight: 600;
    color: $text-primary;
  }
  &-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6rpx 0;
    font-size: 26rpx;
  }
  &-label {
    color: $text-secondary;
  }
  &-value {
    color: $text-primary;
  }
  &-amount {
    color: $error-color;
    font-weight: 600;
  }
  &-footer {
    margin-top: 12rpx;
    padding-top: 12rpx;
    border-top: 2rpx solid $border-color-light;
    text-align: right;
    font-size: 24rpx;
    color: $primary-color;
  }
}
.msg-image {
  display: block;
  width: 360rpx;
  max-width: 100%;
  border-radius: 12rpx;
  background: #f0f0f0;
}
.input-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 16rpx;
  background: #fff;
  border-top: 2rpx solid $border-color-light;
}
.plus-btn {
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  @include column-center;
}
.input-wrap {
  flex: 1;
  min-width: 0;
  background: $bg-page;
  border-radius: 36rpx;
  padding: 0 24rpx;
}
.native-input {
  width: 100%;
  height: 72rpx;
  font-size: 28rpx;
  color: $text-primary;
  background: transparent;
}
.input-placeholder {
  color: $text-placeholder;
  font-size: 28rpx;
}
.send-btn {
  flex-shrink: 0;
  height: 72rpx;
  padding: 0 28rpx;
  line-height: 72rpx;
  background: $primary-color;
  color: #fff;
  font-size: 28rpx;
  border-radius: 36rpx;
  &.disabled {
    background: $text-placeholder;
    opacity: 0.7;
  }
}
</style>