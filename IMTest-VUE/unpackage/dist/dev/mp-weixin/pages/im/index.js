"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  __name: "index",
  setup(__props) {
    const ui = common_vendor.reactive({
      currentView: "list",
      // 'list' | 'chat'
      searchMode: "user",
      searchKeyword: "",
      searchResult: null,
      showCreateModal: false,
      showGroupPanel: false,
      newGroupName: "",
      newGroupMembers: "",
      newGroupNotification: "",
      newGroupIntro: "",
      newGroupType: common_vendor.TencentCloudChat.TYPES.GRP_PUBLIC,
      newGroupJoinOption: common_vendor.TencentCloudChat.TYPES.JOIN_OPTIONS_FREE_ACCESS,
      inviteMemberId: "",
      scrollTarget: "",
      isRecording: false,
      recordSeconds: 0
    });
    const chat = common_vendor.reactive({
      conversationList: [],
      currentConvId: "",
      currentTargetName: "",
      messageList: [],
      inputText: ""
    });
    const group = common_vendor.reactive({
      profile: null,
      // 群资料
      memberList: [],
      // 成员列表
      memberCount: 0,
      // 成员总数
      memberOffset: 0,
      // 成员分页偏移
      loadingMembers: false,
      apps: [],
      // 入群申请
      panelTab: "profile",
      // 'profile' | 'members' | 'apply'
      selectedMember: null
      // 选中的成员（成员管理子面板）
    });
    const isCurrentGroup = common_vendor.computed(() => chat.currentConvId.startsWith("GROUP"));
    const TYPES = common_vendor.TencentCloudChat.TYPES;
    const MSG_TEXT = TYPES.MSG_TEXT;
    const MSG_IMAGE = TYPES.MSG_IMAGE;
    const MSG_SOUND = TYPES.MSG_SOUND;
    const MSG_GRP_TIP = TYPES.MSG_GRP_TIP;
    const groupTypeOptions = [
      { label: "公开群", value: TYPES.GRP_PUBLIC, desc: "可搜索、可自由申请加入" },
      { label: "私有群", value: TYPES.GRP_WORK, desc: "仅可邀请加入" },
      { label: "聊天室", value: TYPES.GRP_MEETING, desc: "临时会话、无人数上限" }
    ];
    const joinOptionOptions = [
      { label: "自由加入", value: TYPES.JOIN_OPTIONS_FREE_ACCESS },
      { label: "需管理员验证", value: TYPES.JOIN_OPTIONS_NEED_PERMISSION },
      { label: "禁止申请", value: TYPES.JOIN_OPTIONS_DISABLE_APPLY }
    ];
    const myUserID = common_vendor.index.getStorageSync("currentUserId") || "";
    const isGroupOwner = common_vendor.computed(() => {
      var _a;
      return ((_a = group.profile) == null ? void 0 : _a.ownerID) === myUserID;
    });
    const isGroupAdmin = common_vendor.computed(() => {
      var _a, _b;
      return ["Owner", "Admin"].includes((_b = (_a = group.profile) == null ? void 0 : _a.selfInfo) == null ? void 0 : _b.role);
    });
    const realGroupId = common_vendor.computed(() => {
      var _a;
      return (((_a = group.profile) == null ? void 0 : _a.groupID) || chat.currentConvId.replace("GROUP", "")).replace(/^@TGS#/, "");
    });
    const myNameCard = common_vendor.computed(() => {
      var _a, _b;
      return ((_b = (_a = group.profile) == null ? void 0 : _a.selfInfo) == null ? void 0 : _b.nameCard) || "";
    });
    let recorderTimer = null;
    let audioCtx = null;
    const recorderManager = common_vendor.index.getRecorderManager();
    const clearRecorderTimer = () => {
      if (recorderTimer) {
        clearInterval(recorderTimer);
        recorderTimer = null;
      }
    };
    common_vendor.onLoad(() => {
      if (!common_vendor.index.$chat) {
        common_vendor.index.showToast({ title: "系统实例丢失，请重新登录", icon: "none" });
        setTimeout(() => common_vendor.index.navigateBack(), 1500);
        return;
      }
      common_vendor.index.$chat.on(common_vendor.TencentCloudChat.EVENT.MESSAGE_RECEIVED, onMessageReceived);
      common_vendor.index.$chat.on(common_vendor.TencentCloudChat.EVENT.CONVERSATION_LIST_UPDATED, onConversationUpdated);
    });
    common_vendor.onShow(async () => {
      if (common_vendor.index.$chat)
        fetchConversationList();
    });
    common_vendor.onUnload(() => {
      ui.isRecording = false;
      clearRecorderTimer();
      if (audioCtx) {
        audioCtx.destroy();
        audioCtx = null;
      }
      if (common_vendor.index.$chat) {
        common_vendor.index.$chat.off(common_vendor.TencentCloudChat.EVENT.MESSAGE_RECEIVED, onMessageReceived);
        common_vendor.index.$chat.off(common_vendor.TencentCloudChat.EVENT.CONVERSATION_LIST_UPDATED, onConversationUpdated);
      }
    });
    const fetchConversationList = async () => {
      try {
        const res = await common_vendor.index.$chat.getConversationList();
        chat.conversationList = res.data.conversationList;
      } catch (error) {
        console.error("获取会话列表失败", error);
      }
    };
    const onConversationUpdated = (event) => {
      chat.conversationList = event.data;
    };
    const switchSearchMode = (mode) => {
      ui.searchMode = mode;
      clearSearch();
    };
    const clearSearch = () => {
      ui.searchKeyword = "";
      ui.searchResult = null;
    };
    const handleSearch = async () => {
      var _a, _b;
      if (!ui.searchKeyword.trim())
        return;
      common_vendor.index.showLoading({ title: "查找中..." });
      try {
        if (ui.searchMode === "user") {
          const res = await common_vendor.index.$chat.getUserProfile({ userIDList: [ui.searchKeyword] });
          ui.searchResult = ((_a = res.data) == null ? void 0 : _a.length) > 0 ? res.data[0] : null;
        } else {
          const res = await common_vendor.index.$chat.getGroupProfile({ groupID: ui.searchKeyword });
          ui.searchResult = ((_b = res.data) == null ? void 0 : _b.group) ? res.data.group : null;
        }
        if (!ui.searchResult)
          throw new Error("Not Found");
      } catch (error) {
        ui.searchResult = null;
        common_vendor.index.showToast({ title: "目标不存在", icon: "none" });
      } finally {
        common_vendor.index.hideLoading();
      }
    };
    const createGroup = async () => {
      if (!ui.newGroupName.trim())
        return common_vendor.index.showToast({ title: "群名不能为空", icon: "none" });
      common_vendor.index.showLoading({ title: "创建中..." });
      const memberList = ui.newGroupMembers.split(/[,，\s]+/).map((s) => s.trim()).filter((s) => s && s !== myUserID).map((userID) => ({ userID }));
      const options = {
        type: ui.newGroupType,
        name: ui.newGroupName.trim(),
        introduction: ui.newGroupIntro.trim(),
        notification: ui.newGroupNotification.trim(),
        memberList
      };
      if (ui.newGroupType === TYPES.GRP_PUBLIC) {
        options.joinOption = ui.newGroupJoinOption;
      }
      try {
        const res = await common_vendor.index.$chat.createGroup(options);
        common_vendor.index.hideLoading();
        common_vendor.index.showToast({ title: "群聊创建成功", icon: "success" });
        ui.showCreateModal = false;
        ui.newGroupName = "";
        ui.newGroupMembers = "";
        ui.newGroupNotification = "";
        ui.newGroupIntro = "";
        openChat(`GROUP${res.data.group.groupID}`, res.data.group.name);
      } catch (error) {
        common_vendor.index.hideLoading();
        console.error("创建群聊失败", error);
        common_vendor.index.showToast({ title: "创建失败", icon: "none" });
      }
    };
    const joinGroup = async (groupID) => {
      common_vendor.index.showLoading({ title: "申请加入..." });
      try {
        await common_vendor.index.$chat.joinGroup({ groupID, type: common_vendor.TencentCloudChat.TYPES.GRP_PUBLIC });
        common_vendor.index.hideLoading();
        common_vendor.index.showToast({ title: "加入成功", icon: "success" });
        openChat(`GROUP${groupID}`, ui.searchResult.name);
      } catch (error) {
        common_vendor.index.hideLoading();
        if (error.code === 10013) {
          openChat(`GROUP${groupID}`, ui.searchResult.name);
        } else {
          common_vendor.index.showToast({ title: "加入失败", icon: "none" });
        }
      }
    };
    const openGroupPanel = async () => {
      ui.showGroupPanel = true;
      group.panelTab = "profile";
      group.selectedMember = null;
      group.apps = [];
      await fetchGroupProfile();
      fetchGroupMembers(false);
      if (isGroupOwner.value || isGroupAdmin.value)
        fetchGroupApps();
    };
    const closeGroupPanel = () => {
      ui.showGroupPanel = false;
      group.selectedMember = null;
    };
    const switchGroupTab = (tab) => {
      group.panelTab = tab;
      if (tab === "members" && group.memberList.length === 0)
        fetchGroupMembers(false);
      if (tab === "apply" && group.apps.length === 0)
        fetchGroupApps();
    };
    const fetchGroupProfile = async () => {
      var _a, _b, _c, _d;
      const gid = ((_a = group.profile) == null ? void 0 : _a.groupID) || chat.currentConvId.replace("GROUP", "");
      try {
        const res = await common_vendor.index.$chat.getGroupProfile({ groupID: gid });
        group.profile = ((_b = res.data) == null ? void 0 : _b.group) || res.data;
        group.memberCount = ((_c = group.profile) == null ? void 0 : _c.memberCount) || group.memberCount || 0;
        if (isCurrentGroup.value) {
          chat.currentTargetName = ((_d = group.profile) == null ? void 0 : _d.name) || chat.currentTargetName;
        }
      } catch (error) {
        console.error("获取群资料失败", error);
      }
    };
    const fetchGroupMembers = async (loadMore = false) => {
      var _a, _b, _c;
      const gid = ((_a = group.profile) == null ? void 0 : _a.groupID) || chat.currentConvId.replace("GROUP", "");
      group.loadingMembers = true;
      try {
        if (!group.profile)
          await fetchGroupProfile();
        const offset = loadMore ? group.memberOffset : 0;
        const res = await common_vendor.index.$chat.getGroupMemberList({ groupID: gid, count: 50, offset });
        const list = ((_b = res.data) == null ? void 0 : _b.memberList) || [];
        group.memberList = loadMore ? group.memberList.concat(list) : list;
        group.memberOffset = offset + list.length;
        if ((_c = res.data) == null ? void 0 : _c.memberCount)
          group.memberCount = res.data.memberCount;
      } catch (error) {
        console.error("获取群成员失败", error);
      } finally {
        group.loadingMembers = false;
      }
    };
    const loadMoreMembers = () => fetchGroupMembers(true);
    const fetchGroupApps = async () => {
      var _a, _b;
      try {
        const res = await common_vendor.index.$chat.getGroupApplicationList();
        const list = ((_a = res.data) == null ? void 0 : _a.groupApplicationList) || [];
        const gid = ((_b = group.profile) == null ? void 0 : _b.groupID) || chat.currentConvId.replace("GROUP", "");
        group.apps = list.filter((a) => a.groupID === gid);
      } catch (error) {
        console.error("获取入群申请失败", error);
      }
    };
    const refreshGroupData = () => {
      fetchGroupProfile();
      fetchGroupMembers(false);
    };
    const selectMember = (m) => {
      group.selectedMember = m;
    };
    const closeMemberPanel = () => {
      group.selectedMember = null;
    };
    const inviteMemberById = async () => {
      var _a;
      const id = ui.inviteMemberId.trim();
      if (!id)
        return common_vendor.index.showToast({ title: "请输入 UserId", icon: "none" });
      const gid = ((_a = group.profile) == null ? void 0 : _a.groupID) || chat.currentConvId.replace("GROUP", "");
      try {
        common_vendor.index.showLoading({ title: "邀请中..." });
        await common_vendor.index.$chat.addGroupMember({ groupID: gid, userIDList: [id] });
        common_vendor.index.hideLoading();
        ui.inviteMemberId = "";
        common_vendor.index.showToast({ title: "邀请成功", icon: "success" });
        refreshGroupData();
      } catch (error) {
        common_vendor.index.hideLoading();
        common_vendor.index.showToast({ title: error.code === 10013 ? "该用户已在群内" : "邀请失败", icon: "none" });
      }
    };
    const editGroupName = () => {
      var _a;
      common_vendor.index.showModal({
        title: "修改群名称",
        content: ((_a = group.profile) == null ? void 0 : _a.name) || "",
        editable: true,
        placeholderText: "请输入新的群名称",
        success: async (res) => {
          var _a2;
          if (!res.confirm || !((_a2 = res.content) == null ? void 0 : _a2.trim()))
            return;
          try {
            common_vendor.index.showLoading({ title: "保存中..." });
            await common_vendor.index.$chat.updateGroupProfile({ groupID: group.profile.groupID, name: res.content.trim() });
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "已修改", icon: "success" });
            chat.currentTargetName = res.content.trim();
            refreshGroupData();
          } catch (e) {
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "修改失败", icon: "none" });
          }
        }
      });
    };
    const editGroupNotification = () => {
      var _a;
      common_vendor.index.showModal({
        title: "编辑群公告",
        content: ((_a = group.profile) == null ? void 0 : _a.notification) || "",
        editable: true,
        placeholderText: "输入新的群公告",
        success: async (res) => {
          if (!res.confirm)
            return;
          try {
            common_vendor.index.showLoading({ title: "保存中..." });
            await common_vendor.index.$chat.updateGroupProfile({ groupID: group.profile.groupID, notification: (res.content || "").trim() });
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "已发布", icon: "success" });
            refreshGroupData();
          } catch (e) {
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "发布失败", icon: "none" });
          }
        }
      });
    };
    const editGroupIntroduction = () => {
      var _a;
      common_vendor.index.showModal({
        title: "编辑群简介",
        content: ((_a = group.profile) == null ? void 0 : _a.introduction) || "",
        editable: true,
        placeholderText: "输入新的群简介",
        success: async (res) => {
          if (!res.confirm)
            return;
          try {
            common_vendor.index.showLoading({ title: "保存中..." });
            await common_vendor.index.$chat.updateGroupProfile({ groupID: group.profile.groupID, introduction: (res.content || "").trim() });
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "已修改", icon: "success" });
            refreshGroupData();
          } catch (e) {
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "修改失败", icon: "none" });
          }
        }
      });
    };
    const toggleMuteAll = async (e) => {
      const value = !!e.detail.value;
      try {
        common_vendor.index.showLoading({ title: "设置中..." });
        await common_vendor.index.$chat.updateGroupProfile({ groupID: group.profile.groupID, muteAllMembers: value });
        common_vendor.index.hideLoading();
        common_vendor.index.showToast({ title: value ? "已全员禁言" : "已解除全员禁言", icon: "none" });
        group.profile.muteAllMembers = value;
      } catch (err) {
        common_vendor.index.hideLoading();
        common_vendor.index.showToast({ title: "设置失败", icon: "none" });
      }
    };
    const editMyNameCard = () => {
      common_vendor.index.showModal({
        title: "修改我的群名片",
        content: myNameCard.value || "",
        editable: true,
        placeholderText: "输入我的群内名片",
        success: async (res) => {
          if (!res.confirm)
            return;
          try {
            common_vendor.index.showLoading({ title: "保存中..." });
            await common_vendor.index.$chat.setGroupMemberNameCard({ groupID: group.profile.groupID, nameCard: (res.content || "").trim() });
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "已修改", icon: "success" });
            fetchGroupProfile();
          } catch (err) {
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "修改失败", icon: "none" });
          }
        }
      });
    };
    const editMemberNameCard = (m) => {
      common_vendor.index.showModal({
        title: "修改群名片",
        content: m.nameCard || "",
        editable: true,
        placeholderText: "输入该成员的群内名片",
        success: async (res) => {
          if (!res.confirm)
            return;
          try {
            common_vendor.index.showLoading({ title: "保存中..." });
            await common_vendor.index.$chat.setGroupMemberNameCard({ groupID: group.profile.groupID, userID: m.userID, nameCard: (res.content || "").trim() });
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "已修改", icon: "success" });
            refreshGroupData();
          } catch (err) {
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "修改失败", icon: "none" });
          }
        }
      });
    };
    const promoteToAdmin = (m) => {
      common_vendor.index.showModal({
        title: "设为管理员",
        content: `确定将 ${memberName(m)} 设为群管理员吗？`,
        success: async (res) => {
          if (!res.confirm)
            return;
          try {
            common_vendor.index.showLoading();
            await common_vendor.index.$chat.setGroupMemberRole({ groupID: group.profile.groupID, userID: m.userID, role: TYPES.GRP_MBR_ROLE_ADMIN });
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "已设为管理员", icon: "success" });
            refreshGroupData();
          } catch (err) {
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "操作失败", icon: "none" });
          }
        }
      });
    };
    const demoteFromAdmin = (m) => {
      common_vendor.index.showModal({
        title: "取消管理员",
        content: `确定取消 ${memberName(m)} 的管理员身份吗？`,
        success: async (res) => {
          if (!res.confirm)
            return;
          try {
            common_vendor.index.showLoading();
            await common_vendor.index.$chat.setGroupMemberRole({ groupID: group.profile.groupID, userID: m.userID, role: TYPES.GRP_MBR_ROLE_MEMBER });
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "已取消管理员", icon: "success" });
            refreshGroupData();
          } catch (err) {
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "操作失败", icon: "none" });
          }
        }
      });
    };
    const muteMember = (m) => {
      common_vendor.index.showActionSheet({
        itemList: ["禁言 10 分钟", "禁言 1 小时", "禁言 24 小时"],
        success: async (res) => {
          const seconds = [600, 3600, 86400][res.tapIndex];
          try {
            common_vendor.index.showLoading({ title: "禁言中..." });
            await common_vendor.index.$chat.setGroupMemberMuteTime({ groupID: group.profile.groupID, userID: m.userID, muteTime: seconds });
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "已禁言", icon: "success" });
            refreshGroupData();
          } catch (err) {
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "禁言失败", icon: "none" });
          }
        }
      });
    };
    const unmuteMember = async (m) => {
      try {
        common_vendor.index.showLoading({ title: "操作中..." });
        await common_vendor.index.$chat.setGroupMemberMuteTime({ groupID: group.profile.groupID, userID: m.userID, muteTime: 0 });
        common_vendor.index.hideLoading();
        common_vendor.index.showToast({ title: "已解除禁言", icon: "success" });
        refreshGroupData();
      } catch (err) {
        common_vendor.index.hideLoading();
        common_vendor.index.showToast({ title: "操作失败", icon: "none" });
      }
    };
    const removeMember = (m) => {
      common_vendor.index.showModal({
        title: "移出群聊",
        content: `确定将 ${memberName(m)} 移出群聊吗？`,
        success: async (res) => {
          if (!res.confirm)
            return;
          try {
            common_vendor.index.showLoading({ title: "移出中..." });
            await common_vendor.index.$chat.deleteGroupMember({ groupID: group.profile.groupID, userIDList: [m.userID] });
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "已移出", icon: "success" });
            closeMemberPanel();
            refreshGroupData();
          } catch (err) {
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "操作失败", icon: "none" });
          }
        }
      });
    };
    const transferOwner = (m) => {
      common_vendor.index.showModal({
        title: "转让群主",
        content: `确定将群主转让给 ${memberName(m)} 吗？转让后你将自动成为普通成员。`,
        success: async (res) => {
          if (!res.confirm)
            return;
          try {
            common_vendor.index.showLoading();
            await common_vendor.index.$chat.changeGroupOwner({ groupID: group.profile.groupID, newOwnerID: m.userID });
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "群主已转让", icon: "success" });
            closeMemberPanel();
            refreshGroupData();
          } catch (err) {
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "操作失败", icon: "none" });
          }
        }
      });
    };
    const dismissGroup = () => {
      common_vendor.index.showModal({
        title: "解散群聊",
        content: "解散后群聊及聊天记录将永久删除，且无法恢复。确定解散吗？",
        confirmColor: "#ff4d4f",
        success: async (res) => {
          var _a;
          if (!res.confirm)
            return;
          try {
            common_vendor.index.showLoading();
            await common_vendor.index.$chat.dismissGroup(((_a = group.profile) == null ? void 0 : _a.groupID) || chat.currentConvId.replace("GROUP", ""));
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "群聊已解散", icon: "success" });
            closeGroupPanel();
            backToList();
          } catch (err) {
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({ title: "解散失败", icon: "none" });
          }
        }
      });
    };
    const quitGroup = () => {
      closeGroupPanel();
      common_vendor.index.showModal({
        title: "退出群聊",
        content: "确定要退出该群聊吗？退出后需重新加入才能发言。",
        success: async (res) => {
          var _a;
          if (res.confirm) {
            try {
              common_vendor.index.showLoading();
              await common_vendor.index.$chat.quitGroup(((_a = group.profile) == null ? void 0 : _a.groupID) || chat.currentConvId.replace("GROUP", ""));
              common_vendor.index.hideLoading();
              common_vendor.index.showToast({ title: "已退出群聊", icon: "success" });
              backToList();
            } catch (error) {
              common_vendor.index.hideLoading();
              common_vendor.index.showToast({ title: "退出失败", icon: "none" });
            }
          }
        }
      });
    };
    const handleGroupApp = async (app, accept) => {
      try {
        common_vendor.index.showLoading({ title: "处理中..." });
        await common_vendor.index.$chat.handleGroupApplication({
          handleAction: accept ? "Agree" : "Reject",
          application: app
        });
        common_vendor.index.hideLoading();
        common_vendor.index.showToast({ title: accept ? "已同意" : "已拒绝", icon: "success" });
        fetchGroupApps();
        if (accept)
          fetchGroupMembers(false);
      } catch (error) {
        common_vendor.index.hideLoading();
        common_vendor.index.showToast({ title: "处理失败", icon: "none" });
      }
    };
    const memberName = (m) => (m == null ? void 0 : m.nameCard) || (m == null ? void 0 : m.nick) || (m == null ? void 0 : m.userID) || "未知";
    const memberRoleLabel = (role) => role === "Owner" ? "群主" : role === "Admin" ? "管理员" : "成员";
    const groupTypeLabel = (type) => ({
      [TYPES.GRP_WORK]: "私有群",
      [TYPES.GRP_PUBLIC]: "公开群",
      [TYPES.GRP_MEETING]: "聊天室",
      [TYPES.GRP_AVCHATROOM]: "音视频聊天室",
      [TYPES.GRP_COMMUNITY]: "社区"
    })[type] || "未知";
    const joinOptionLabel = (v) => ({
      [TYPES.JOIN_OPTIONS_FREE_ACCESS]: "自由加入",
      [TYPES.JOIN_OPTIONS_NEED_PERMISSION]: "需管理员验证",
      [TYPES.JOIN_OPTIONS_DISABLE_APPLY]: "禁止申请"
    })[v] || "未知";
    const isMemberMuted = (m) => ((m == null ? void 0 : m.muteUntil) || 0) * 1e3 > Date.now();
    const canManageMember = (m) => {
      if (!m || m.userID === myUserID)
        return false;
      if (isGroupOwner.value)
        return true;
      if (isGroupAdmin.value && m.role === "Member")
        return true;
      return false;
    };
    const appIsUnhandled = (app) => (app == null ? void 0 : app.handleResult) === "UnHandled" || !(app == null ? void 0 : app.handleResult);
    const handleResultLabel = (v) => v === "Agree" ? "已同意" : v === "Reject" ? "已拒绝" : "未处理";
    const formatFullTime = (ts) => {
      if (!ts)
        return "";
      const ms = typeof ts === "number" || /^\d+$/.test(ts) ? Number(ts) * 1e3 : ts;
      const d = new Date(ms);
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };
    const copyText = (text) => {
      if (!text)
        return;
      common_vendor.index.setClipboardData({ data: String(text), success: () => common_vendor.index.showToast({ title: "已复制", icon: "none" }) });
    };
    const groupTipText = (msg) => {
      const p = msg.payload || {};
      const op = p.operationType;
      const opName = p.operatorID || "系统";
      const list = (p.userIDList || []).join("、");
      switch (op) {
        case 1:
          return `${opName} 邀请 ${list || "成员"} 加入了群聊`;
        case 2:
          return `${opName} 退出了群聊`;
        case 3:
          return `${opName} 将 ${list} 移出了群聊`;
        case 4:
          return `${opName} 将 ${list} 设为管理员`;
        case 5:
          return `${opName} 取消了 ${list} 的管理员`;
        case 6:
          return `${opName} 修改了群资料`;
        case 7:
          return `${opName} 更新了群成员资料`;
        case 10:
          return `${list} 已被禁言`;
        case 11:
          return `${list} 已被解除禁言`;
        default:
          return msg.messageForShow || "群消息";
      }
    };
    const openChat = async (convId, targetName) => {
      chat.currentConvId = convId;
      chat.currentTargetName = targetName;
      chat.messageList = [];
      ui.currentView = "chat";
      try {
        const res = await common_vendor.index.$chat.getMessageList({ conversationID: chat.currentConvId, count: 20 });
        chat.messageList = res.data.messageList;
        scrollToBottom();
        await common_vendor.index.$chat.setMessageRead({ conversationID: chat.currentConvId });
      } catch (error) {
        console.error("拉取记录失败", error);
      }
      if (isCurrentGroup.value) {
        group.profile = null;
        group.memberList = [];
        fetchGroupProfile();
      }
    };
    const backToList = () => {
      ui.currentView = "list";
      chat.currentConvId = "";
      clearSearch();
      fetchConversationList();
    };
    const sendMessage = async () => {
      if (!chat.inputText.trim() || !chat.currentConvId)
        return;
      const targetId = chat.currentConvId.replace(isCurrentGroup.value ? "GROUP" : "C2C", "");
      try {
        const message = common_vendor.index.$chat.createTextMessage({
          to: targetId,
          conversationType: isCurrentGroup.value ? common_vendor.TencentCloudChat.TYPES.CONV_GROUP : common_vendor.TencentCloudChat.TYPES.CONV_C2C,
          payload: { text: chat.inputText }
        });
        chat.messageList.push(message);
        chat.inputText = "";
        scrollToBottom();
        await common_vendor.index.$chat.sendMessage(message);
      } catch (error) {
        common_vendor.index.showToast({ title: "发送失败", icon: "none" });
      }
    };
    const onMessageReceived = (event) => {
      event.data.forEach((msg) => {
        if (msg.conversationID === chat.currentConvId) {
          chat.messageList.push(msg);
          scrollToBottom();
          common_vendor.index.$chat.setMessageRead({ conversationID: chat.currentConvId });
        }
      });
    };
    const chooseAndSendImage = () => {
      if (!chat.currentConvId)
        return;
      common_vendor.index.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        sourceType: ["album", "camera"],
        success: async (res) => {
          const targetId = chat.currentConvId.replace(isCurrentGroup.value ? "GROUP" : "C2C", "");
          try {
            const message = common_vendor.index.$chat.createImageMessage({
              to: targetId,
              conversationType: isCurrentGroup.value ? common_vendor.TencentCloudChat.TYPES.CONV_GROUP : common_vendor.TencentCloudChat.TYPES.CONV_C2C,
              payload: { file: res },
              onProgress: (event) => console.log("图片上传中", event)
            });
            chat.messageList.push(message);
            scrollToBottom();
            await common_vendor.index.$chat.sendMessage(message);
          } catch (error) {
            console.error("图片发送失败", error);
            common_vendor.index.showToast({ title: "图片发送失败", icon: "none" });
          }
        }
      });
    };
    const getImageUrl = (msg) => {
      var _a, _b, _c, _d, _e;
      const list = (_a = msg.payload) == null ? void 0 : _a.imageInfoArray;
      if (Array.isArray(list) && list.length) {
        const last = list[list.length - 1];
        if ((last == null ? void 0 : last.url) || (last == null ? void 0 : last.tempUrl))
          return last.url || last.tempUrl;
      }
      return ((_b = msg.payload) == null ? void 0 : _b.imageUrl) || ((_c = msg.payload) == null ? void 0 : _c.tempImageUrl) || ((_e = (_d = msg.payload) == null ? void 0 : _d.file) == null ? void 0 : _e.url) || "";
    };
    const previewImage = (msg) => {
      const url = getImageUrl(msg);
      if (url)
        common_vendor.index.previewImage({ urls: [url], current: url });
    };
    const toggleRecording = () => {
      if (ui.isRecording) {
        recorderManager.stop();
        return;
      }
      if (!chat.currentConvId)
        return;
      ui.isRecording = true;
      ui.recordSeconds = 0;
      recorderTimer = setInterval(() => {
        ui.recordSeconds++;
      }, 1e3);
      recorderManager.start({ duration: 6e4, format: "aac" });
    };
    recorderManager.onStop((res) => {
      ui.isRecording = false;
      clearRecorderTimer();
      if (res && res.tempFilePath) {
        sendAudioMessage(res);
      } else {
        common_vendor.index.showToast({ title: "录音已取消", icon: "none" });
      }
    });
    recorderManager.onError(() => {
      ui.isRecording = false;
      clearRecorderTimer();
      common_vendor.index.showToast({ title: "录音失败", icon: "none" });
    });
    const sendAudioMessage = async (res) => {
      if (!chat.currentConvId)
        return;
      const targetId = chat.currentConvId.replace(isCurrentGroup.value ? "GROUP" : "C2C", "");
      try {
        const message = common_vendor.index.$chat.createAudioMessage({
          to: targetId,
          conversationType: isCurrentGroup.value ? common_vendor.TencentCloudChat.TYPES.CONV_GROUP : common_vendor.TencentCloudChat.TYPES.CONV_C2C,
          payload: { file: res },
          // 官方：传 recorder onStop 回调对象
          onProgress: (event) => console.log("语音上传中", event)
        });
        message.payload.duration = Math.max(1, Math.round(res.duration / 1e3));
        chat.messageList.push(message);
        scrollToBottom();
        await common_vendor.index.$chat.sendMessage(message);
      } catch (error) {
        console.error("语音发送失败", error);
        common_vendor.index.showToast({ title: "语音发送失败", icon: "none" });
      }
    };
    const soundDuration = (msg) => {
      var _a, _b;
      return ((_a = msg.payload) == null ? void 0 : _a.duration) || ((_b = msg.payload) == null ? void 0 : _b.second) || 0;
    };
    const getSoundUrl = (msg) => {
      var _a, _b, _c, _d, _e;
      return ((_a = msg.payload) == null ? void 0 : _a.url) || ((_b = msg.payload) == null ? void 0 : _b.remoteAudioUrl) || ((_c = msg.payload) == null ? void 0 : _c.tempUrl) || ((_e = (_d = msg.payload) == null ? void 0 : _d.file) == null ? void 0 : _e.url) || "";
    };
    const playVoice = (msg) => {
      const url = getSoundUrl(msg);
      if (!url)
        return common_vendor.index.showToast({ title: "音频暂不可用", icon: "none" });
      if (audioCtx) {
        audioCtx.destroy();
        audioCtx = null;
      }
      const ctx = common_vendor.index.createInnerAudioContext();
      audioCtx = ctx;
      ctx.autoplay = true;
      ctx.obeyMuteSwitch = false;
      ctx.onError(() => {
        common_vendor.index.showToast({ title: "播放失败", icon: "none" });
        ctx.destroy();
        audioCtx = null;
      });
      ctx.onEnded(() => {
        ctx.destroy();
        audioCtx = null;
      });
      ctx.src = url;
    };
    const scrollToBottom = () => {
      common_vendor.nextTick$1(() => {
        ui.scrollTarget = "";
        setTimeout(() => {
          ui.scrollTarget = "scroll-bottom-anchor";
        }, 50);
      });
    };
    const formatTime = (timestamp) => {
      if (!timestamp)
        return "";
      const date = new Date(timestamp * 1e3);
      return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    };
    return (_ctx, _cache) => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
      return common_vendor.e({
        a: ui.currentView === "list"
      }, ui.currentView === "list" ? common_vendor.e({
        b: ui.searchMode === "user" ? 1 : "",
        c: common_vendor.o(($event) => switchSearchMode("user")),
        d: ui.searchMode === "group" ? 1 : "",
        e: common_vendor.o(($event) => switchSearchMode("group")),
        f: common_vendor.o(($event) => ui.showCreateModal = true),
        g: ui.searchMode === "user" ? "输入 UserId" : "输入 GroupId",
        h: ui.searchKeyword,
        i: common_vendor.o(($event) => ui.searchKeyword = $event.detail.value),
        j: ui.searchKeyword
      }, ui.searchKeyword ? {
        k: common_vendor.o(clearSearch)
      } : {}, {
        l: common_vendor.o(handleSearch),
        m: ui.searchResult
      }, ui.searchResult ? common_vendor.e({
        n: common_vendor.t(ui.searchMode === "group" ? "群" : ui.searchResult.userID.charAt(0).toUpperCase()),
        o: ui.searchMode === "group" ? 1 : "",
        p: common_vendor.t(ui.searchMode === "user" ? ui.searchResult.userID : ui.searchResult.name),
        q: ui.searchMode === "group"
      }, ui.searchMode === "group" ? {
        r: common_vendor.t(ui.searchResult.groupID)
      } : {}, {
        s: ui.searchMode === "user"
      }, ui.searchMode === "user" ? {
        t: common_vendor.o(($event) => openChat(`C2C${ui.searchResult.userID}`, ui.searchResult.userID))
      } : {
        v: common_vendor.o(($event) => joinGroup(ui.searchResult.groupID))
      }) : common_vendor.e({
        w: chat.conversationList.length > 0
      }, chat.conversationList.length > 0 ? {} : {}, {
        x: common_vendor.f(chat.conversationList, (conv, k0, i0) => {
          var _a2, _b2, _c2, _d2, _e2, _f2, _g2;
          return common_vendor.e({
            a: common_vendor.t(conv.type === "GROUP" ? "群" : ((_a2 = conv.userProfile) == null ? void 0 : _a2.nick) || ((_c2 = (_b2 = conv.userProfile) == null ? void 0 : _b2.userID) == null ? void 0 : _c2.charAt(0).toUpperCase()) || "U"),
            b: conv.type === "GROUP" ? 1 : "",
            c: common_vendor.t(((_d2 = conv.userProfile) == null ? void 0 : _d2.userID) || ((_e2 = conv.groupProfile) == null ? void 0 : _e2.name) || "未知会话"),
            d: common_vendor.t(formatTime((_f2 = conv.lastMessage) == null ? void 0 : _f2.lastTime)),
            e: common_vendor.t(((_g2 = conv.lastMessage) == null ? void 0 : _g2.messageForShow) || "暂无消息"),
            f: conv.unreadCount > 0
          }, conv.unreadCount > 0 ? {
            g: common_vendor.t(conv.unreadCount)
          } : {}, {
            h: conv.conversationID,
            i: common_vendor.o(($event) => {
              var _a3, _b3;
              return openChat(conv.conversationID, ((_a3 = conv.userProfile) == null ? void 0 : _a3.userID) || ((_b3 = conv.groupProfile) == null ? void 0 : _b3.name) || "未知");
            }, conv.conversationID)
          });
        })
      })) : ui.currentView === "chat" ? common_vendor.e({
        z: common_vendor.o(backToList),
        A: common_vendor.t(chat.currentTargetName),
        B: common_vendor.unref(isCurrentGroup)
      }, common_vendor.unref(isCurrentGroup) ? {
        C: common_vendor.t(common_vendor.unref(realGroupId)),
        D: common_vendor.t(((_a = group.profile) == null ? void 0 : _a.memberCount) || group.memberCount || 0)
      } : {}, {
        E: common_vendor.unref(isCurrentGroup)
      }, common_vendor.unref(isCurrentGroup) ? {
        F: common_vendor.o(openGroupPanel)
      } : {}, {
        G: common_vendor.f(chat.messageList, (msg, k0, i0) => {
          return common_vendor.e({
            a: msg.type === common_vendor.unref(MSG_GRP_TIP)
          }, msg.type === common_vendor.unref(MSG_GRP_TIP) ? {
            b: common_vendor.t(groupTipText(msg))
          } : common_vendor.e({
            c: msg.flow === "in"
          }, msg.flow === "in" ? {
            d: common_vendor.t(msg.from.charAt(0).toUpperCase())
          } : {}, {
            e: msg.flow === "in" && common_vendor.unref(isCurrentGroup)
          }, msg.flow === "in" && common_vendor.unref(isCurrentGroup) ? {
            f: common_vendor.t(msg.from)
          } : {}, {
            g: msg.type === common_vendor.unref(MSG_TEXT)
          }, msg.type === common_vendor.unref(MSG_TEXT) ? {
            h: common_vendor.t(msg.payload.text)
          } : msg.type === common_vendor.unref(MSG_IMAGE) ? {
            j: getImageUrl(msg),
            k: common_vendor.o(($event) => previewImage(msg), msg.ID)
          } : msg.type === common_vendor.unref(MSG_SOUND) ? {
            m: common_vendor.t(soundDuration(msg)),
            n: common_vendor.o(($event) => playVoice(msg), msg.ID)
          } : {
            o: common_vendor.t(msg.payload.text || "[暂不支持的消息类型]")
          }, {
            i: msg.type === common_vendor.unref(MSG_IMAGE),
            l: msg.type === common_vendor.unref(MSG_SOUND),
            p: msg.flow === "out"
          }, msg.flow === "out" ? {} : {}), {
            q: msg.ID,
            r: "msg-" + msg.ID,
            s: common_vendor.n(msg.type === common_vendor.unref(MSG_GRP_TIP) ? "msg-tip-row" : ["msg-row", msg.flow === "out" ? "msg-out" : "msg-in"])
          });
        }),
        H: ui.scrollTarget,
        I: ui.isRecording
      }, ui.isRecording ? {
        J: common_vendor.t(ui.recordSeconds)
      } : {}, {
        K: common_vendor.o(chooseAndSendImage),
        L: ui.isRecording ? 1 : "",
        M: common_vendor.o(toggleRecording),
        N: common_vendor.o(sendMessage),
        O: chat.inputText,
        P: common_vendor.o(($event) => chat.inputText = $event.detail.value),
        Q: chat.inputText.length > 0 ? 1 : "",
        R: common_vendor.o(sendMessage)
      }) : {}, {
        y: ui.currentView === "chat",
        S: ui.showCreateModal
      }, ui.showCreateModal ? common_vendor.e({
        T: ui.newGroupName,
        U: common_vendor.o(($event) => ui.newGroupName = $event.detail.value),
        V: ui.newGroupMembers,
        W: common_vendor.o(($event) => ui.newGroupMembers = $event.detail.value),
        X: common_vendor.f(groupTypeOptions, (gt, k0, i0) => {
          return {
            a: common_vendor.t(gt.label),
            b: gt.value,
            c: ui.newGroupType === gt.value ? 1 : "",
            d: common_vendor.o(($event) => ui.newGroupType = gt.value, gt.value)
          };
        }),
        Y: ui.newGroupType === common_vendor.unref(TYPES).GRP_PUBLIC
      }, ui.newGroupType === common_vendor.unref(TYPES).GRP_PUBLIC ? {
        Z: common_vendor.f(joinOptionOptions, (jo, k0, i0) => {
          return {
            a: common_vendor.t(jo.label),
            b: jo.value,
            c: ui.newGroupJoinOption === jo.value ? 1 : "",
            d: common_vendor.o(($event) => ui.newGroupJoinOption = jo.value, jo.value)
          };
        })
      } : {}, {
        aa: ui.newGroupNotification,
        ab: common_vendor.o(($event) => ui.newGroupNotification = $event.detail.value),
        ac: ui.newGroupIntro,
        ad: common_vendor.o(($event) => ui.newGroupIntro = $event.detail.value),
        ae: common_vendor.o(($event) => ui.showCreateModal = false),
        af: common_vendor.o(createGroup),
        ag: common_vendor.o(() => {
        }),
        ah: common_vendor.o(($event) => ui.showCreateModal = false)
      }) : {}, {
        ai: ui.showGroupPanel
      }, ui.showGroupPanel ? common_vendor.e({
        aj: common_vendor.o(closeGroupPanel),
        ak: group.panelTab === "profile" ? 1 : "",
        al: common_vendor.o(($event) => switchGroupTab("profile")),
        am: common_vendor.t(group.memberCount),
        an: group.panelTab === "members" ? 1 : "",
        ao: common_vendor.o(($event) => switchGroupTab("members")),
        ap: common_vendor.unref(isGroupOwner) || common_vendor.unref(isGroupAdmin)
      }, common_vendor.unref(isGroupOwner) || common_vendor.unref(isGroupAdmin) ? {
        aq: group.panelTab === "apply" ? 1 : "",
        ar: common_vendor.o(($event) => switchGroupTab("apply"))
      } : {}, {
        as: group.panelTab === "profile"
      }, group.panelTab === "profile" ? common_vendor.e({
        at: (_b = group.profile) == null ? void 0 : _b.avatar
      }, ((_c = group.profile) == null ? void 0 : _c.avatar) ? {
        av: group.profile.avatar
      } : {}, {
        aw: common_vendor.t(((_d = group.profile) == null ? void 0 : _d.name) || chat.currentTargetName),
        ax: common_vendor.unref(isGroupOwner)
      }, common_vendor.unref(isGroupOwner) ? {
        ay: common_vendor.o(editGroupName)
      } : {}, {
        az: common_vendor.t(((_e = group.profile) == null ? void 0 : _e.groupID) || common_vendor.unref(realGroupId)),
        aA: common_vendor.o(($event) => {
          var _a2;
          return copyText(((_a2 = group.profile) == null ? void 0 : _a2.groupID) || common_vendor.unref(realGroupId));
        }),
        aB: common_vendor.t(groupTypeLabel((_f = group.profile) == null ? void 0 : _f.type)),
        aC: common_vendor.t((_g = group.profile) == null ? void 0 : _g.ownerID),
        aD: common_vendor.t(((_h = group.profile) == null ? void 0 : _h.memberCount) || group.memberCount),
        aE: common_vendor.t(formatFullTime((_i = group.profile) == null ? void 0 : _i.createTime)),
        aF: common_vendor.t(joinOptionLabel((_j = group.profile) == null ? void 0 : _j.joinOption)),
        aG: !!((_k = group.profile) == null ? void 0 : _k.muteAllMembers),
        aH: !common_vendor.unref(isGroupOwner),
        aI: common_vendor.o(toggleMuteAll),
        aJ: common_vendor.unref(isGroupOwner)
      }, common_vendor.unref(isGroupOwner) ? {
        aK: common_vendor.o(editGroupNotification)
      } : {}, {
        aL: common_vendor.t(((_l = group.profile) == null ? void 0 : _l.notification) || "暂无公告"),
        aM: common_vendor.unref(isGroupOwner)
      }, common_vendor.unref(isGroupOwner) ? {
        aN: common_vendor.o(editGroupIntroduction)
      } : {}, {
        aO: common_vendor.t(((_m = group.profile) == null ? void 0 : _m.introduction) || "暂无简介"),
        aP: common_vendor.o(editMyNameCard),
        aQ: common_vendor.t(common_vendor.unref(myNameCard) || "未设置（群内显示为昵称/ID）"),
        aR: common_vendor.unref(isGroupOwner)
      }, common_vendor.unref(isGroupOwner) ? {
        aS: common_vendor.o(dismissGroup)
      } : {}, {
        aT: common_vendor.o(quitGroup)
      }) : group.panelTab === "members" ? common_vendor.e({
        aV: common_vendor.unref(isGroupOwner) || common_vendor.unref(isGroupAdmin)
      }, common_vendor.unref(isGroupOwner) || common_vendor.unref(isGroupAdmin) ? {
        aW: ui.inviteMemberId,
        aX: common_vendor.o(($event) => ui.inviteMemberId = $event.detail.value),
        aY: common_vendor.o(inviteMemberById)
      } : {}, {
        aZ: common_vendor.f(group.memberList, (m, k0, i0) => {
          return common_vendor.e({
            a: common_vendor.t((m.nameCard || m.nick || m.userID || "U").charAt(0).toUpperCase()),
            b: common_vendor.t(memberName(m)),
            c: common_vendor.t(memberRoleLabel(m.role)),
            d: common_vendor.n((m.role || "member").toLowerCase()),
            e: common_vendor.t(m.userID),
            f: isMemberMuted(m)
          }, isMemberMuted(m) ? {} : {}, {
            g: m.userID,
            h: common_vendor.o(($event) => selectMember(m), m.userID)
          });
        }),
        ba: group.memberList.length < group.memberCount
      }, group.memberList.length < group.memberCount ? {
        bb: common_vendor.t(group.loadingMembers ? "加载中..." : "加载更多成员"),
        bc: common_vendor.o(loadMoreMembers)
      } : {}, {
        bd: !group.loadingMembers && group.memberList.length === 0
      }, !group.loadingMembers && group.memberList.length === 0 ? {} : {}) : common_vendor.e({
        be: common_vendor.f(group.apps, (app, idx, i0) => {
          return common_vendor.e({
            a: common_vendor.t((app.applicantID || app.applicant || "U").charAt(0).toUpperCase()),
            b: common_vendor.t(app.applicantID || app.applicant),
            c: common_vendor.t(appIsUnhandled(app) ? "申请加入群聊" : handleResultLabel(app.handleResult) + " · " + formatFullTime(app.handledTime)),
            d: appIsUnhandled(app)
          }, appIsUnhandled(app) ? {
            e: common_vendor.o(($event) => handleGroupApp(app, true), idx),
            f: common_vendor.o(($event) => handleGroupApp(app, false), idx)
          } : {
            g: common_vendor.t(app.handleResult === "Agree" ? "已同意" : "已拒绝")
          }, {
            h: idx
          });
        }),
        bf: group.apps.length === 0
      }, group.apps.length === 0 ? {} : {}), {
        aU: group.panelTab === "members"
      }) : {}, {
        bg: group.selectedMember
      }, group.selectedMember ? common_vendor.e({
        bh: common_vendor.o(closeMemberPanel),
        bi: common_vendor.t((group.selectedMember.nameCard || group.selectedMember.nick || group.selectedMember.userID || "U").charAt(0).toUpperCase()),
        bj: common_vendor.t(memberName(group.selectedMember)),
        bk: common_vendor.t(memberRoleLabel(group.selectedMember.role)),
        bl: common_vendor.n((group.selectedMember.role || "member").toLowerCase()),
        bm: common_vendor.t(group.selectedMember.userID),
        bn: common_vendor.t(formatFullTime(group.selectedMember.joinTime)),
        bo: common_vendor.t(isMemberMuted(group.selectedMember) ? "已禁言" : "未禁言"),
        bp: group.selectedMember.userID !== common_vendor.unref(myUserID) && (common_vendor.unref(isGroupOwner) || common_vendor.unref(isGroupAdmin))
      }, group.selectedMember.userID !== common_vendor.unref(myUserID) && (common_vendor.unref(isGroupOwner) || common_vendor.unref(isGroupAdmin)) ? {
        bq: common_vendor.o(($event) => editMemberNameCard(group.selectedMember))
      } : {}, {
        br: group.selectedMember.userID === common_vendor.unref(myUserID)
      }, group.selectedMember.userID === common_vendor.unref(myUserID) ? {
        bs: common_vendor.o(editMyNameCard)
      } : {}, {
        bt: common_vendor.unref(isGroupOwner) && group.selectedMember.role === "Member"
      }, common_vendor.unref(isGroupOwner) && group.selectedMember.role === "Member" ? {
        bv: common_vendor.o(($event) => promoteToAdmin(group.selectedMember))
      } : {}, {
        bw: common_vendor.unref(isGroupOwner) && group.selectedMember.role === "Admin"
      }, common_vendor.unref(isGroupOwner) && group.selectedMember.role === "Admin" ? {
        bx: common_vendor.o(($event) => demoteFromAdmin(group.selectedMember))
      } : {}, {
        by: canManageMember(group.selectedMember)
      }, canManageMember(group.selectedMember) ? {
        bz: common_vendor.t(isMemberMuted(group.selectedMember) ? "修改禁言时长" : "禁言该成员"),
        bA: common_vendor.o(($event) => muteMember(group.selectedMember))
      } : {}, {
        bB: canManageMember(group.selectedMember) && isMemberMuted(group.selectedMember)
      }, canManageMember(group.selectedMember) && isMemberMuted(group.selectedMember) ? {
        bC: common_vendor.o(($event) => unmuteMember(group.selectedMember))
      } : {}, {
        bD: canManageMember(group.selectedMember) && group.selectedMember.userID !== common_vendor.unref(myUserID)
      }, canManageMember(group.selectedMember) && group.selectedMember.userID !== common_vendor.unref(myUserID) ? {
        bE: common_vendor.o(($event) => removeMember(group.selectedMember))
      } : {}, {
        bF: common_vendor.unref(isGroupOwner) && group.selectedMember.userID !== common_vendor.unref(myUserID)
      }, common_vendor.unref(isGroupOwner) && group.selectedMember.userID !== common_vendor.unref(myUserID) ? {
        bG: common_vendor.o(($event) => transferOwner(group.selectedMember))
      } : {}) : {});
    };
  }
};
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-31091d1c"], ["__file", "F:/.net2026/IMTest/IMTest-VUE/pages/im/index.vue"]]);
wx.createPage(MiniProgramPage);
