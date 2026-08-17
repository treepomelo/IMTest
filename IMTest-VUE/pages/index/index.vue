<template>
  <view class="hub-container">
    <view class="logo-area">
      <text class="title">TencentIM测试终端</text>
      <text class="subtitle">统一认证中心</text>
    </view>

    <!-- 登录前态 -->
    <view v-if="!isLogin" class="login-box">
      <input class="input-box" v-model="loginUserId" placeholder="请输入当前 UserID" />
      <button class="primary-btn" @click="handleLogin">系统登录</button>
    </view>

    <!-- 登录后态：路由导航 -->
    <view v-else class="nav-box">
      <view class="welcome">欢迎回来, {{ loginUserId }}</view>
      
      <view class="menu-list">
        <button class="menu-btn im-btn" @click="goTo('/pages/im/index')">
          1. 基础通讯测试 (单聊/群聊)
        </button>
        <button class="menu-btn ai-btn" @click="goTo('/pages/ai-chat/index')">
          2. AI 助教测试 (商业化计费)
        </button>
      </view>
      
      <button class="logout-btn" @click="handleLogout">退出登录</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import TencentCloudChat from '@tencentcloud/chat';
import TIMUploadPlugin from 'tim-upload-plugin';
import { BASE_URL } from '../../common/config.js';

// #ifdef H5
import { TUICallKitAPI } from '@trtc/calls-uikit-vue';
// #endif

// ⚠️ 替换为你真实的 SDKAppID
const SDKAppID = 1600156858;
const getSigApiUrl = `${BASE_URL}/api/im/get-usersig`;

const loginUserId = ref('test_user_1');
const isLogin = ref(false);

const handleLogin = async () => {
  if (!loginUserId.value) return uni.showToast({ title: '请输入ID', icon: 'none' });

  try {
    uni.showLoading({ title: '安全认证中...' });
    
    // 1. 请求后端获取签名
    const res = await uni.request({
      url: getSigApiUrl,
      method: 'GET',
      data: { userId: loginUserId.value }
    });

    if (res.statusCode !== 200 || res.data.code !== 200) throw new Error('签名获取失败');
    const userSig = res.data.data.userSig;

    // 2. 初始化全局 IM 实例并挂载到 uni 上 (跨页面共享)
    if (!uni.$chat) {
      uni.$chat = TencentCloudChat.create({ SDKAppID });

      // 必须注册上传插件，否则发送图片/语音/文件消息会失败
      uni.$chat.registerPlugin({ 'tim-upload-plugin': TIMUploadPlugin });
    }

    // 3. 登录腾讯云
    await uni.$chat.login({ userID: loginUserId.value, userSig });
    
    // 4. 将 UserId 也存入全局，方便 AI 页面扣费时使用
    uni.setStorageSync('currentUserId', loginUserId.value);

    // 5. 初始化 TUICallKit（音视频通话），复用当前 IM 登录态，不阻塞登录流程
    // #ifdef H5
    TUICallKitAPI.init({ userID: loginUserId.value, userSig, SDKAppID, tim: uni.$chat })
      .then(() => {
        TUICallKitAPI.setLanguage('zh-cn');
        uni.$callKitReady = true;
      })
      .catch((err) => {
        console.error('TUICallKit init failed:', err);
        uni.$callKitReady = false;
      });
    // #endif

    uni.hideLoading();
    isLogin.value = true;
    
  } catch (error) {
    uni.hideLoading();
    uni.showToast({ title: '登录失败', icon: 'none' });
    console.error(error);
  }
};

const handleLogout = async () => {
  // #ifdef H5
  try { if (uni.$callKitReady) await TUICallKitAPI.destroyed(); } catch (e) { console.error(e); }
  uni.$callKitReady = false;
  // #endif
  if (uni.$chat) await uni.$chat.logout();
  uni.removeStorageSync('currentUserId');
  isLogin.value = false;
};

const goTo = (path) => {
  uni.navigateTo({ url: path });
};
</script>

<style scoped>
.hub-container { height: 100vh; background: #fff; padding: 40px 20px; box-sizing: border-box; }
.logo-area { text-align: center; margin-bottom: 50px; }
.title { font-size: 28px; font-weight: bold; display: block; color: #333; }
.subtitle { font-size: 14px; color: #888; display: block; margin-top: 8px; }
.input-box { border-bottom: 1px solid #007aff; height: 45px; margin-bottom: 30px; font-size: 16px; text-align: center; }
.primary-btn { background: #007aff; color: #fff; border-radius: 8px; }
.welcome { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 30px; }
.menu-btn { margin-bottom: 20px; font-size: 16px; border-radius: 8px; color: #fff; }
.im-btn { background-color: #07c160; }
.ai-btn { background-color: #ff9a9e; color: #fff; }
.logout-btn { background-color: #f5f5f5; color: #666; margin-top: 50px; font-size: 15px; }
</style>