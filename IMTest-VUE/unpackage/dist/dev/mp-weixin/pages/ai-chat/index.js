"use strict";
const common_vendor = require("../../common/vendor.js");
const common_config = require("../../common/config.js");
const _sfc_main = {
  __name: "index",
  setup(__props) {
    const backendApiUrl = `${common_config.BASE_URL}/api/aichat`;
    const currentUserId = common_vendor.ref("");
    const freeCount = common_vendor.ref(10);
    const isUnlimited = common_vendor.ref(false);
    const inputText = common_vendor.ref("");
    const messageList = common_vendor.ref([
      { role: "ai", content: "你好！我是你的 AI 助教。请直接向我提问。" }
    ]);
    const scrollTarget = common_vendor.ref("");
    common_vendor.onMounted(() => {
      currentUserId.value = common_vendor.index.getStorageSync("currentUserId");
    });
    const sendMessage = async () => {
      if (!inputText.value.trim())
        return;
      const userText = inputText.value;
      messageList.value.push({ role: "user", content: userText });
      inputText.value = "";
      scrollToBottom();
      try {
        common_vendor.index.showNavigationBarLoading();
        const res = await common_vendor.index.request({
          url: `${backendApiUrl}/send`,
          method: "POST",
          data: {
            userId: currentUserId.value,
            content: userText
          }
        });
        if (res.statusCode === 200 && res.data.code === 200) {
          freeCount.value = res.data.data.remainCount;
          isUnlimited.value = res.data.data.isUnlimited;
          messageList.value.push({ role: "ai", content: res.data.data.reply });
        } else if (res.statusCode === 403 || res.data.code === 403) {
          freeCount.value = 0;
          isUnlimited.value = false;
          common_vendor.index.showToast({ title: "额度已用完", icon: "none" });
        }
      } catch (error) {
        console.error(error);
      } finally {
        common_vendor.index.hideNavigationBarLoading();
        scrollToBottom();
      }
    };
    const buyCourse = async () => {
      common_vendor.index.showLoading({ title: "模拟支付中..." });
      try {
        const res = await common_vendor.index.request({
          url: `${backendApiUrl}/buy-course`,
          method: "POST",
          data: { userId: currentUserId.value }
        });
        if (res.statusCode === 200) {
          common_vendor.index.hideLoading();
          common_vendor.index.showToast({ title: "解锁成功！", icon: "success" });
          isUnlimited.value = true;
          freeCount.value = 10;
        }
      } catch (e) {
        common_vendor.index.hideLoading();
      }
    };
    const scrollToBottom = () => {
      common_vendor.nextTick$1(() => {
        scrollTarget.value = "";
        setTimeout(() => {
          scrollTarget.value = "scroll-bottom-anchor";
        }, 50);
      });
    };
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.t(isUnlimited.value ? "💎 永久畅聊特权" : `剩余免费: ${freeCount.value}/10`),
        b: freeCount.value <= 3 ? 1 : "",
        c: isUnlimited.value ? 1 : "",
        d: common_vendor.f(messageList.value, (msg, index, i0) => {
          return common_vendor.e({
            a: msg.role === "ai"
          }, msg.role === "ai" ? {} : {}, {
            b: common_vendor.t(msg.content),
            c: msg.role === "user"
          }, msg.role === "user" ? {} : {}, {
            d: index,
            e: "msg-" + index,
            f: common_vendor.n(msg.role === "user" ? "msg-out" : "msg-in")
          });
        }),
        e: scrollTarget.value,
        f: isUnlimited.value || freeCount.value > 0
      }, isUnlimited.value || freeCount.value > 0 ? {
        g: common_vendor.o(sendMessage),
        h: inputText.value,
        i: common_vendor.o(($event) => inputText.value = $event.detail.value),
        j: common_vendor.o(sendMessage)
      } : {
        k: common_vendor.o(buyCourse)
      });
    };
  }
};
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-9edadb70"], ["__file", "F:/.net2026/IMTest/IMTest-VUE/pages/ai-chat/index.vue"]]);
wx.createPage(MiniProgramPage);
