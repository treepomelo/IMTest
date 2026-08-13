"use strict";
const common_vendor = require("../../common/vendor.js");
const common_config = require("../../common/config.js");
const _sfc_main = {
  __name: "index",
  setup(__props) {
    const SDKAppID = 1600156373;
    const getSigApiUrl = `${common_config.BASE_URL}/api/im/get-usersig`;
    const loginUserId = common_vendor.ref("test_user_1");
    const isLogin = common_vendor.ref(false);
    const handleLogin = async () => {
      if (!loginUserId.value)
        return common_vendor.index.showToast({ title: "请输入ID", icon: "none" });
      try {
        common_vendor.index.showLoading({ title: "安全认证中..." });
        const res = await common_vendor.index.request({
          url: getSigApiUrl,
          method: "GET",
          data: { userId: loginUserId.value }
        });
        if (res.statusCode !== 200 || res.data.code !== 200)
          throw new Error("签名获取失败");
        const userSig = res.data.data.userSig;
        if (!common_vendor.index.$chat) {
          common_vendor.index.$chat = common_vendor.TencentCloudChat.create({ SDKAppID });
          common_vendor.index.$chat.registerPlugin({ "tim-upload-plugin": common_vendor.TIMUploadPlugin });
        }
        await common_vendor.index.$chat.login({ userID: loginUserId.value, userSig });
        common_vendor.index.setStorageSync("currentUserId", loginUserId.value);
        common_vendor.index.hideLoading();
        isLogin.value = true;
      } catch (error) {
        common_vendor.index.hideLoading();
        common_vendor.index.showToast({ title: "登录失败", icon: "none" });
        console.error(error);
      }
    };
    const handleLogout = async () => {
      if (common_vendor.index.$chat)
        await common_vendor.index.$chat.logout();
      common_vendor.index.removeStorageSync("currentUserId");
      isLogin.value = false;
    };
    const goTo = (path) => {
      common_vendor.index.navigateTo({ url: path });
    };
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: !isLogin.value
      }, !isLogin.value ? {
        b: loginUserId.value,
        c: common_vendor.o(($event) => loginUserId.value = $event.detail.value),
        d: common_vendor.o(handleLogin)
      } : {
        e: common_vendor.t(loginUserId.value),
        f: common_vendor.o(($event) => goTo("/pages/im/index")),
        g: common_vendor.o(($event) => goTo("/pages/ai-chat/index")),
        h: common_vendor.o(handleLogout)
      });
    };
  }
};
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-1cf27b2a"], ["__file", "F:/.net2026/IMTest/IMTest-VUE/pages/index/index.vue"]]);
wx.createPage(MiniProgramPage);
