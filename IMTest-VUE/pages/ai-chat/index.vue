<template>
  <view class="chat-container">
    <view class="header">
      <text>AI 专属助教</text>
      <text class="quota-badge" :class="{ 'warning': freeCount <= 3, 'vip': isUnlimited }">
        {{ isUnlimited ? '💎 永久畅聊特权' : `剩余免费: ${freeCount}/10` }}
      </text>
    </view>

    <scroll-view scroll-y class="message-board" :scroll-into-view="scrollTarget" scroll-with-animation>
      <view v-for="(msg, index) in messageList" :key="index" :id="'msg-' + index"
            :class="['msg-row', msg.role === 'user' ? 'msg-out' : 'msg-in']">
        <view class="msg-avatar" v-if="msg.role === 'ai'">AI</view>
        <view class="msg-bubble">{{ msg.content }}</view>
        <view class="msg-avatar" v-if="msg.role === 'user'">我</view>
      </view>
      <view id="scroll-bottom-anchor" style="height: 1px;"></view>
    </scroll-view>

    <!-- 允许输入的条件：无限制 或者 还有免费额度 -->
    <view class="input-area" v-if="isUnlimited || freeCount > 0">
      <input class="chat-input" v-model="inputText" placeholder="向 AI 提问..." @confirm="sendMessage" />
      <button class="send-btn" @click="sendMessage">发送</button>
    </view>
    
    <!-- 支付墙拦截 -->
    <view class="pay-wall" v-else>
      <text class="pay-tip">体验次数已用完，解锁无限对话特权</text>
      <button class="btn-course" @click="buyCourse">模拟支付: 解锁课程</button>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { BASE_URL } from '../../common/config.js';

const backendApiUrl = `${BASE_URL}/api/aichat`;

const currentUserId = ref('');
const freeCount = ref(10); 
const isUnlimited = ref(false);
const inputText = ref('');
const messageList = ref([
  { role: 'ai', content: '你好！我是你的 AI 助教。请直接向我提问。' }
]);
const scrollTarget = ref('');

onMounted(() => {
  // 从全局缓存中读取登录人身份
  currentUserId.value = uni.getStorageSync('currentUserId');
});

const sendMessage = async () => {
  if (!inputText.value.trim()) return;

  const userText = inputText.value;
  messageList.value.push({ role: 'user', content: userText });
  inputText.value = '';
  scrollToBottom();

  try {
    uni.showNavigationBarLoading();
    
    // 真实调用 C# 后端鉴权及AI接口
    const res = await uni.request({
      url: `${backendApiUrl}/send`,
      method: 'POST',
      data: {
        userId: currentUserId.value,
        content: userText
      }
    });
    
    if (res.statusCode === 200 && res.data.code === 200) {
      // 成功，更新资产状态和对话记录
      freeCount.value = res.data.data.remainCount;
      isUnlimited.value = res.data.data.isUnlimited;
      messageList.value.push({ role: 'ai', content: res.data.data.reply });
    } 
    else if (res.statusCode === 403 || res.data.code === 403) {
      // 触发 403 拦截防火墙，额度清零，渲染支付墙
      freeCount.value = 0;
      isUnlimited.value = false;
      uni.showToast({ title: '额度已用完', icon: 'none' });
    }
  } catch (error) {
    console.error(error);
  } finally {
    uni.hideNavigationBarLoading();
    scrollToBottom();
  }
};

const buyCourse = async () => {
  uni.showLoading({ title: '模拟支付中...' });
  try {
    // 提交支付解锁请求给 C# 后端
    const res = await uni.request({
      url: `${backendApiUrl}/buy-course`,
      method: 'POST',
      data: { userId: currentUserId.value }
    });
    
    if (res.statusCode === 200) {
      uni.hideLoading();
      uni.showToast({ title: '解锁成功！', icon: 'success' });
      isUnlimited.value = true;
      freeCount.value = 10; // 虽然用不到了，重置一下
    }
  } catch(e) {
    uni.hideLoading();
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    scrollTarget.value = '';
    setTimeout(() => { scrollTarget.value = 'scroll-bottom-anchor'; }, 50);
  });
};
</script>

<style scoped>
.chat-container { height: 100vh; display: flex; flex-direction: column; background: #f5f5f5; }
.header { height: 44px; display: flex; justify-content: space-between; align-items: center; padding: 0 15px; background: #fff; border-bottom: 1px solid #eee; padding-top: var(--status-bar-height); font-weight: bold; }
.quota-badge { font-size: 12px; background: #e6f7ff; color: #1890ff; padding: 4px 8px; border-radius: 12px; font-weight: normal; }
.quota-badge.warning { background: #fff1f0; color: #f5222d; }
.quota-badge.vip { background: #fffbe6; color: #faad14; border: 1px solid #ffe58f; }
.message-board { flex: 1; padding: 15px; box-sizing: border-box; }
.msg-row { display: flex; margin-bottom: 20px; align-items: flex-start; }
.msg-in { justify-content: flex-start; }
.msg-out { justify-content: flex-end; }
.msg-avatar { width: 36px; height: 36px; background: #007aff; color: #fff; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 14px; margin: 0 10px; }
.msg-in .msg-avatar { background: #52c41a; }
.msg-bubble { max-width: 65%; padding: 10px; border-radius: 8px; background: #fff; line-height: 1.5; font-size: 15px; }
.msg-out .msg-bubble { background: #007aff; color: #fff; }
.input-area { display: flex; padding: 10px 15px; background: #fff; border-top: 1px solid #eee; padding-bottom: calc(10px + env(safe-area-inset-bottom)); }
.chat-input { flex: 1; background: #f5f5f5; height: 40px; border-radius: 20px; padding: 0 15px; }
.send-btn { margin-left: 10px; width: 60px; height: 40px; line-height: 40px; background: #007aff; color: #fff; border-radius: 20px; font-size: 14px; padding: 0; }
.pay-wall { padding: 20px 15px; background: #fff; border-top: 1px solid #eee; padding-bottom: calc(20px + env(safe-area-inset-bottom)); text-align: center; }
.pay-tip { font-size: 14px; color: #666; margin-bottom: 15px; display: block; }
.btn-course { background: #ff758c; color: #fff; border-radius: 25px; font-size: 15px; font-weight: bold; }
</style>