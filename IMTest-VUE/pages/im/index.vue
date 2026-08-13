<template>
  <view class="app-container">
    
    <!-- ================= 视图 1：历史会话与搜索列表 ================= -->
    <view v-if="ui.currentView === 'list'" class="view-list">
      
      <!-- 顶部搜索与操作栏 -->
      <view class="top-action-bar">
        <view class="search-type-switch">
          <text :class="{ 'active': ui.searchMode === 'user' }" @click="switchSearchMode('user')">找人</text>
          <text :class="{ 'active': ui.searchMode === 'group' }" @click="switchSearchMode('group')">找群</text>
        </view>
        <button class="create-group-btn" @click="ui.showCreateModal = true">+ 创建群聊</button>
      </view>

      <view class="search-bar">
        <view class="search-input-box">
          <input class="search-input" v-model="ui.searchKeyword" :placeholder="ui.searchMode === 'user' ? '输入 UserId' : '输入 GroupId'" />
          <icon type="clear" size="16" v-if="ui.searchKeyword" @click="clearSearch" class="clear-icon" />
        </view>
        <button class="search-btn" @click="handleSearch">查找</button>
      </view>

      <!-- 搜索结果展示区 -->
      <view class="search-result-area" v-if="ui.searchResult">
        <view class="section-title">搜索结果</view>
        <view class="list-item">
          <view class="avatar" :class="{ 'group-avatar': ui.searchMode === 'group' }">
            {{ ui.searchMode === 'group' ? '群' : ui.searchResult.userID.charAt(0).toUpperCase() }}
          </view>
          <view class="info-body">
            <text class="title">{{ ui.searchMode === 'user' ? ui.searchResult.userID : ui.searchResult.name }}</text>
            <text class="sub-title" v-if="ui.searchMode === 'group'">ID: {{ ui.searchResult.groupID }}</text>
          </view>
          
          <button class="action-btn primary" v-if="ui.searchMode === 'user'" @click="openChat(`C2C${ui.searchResult.userID}`, ui.searchResult.userID)">对话</button>
          <button class="action-btn danger" v-else @click="joinGroup(ui.searchResult.groupID)">加入</button>
        </view>
      </view>

      <!-- 历史会话列表 -->
      <scroll-view scroll-y class="scroll-list" v-else>
        <view class="section-title" v-if="chat.conversationList.length > 0">近期会话</view>
        <view class="empty-tip" v-else>暂无聊天记录，请在上方搜索或创建</view>
        
        <view class="list-item" v-for="conv in chat.conversationList" :key="conv.conversationID" @click="openChat(conv.conversationID, conv.userProfile?.userID || conv.groupProfile?.name || '未知')">
          <view class="avatar" :class="{ 'group-avatar': conv.type === 'GROUP' }">
            {{ conv.type === 'GROUP' ? '群' : (conv.userProfile?.nick || conv.userProfile?.userID?.charAt(0).toUpperCase() || 'U') }}
          </view>
          <view class="info-body">
            <view class="header-row">
              <text class="title">{{ conv.userProfile?.userID || conv.groupProfile?.name || '未知会话' }}</text>
              <text class="time">{{ formatTime(conv.lastMessage?.lastTime) }}</text>
            </view>
            <view class="msg-preview">{{ conv.lastMessage?.messageForShow || '暂无消息' }}</view>
          </view>
          <view class="unread-badge" v-if="conv.unreadCount > 0">{{ conv.unreadCount }}</view>
        </view>
      </scroll-view>
    </view>

    <!-- ================= 视图 2：聊天对话框 ================= -->
    <view v-else-if="ui.currentView === 'chat'" class="view-chat">
      <!-- 顶部导航 -->
      <view class="nav-bar">
        <text class="nav-icon" @click="backToList">← 返回</text>
        <view class="nav-center">
          <text class="nav-title">{{ chat.currentTargetName }}</text>
          <text class="nav-subtitle" v-if="isCurrentGroup">(ID: {{ realGroupId }} · {{ group.profile?.memberCount || group.memberCount || 0 }}人)</text>
        </view>
        <!-- 群设置入口 -->
        <text class="nav-icon right" v-if="isCurrentGroup" @click="openGroupPanel">⚙️</text>
        <text class="nav-icon right" v-else></text>
      </view>

      <!-- 消息面板 -->
      <scroll-view scroll-y class="message-board" :scroll-into-view="ui.scrollTarget" scroll-with-animation>
        <view v-for="msg in chat.messageList" :key="msg.ID" :id="'msg-' + msg.ID"
              :class="msg.type === MSG_GRP_TIP ? 'msg-tip-row' : ['msg-row', msg.flow === 'out' ? 'msg-out' : 'msg-in']">
          <!-- 群系统提示消息 -->
          <view v-if="msg.type === MSG_GRP_TIP" class="msg-tip">{{ groupTipText(msg) }}</view>

          <template v-else>
            <view class="msg-avatar" v-if="msg.flow === 'in'">{{ msg.from.charAt(0).toUpperCase() }}</view>

            <view class="msg-content-wrapper">
              <text class="sender-name" v-if="msg.flow === 'in' && isCurrentGroup">{{ msg.from }}</text>

              <!-- 文本消息 -->
              <view class="msg-bubble" v-if="msg.type === MSG_TEXT">{{ msg.payload.text }}</view>

              <!-- 图片消息 -->
              <image v-else-if="msg.type === MSG_IMAGE" class="msg-image" :src="getImageUrl(msg)" mode="widthFix" @tap="previewImage(msg)" />

              <!-- 语音消息 -->
              <view v-else-if="msg.type === MSG_SOUND" class="msg-bubble sound-bubble" @tap="playVoice(msg)">
                <text class="sound-play-icon">▶</text>
                <text class="sound-duration">{{ soundDuration(msg) }}″</text>
              </view>

              <!-- 其他消息 -->
              <view class="msg-bubble" v-else>{{ msg.payload.text || '[暂不支持的消息类型]' }}</view>
            </view>

            <view class="msg-avatar" v-if="msg.flow === 'out'">我</view>
          </template>
        </view>
        <view id="scroll-bottom-anchor" style="height: 1px;"></view>
      </scroll-view>

      <!-- 录音状态提示条 -->
      <view class="recording-tip" v-if="ui.isRecording">🎙️ 正在录音 {{ ui.recordSeconds }}″，再次点击 🎤 结束发送</view>

      <!-- 底部输入 -->
      <view class="input-area">
        <view class="tool-btn" @click="chooseAndSendImage">🖼️</view>
        <view class="tool-btn" :class="{ 'recording': ui.isRecording }" @click="toggleRecording">🎤</view>
        <input class="chat-input" v-model="chat.inputText" placeholder="发消息..." @confirm="sendMessage" />
        <button class="send-btn" :class="{ 'active': chat.inputText.length > 0 }" @click="sendMessage">发送</button>
      </view>
    </view>

    <!-- ================= 弹窗组件 ================= -->
    
    <!-- 1. 创建群聊弹窗 -->
    <view class="modal-mask" v-if="ui.showCreateModal" @click="ui.showCreateModal = false">
      <view class="modal-content" @click.stop>
        <view class="modal-title">创建群聊</view>

        <input class="modal-input" v-model="ui.newGroupName" placeholder="群名称（必填）" />
        <input class="modal-input" v-model="ui.newGroupMembers" placeholder="邀请成员 UserId（多个用逗号分隔，选填）" />

        <view class="form-row">
          <text class="form-label">群类型</text>
          <view class="chip-row">
            <view v-for="gt in groupTypeOptions" :key="gt.value" class="chip" :class="{ 'active': ui.newGroupType === gt.value }" @click="ui.newGroupType = gt.value">{{ gt.label }}</view>
          </view>
        </view>

        <view class="form-row" v-if="ui.newGroupType === TYPES.GRP_PUBLIC">
          <text class="form-label">加群方式</text>
          <view class="chip-row">
            <view v-for="jo in joinOptionOptions" :key="jo.value" class="chip" :class="{ 'active': ui.newGroupJoinOption === jo.value }" @click="ui.newGroupJoinOption = jo.value">{{ jo.label }}</view>
          </view>
        </view>

        <textarea class="modal-textarea" v-model="ui.newGroupNotification" placeholder="群公告（选填）" />
        <textarea class="modal-textarea" v-model="ui.newGroupIntro" placeholder="群简介（选填）" />

        <view class="modal-actions">
          <button class="modal-btn cancel" @click="ui.showCreateModal = false">取消</button>
          <button class="modal-btn confirm" @click="createGroup">创建</button>
        </view>
      </view>
    </view>

    <!-- 2. 群管理面板（全屏） -->
    <view class="modal-mask" v-if="ui.showGroupPanel">
      <view class="group-panel">
        <view class="panel-header">
          <text>群聊设置</text>
          <text class="close-btn" @click="closeGroupPanel">✕</text>
        </view>

        <view class="tab-bar">
          <text :class="{ 'active': group.panelTab === 'profile' }" @click="switchGroupTab('profile')">群资料</text>
          <text :class="{ 'active': group.panelTab === 'members' }" @click="switchGroupTab('members')">成员 {{ group.memberCount }}</text>
          <text v-if="isGroupOwner || isGroupAdmin" :class="{ 'active': group.panelTab === 'apply' }" @click="switchGroupTab('apply')">入群申请</text>
        </view>

        <!-- 群资料页 -->
        <scroll-view scroll-y class="group-panel-body" v-if="group.panelTab === 'profile'">
          <view class="group-head">
            <image v-if="group.profile?.avatar" :src="group.profile.avatar" class="group-avatar-lg" />
            <view v-else class="group-avatar-lg placeholder">群</view>
            <view class="group-head-info">
              <view class="group-name-row">
                <text class="group-name">{{ group.profile?.name || chat.currentTargetName }}</text>
                <text v-if="isGroupOwner" class="edit-link" @click="editGroupName">✏️</text>
              </view>
              <text class="group-id" @click="copyText(group.profile?.groupID || realGroupId)">ID: {{ group.profile?.groupID || realGroupId }}（点击复制）</text>
            </view>
          </view>

          <view class="info-list">
            <view class="info-item"><text>群类型</text><text>{{ groupTypeLabel(group.profile?.type) }}</text></view>
            <view class="info-item"><text>群主</text><text>{{ group.profile?.ownerID }}</text></view>
            <view class="info-item"><text>成员数</text><text>{{ group.profile?.memberCount || group.memberCount }}</text></view>
            <view class="info-item"><text>创建时间</text><text>{{ formatFullTime(group.profile?.createTime) }}</text></view>
            <view class="info-item"><text>加群方式</text><text>{{ joinOptionLabel(group.profile?.joinOption) }}</text></view>
            <view class="info-item">
              <text>全员禁言</text>
              <switch :checked="!!group.profile?.muteAllMembers" :disabled="!isGroupOwner" color="#07c160" @change="toggleMuteAll" />
            </view>
          </view>

          <view class="section-block">
            <view class="section-head">
              <text>群公告</text>
              <text v-if="isGroupOwner" class="edit-link" @click="editGroupNotification">✏️ 编辑</text>
            </view>
            <text class="section-content">{{ group.profile?.notification || '暂无公告' }}</text>
          </view>
          <view class="section-block">
            <view class="section-head">
              <text>群简介</text>
              <text v-if="isGroupOwner" class="edit-link" @click="editGroupIntroduction">✏️ 编辑</text>
            </view>
            <text class="section-content">{{ group.profile?.introduction || '暂无简介' }}</text>
          </view>
          <view class="section-block">
            <view class="section-head">
              <text>我的群名片</text>
              <text class="edit-link" @click="editMyNameCard">✏️</text>
            </view>
            <text class="section-content">{{ myNameCard || '未设置（群内显示为昵称/ID）' }}</text>
          </view>

          <button v-if="isGroupOwner" class="panel-action-btn danger" @click="dismissGroup">解散该群聊</button>
          <button class="panel-action-btn danger" @click="quitGroup">退出该群聊</button>
        </scroll-view>

        <!-- 成员管理页 -->
        <scroll-view scroll-y class="group-panel-body" v-else-if="group.panelTab === 'members'">
          <view class="member-add-bar" v-if="isGroupOwner || isGroupAdmin">
            <input class="search-input" v-model="ui.inviteMemberId" placeholder="输入 UserId 邀请加入" />
            <button class="search-btn" @click="inviteMemberById">邀请</button>
          </view>

          <view class="member-item" v-for="m in group.memberList" :key="m.userID" @click="selectMember(m)">
            <view class="avatar small-avatar">{{ (m.nameCard || m.nick || m.userID || 'U').charAt(0).toUpperCase() }}</view>
            <view class="info-body">
              <view class="header-row">
                <text class="title">{{ memberName(m) }}</text>
                <text class="role-badge" :class="(m.role || 'member').toLowerCase()">{{ memberRoleLabel(m.role) }}</text>
              </view>
              <text class="sub-title">{{ m.userID }}<text v-if="isMemberMuted(m)"> · 已禁言</text></text>
            </view>
            <text class="chevron">›</text>
          </view>

          <button v-if="group.memberList.length < group.memberCount" class="load-more" @click="loadMoreMembers">{{ group.loadingMembers ? '加载中...' : '加载更多成员' }}</button>
          <view class="empty-tip" v-if="!group.loadingMembers && group.memberList.length === 0">暂无成员</view>
        </scroll-view>

        <!-- 入群申请页 -->
        <scroll-view scroll-y class="group-panel-body" v-else>
          <view class="apply-item" v-for="(app, idx) in group.apps" :key="idx">
            <view class="avatar small-avatar">{{ (app.applicantID || app.applicant || 'U').charAt(0).toUpperCase() }}</view>
            <view class="info-body">
              <text class="title">{{ app.applicantID || app.applicant }}</text>
              <text class="sub-title">{{ appIsUnhandled(app) ? '申请加入群聊' : (handleResultLabel(app.handleResult) + ' · ' + formatFullTime(app.handledTime)) }}</text>
            </view>
            <view class="apply-actions" v-if="appIsUnhandled(app)">
              <button class="action-btn primary" @click="handleGroupApp(app, true)">同意</button>
              <button class="action-btn danger" @click="handleGroupApp(app, false)">拒绝</button>
            </view>
            <text v-else class="handled-tag">{{ app.handleResult === 'Agree' ? '已同意' : '已拒绝' }}</text>
          </view>
          <view class="empty-tip" v-if="group.apps.length === 0">暂无入群申请</view>
        </scroll-view>
      </view>
    </view>

    <!-- 3. 成员管理子面板 -->
    <view class="modal-mask" v-if="group.selectedMember">
      <view class="group-panel member-panel">
        <view class="panel-header">
          <text>成员管理</text>
          <text class="close-btn" @click="closeMemberPanel">✕</text>
        </view>

        <view class="member-profile-head">
          <view class="big-avatar">{{ (group.selectedMember.nameCard || group.selectedMember.nick || group.selectedMember.userID || 'U').charAt(0).toUpperCase() }}</view>
          <text class="member-name">{{ memberName(group.selectedMember) }}</text>
          <text class="role-badge" :class="(group.selectedMember.role || 'member').toLowerCase()">{{ memberRoleLabel(group.selectedMember.role) }}</text>
        </view>

        <view class="member-info-row"><text>UserID</text><text>{{ group.selectedMember.userID }}</text></view>
        <view class="member-info-row"><text>加入时间</text><text>{{ formatFullTime(group.selectedMember.joinTime) }}</text></view>
        <view class="member-info-row"><text>禁言状态</text><text>{{ isMemberMuted(group.selectedMember) ? '已禁言' : '未禁言' }}</text></view>

        <view class="member-actions">
          <button v-if="group.selectedMember.userID !== myUserID && (isGroupOwner || isGroupAdmin)" class="panel-action-btn primary" @click="editMemberNameCard(group.selectedMember)">修改群名片</button>
          <button v-if="group.selectedMember.userID === myUserID" class="panel-action-btn primary" @click="editMyNameCard">修改我的群名片</button>
          <button v-if="isGroupOwner && group.selectedMember.role === 'Member'" class="panel-action-btn primary" @click="promoteToAdmin(group.selectedMember)">设为管理员</button>
          <button v-if="isGroupOwner && group.selectedMember.role === 'Admin'" class="panel-action-btn warn" @click="demoteFromAdmin(group.selectedMember)">取消管理员</button>
          <button v-if="canManageMember(group.selectedMember)" class="panel-action-btn primary" @click="muteMember(group.selectedMember)">{{ isMemberMuted(group.selectedMember) ? '修改禁言时长' : '禁言该成员' }}</button>
          <button v-if="canManageMember(group.selectedMember) && isMemberMuted(group.selectedMember)" class="panel-action-btn primary" @click="unmuteMember(group.selectedMember)">解除禁言</button>
          <button v-if="canManageMember(group.selectedMember) && group.selectedMember.userID !== myUserID" class="panel-action-btn danger" @click="removeMember(group.selectedMember)">移出群聊</button>
          <button v-if="isGroupOwner && group.selectedMember.userID !== myUserID" class="panel-action-btn warn" @click="transferOwner(group.selectedMember)">转让群主</button>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup>
import { reactive, computed, nextTick } from 'vue';
import { onLoad, onUnload, onShow } from '@dcloudio/uni-app';
import TencentCloudChat from '@tencentcloud/chat';

// ================= 状态管理 (采用成熟框架的模块化分组) =================
const ui = reactive({
  currentView: 'list', // 'list' | 'chat'
  searchMode: 'user',
  searchKeyword: '',
  searchResult: null,
  showCreateModal: false,
  showGroupPanel: false,
  newGroupName: '',
  newGroupMembers: '',
  newGroupNotification: '',
  newGroupIntro: '',
  newGroupType: TencentCloudChat.TYPES.GRP_PUBLIC,
  newGroupJoinOption: TencentCloudChat.TYPES.JOIN_OPTIONS_FREE_ACCESS,
  inviteMemberId: '',
  scrollTarget: '',
  isRecording: false,
  recordSeconds: 0
});

const chat = reactive({
  conversationList: [],
  currentConvId: '',
  currentTargetName: '',
  messageList: [],
  inputText: ''
});

// ================= 群管理状态 =================
const group = reactive({
  profile: null,        // 群资料
  memberList: [],       // 成员列表
  memberCount: 0,       // 成员总数
  memberOffset: 0,      // 成员分页偏移
  loadingMembers: false,
  apps: [],             // 入群申请
  panelTab: 'profile',  // 'profile' | 'members' | 'apply'
  selectedMember: null  // 选中的成员（成员管理子面板）
});

// 计算属性：当前是否为群聊环境
const isCurrentGroup = computed(() => chat.currentConvId.startsWith('GROUP'));

// 消息类型常量（模板中直接使用）
const TYPES = TencentCloudChat.TYPES;
const MSG_TEXT = TYPES.MSG_TEXT;
const MSG_IMAGE = TYPES.MSG_IMAGE;
const MSG_SOUND = TYPES.MSG_SOUND;
const MSG_GRP_TIP = TYPES.MSG_GRP_TIP;

// 群类型 / 加群方式选项（模板使用）
const groupTypeOptions = [
  { label: '公开群', value: TYPES.GRP_PUBLIC, desc: '可搜索、可自由申请加入' },
  { label: '私有群', value: TYPES.GRP_WORK, desc: '仅可邀请加入' },
  { label: '聊天室', value: TYPES.GRP_MEETING, desc: '临时会话、无人数上限' }
];
const joinOptionOptions = [
  { label: '自由加入', value: TYPES.JOIN_OPTIONS_FREE_ACCESS },
  { label: '需管理员验证', value: TYPES.JOIN_OPTIONS_NEED_PERMISSION },
  { label: '禁止申请', value: TYPES.JOIN_OPTIONS_DISABLE_APPLY }
];

// 当前登录用户
const myUserID = uni.getStorageSync('currentUserId') || '';
const isGroupOwner = computed(() => group.profile?.ownerID === myUserID);
const isGroupAdmin = computed(() => ['Owner', 'Admin'].includes(group.profile?.selfInfo?.role));
// 去掉群 ID 前缀（@TGS#）
const realGroupId = computed(() => (group.profile?.groupID || chat.currentConvId.replace('GROUP', '')).replace(/^@TGS#/, ''));
// 我的群名片
const myNameCard = computed(() => group.profile?.selfInfo?.nameCard || '');

// ================= 图片 / 语音消息基础设施 =================
let recorderTimer = null;
let audioCtx = null;
const recorderManager = uni.getRecorderManager();

const clearRecorderTimer = () => {
  if (recorderTimer) { clearInterval(recorderTimer); recorderTimer = null; }
};

// ================= 生命周期绑定 =================
onLoad(() => {
  if (!uni.$chat) {
    uni.showToast({ title: '系统实例丢失，请重新登录', icon: 'none' });
    setTimeout(() => uni.navigateBack(), 1500);
    return;
  }
  uni.$chat.on(TencentCloudChat.EVENT.MESSAGE_RECEIVED, onMessageReceived);
  uni.$chat.on(TencentCloudChat.EVENT.CONVERSATION_LIST_UPDATED, onConversationUpdated);
});

onShow(async () => {
  if (uni.$chat) fetchConversationList();
});

onUnload(() => {
  ui.isRecording = false;
  clearRecorderTimer();
  if (audioCtx) { audioCtx.destroy(); audioCtx = null; }
  if (uni.$chat) {
    uni.$chat.off(TencentCloudChat.EVENT.MESSAGE_RECEIVED, onMessageReceived);
    uni.$chat.off(TencentCloudChat.EVENT.CONVERSATION_LIST_UPDATED, onConversationUpdated);
  }
});

// ================= IM 核心业务 API =================

// 获取会话列表
const fetchConversationList = async () => {
  try {
    const res = await uni.$chat.getConversationList();
    chat.conversationList = res.data.conversationList;
  } catch (error) {
    console.error('获取会话列表失败', error);
  }
};

// 全局会话列表更新回调
const onConversationUpdated = (event) => {
  chat.conversationList = event.data;
};

// ================= 搜索与建群模块 =================
const switchSearchMode = (mode) => {
  ui.searchMode = mode;
  clearSearch();
};

const clearSearch = () => {
  ui.searchKeyword = '';
  ui.searchResult = null;
};

const handleSearch = async () => {
  if (!ui.searchKeyword.trim()) return;
  uni.showLoading({ title: '查找中...' });
  
  try {
    if (ui.searchMode === 'user') {
      const res = await uni.$chat.getUserProfile({ userIDList: [ui.searchKeyword] });
      ui.searchResult = res.data?.length > 0 ? res.data[0] : null;
    } else {
      const res = await uni.$chat.getGroupProfile({ groupID: ui.searchKeyword });
      ui.searchResult = res.data?.group ? res.data.group : null;
    }
    if (!ui.searchResult) throw new Error('Not Found');
  } catch (error) {
    ui.searchResult = null; 
    uni.showToast({ title: '目标不存在', icon: 'none' });
  } finally {
    uni.hideLoading();
  }
};

const createGroup = async () => {
  if (!ui.newGroupName.trim()) return uni.showToast({ title: '群名不能为空', icon: 'none' });
  uni.showLoading({ title: '创建中...' });

  // 解析邀请成员（逗号/空格分隔，剔除自己）
  // ⚠️ 必须转成 { userID: 'xxx' } 对象数组，SDK 才会把成员名序列化为 Member_Account；
  //    直接传字符串数组会导致服务端 JSON 解析报错 (10004: requires objectValue or nullValue)
  const memberList = ui.newGroupMembers
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter((s) => s && s !== myUserID)
    .map((userID) => ({ userID }));

  const options = {
    type: ui.newGroupType,
    name: ui.newGroupName.trim(),
    introduction: ui.newGroupIntro.trim(),
    notification: ui.newGroupNotification.trim(),
    memberList
  };
  // 仅公开群可自定义加群方式
  if (ui.newGroupType === TYPES.GRP_PUBLIC) {
    options.joinOption = ui.newGroupJoinOption;
  }

  try {
    const res = await uni.$chat.createGroup(options);

    uni.hideLoading();
    uni.showToast({ title: '群聊创建成功', icon: 'success' });
    ui.showCreateModal = false;
    ui.newGroupName = '';
    ui.newGroupMembers = '';
    ui.newGroupNotification = '';
    ui.newGroupIntro = '';

    openChat(`GROUP${res.data.group.groupID}`, res.data.group.name);
  } catch (error) {
    uni.hideLoading();
    console.error('创建群聊失败', error);
    uni.showToast({ title: '创建失败', icon: 'none' });
  }
};

const joinGroup = async (groupID) => {
  uni.showLoading({ title: '申请加入...' });
  try {
    await uni.$chat.joinGroup({ groupID: groupID, type: TencentCloudChat.TYPES.GRP_PUBLIC });
    uni.hideLoading();
    uni.showToast({ title: '加入成功', icon: 'success' });
    openChat(`GROUP${groupID}`, ui.searchResult.name);
  } catch (error) {
    uni.hideLoading();
    // 10013 错误码表示用户已在群组中
    if (error.code === 10013) {
      openChat(`GROUP${groupID}`, ui.searchResult.name);
    } else {
      uni.showToast({ title: '加入失败', icon: 'none' });
    }
  }
};

// ================= 群管理模块 =================

// 打开群管理面板：加载资料 / 成员 / 申请
const openGroupPanel = async () => {
  ui.showGroupPanel = true;
  group.panelTab = 'profile';
  group.selectedMember = null;
  group.apps = [];
  await fetchGroupProfile();
  fetchGroupMembers(false);
  if (isGroupOwner.value || isGroupAdmin.value) fetchGroupApps();
};

const closeGroupPanel = () => {
  ui.showGroupPanel = false;
  group.selectedMember = null;
};

const switchGroupTab = (tab) => {
  group.panelTab = tab;
  if (tab === 'members' && group.memberList.length === 0) fetchGroupMembers(false);
  if (tab === 'apply' && group.apps.length === 0) fetchGroupApps();
};

// 拉取群资料（getGroupProfile 会同时把群资料写入本地缓存）
const fetchGroupProfile = async () => {
  const gid = group.profile?.groupID || chat.currentConvId.replace('GROUP', '');
  try {
    const res = await uni.$chat.getGroupProfile({ groupID: gid });
    group.profile = res.data?.group || res.data;
    group.memberCount = group.profile?.memberCount || group.memberCount || 0;
    if (isCurrentGroup.value) {
      chat.currentTargetName = group.profile?.name || chat.currentTargetName;
    }
  } catch (error) {
    console.error('获取群资料失败', error);
  }
};

// 拉取群成员（分页）
const fetchGroupMembers = async (loadMore = false) => {
  const gid = group.profile?.groupID || chat.currentConvId.replace('GROUP', '');
  group.loadingMembers = true;
  try {
    if (!group.profile) await fetchGroupProfile(); // 需先本地缓存群资料
    const offset = loadMore ? group.memberOffset : 0;
    const res = await uni.$chat.getGroupMemberList({ groupID: gid, count: 50, offset });
    const list = res.data?.memberList || [];
    group.memberList = loadMore ? group.memberList.concat(list) : list;
    group.memberOffset = offset + list.length;
    if (res.data?.memberCount) group.memberCount = res.data.memberCount;
  } catch (error) {
    console.error('获取群成员失败', error);
  } finally {
    group.loadingMembers = false;
  }
};

const loadMoreMembers = () => fetchGroupMembers(true);

// 拉取入群申请（仅群主/管理员）
const fetchGroupApps = async () => {
  try {
    const res = await uni.$chat.getGroupApplicationList();
    const list = res.data?.groupApplicationList || [];
    // 只显示本群的申请
    const gid = group.profile?.groupID || chat.currentConvId.replace('GROUP', '');
    group.apps = list.filter((a) => a.groupID === gid);
  } catch (error) {
    console.error('获取入群申请失败', error);
  }
};

// 成员操作后刷新
const refreshGroupData = () => {
  fetchGroupProfile();
  fetchGroupMembers(false);
};

const selectMember = (m) => { group.selectedMember = m; };
const closeMemberPanel = () => { group.selectedMember = null; };

// 邀请成员（成员页输入框）
const inviteMemberById = async () => {
  const id = ui.inviteMemberId.trim();
  if (!id) return uni.showToast({ title: '请输入 UserId', icon: 'none' });
  const gid = group.profile?.groupID || chat.currentConvId.replace('GROUP', '');
  try {
    uni.showLoading({ title: '邀请中...' });
    await uni.$chat.addGroupMember({ groupID: gid, userIDList: [id] });
    uni.hideLoading();
    ui.inviteMemberId = '';
    uni.showToast({ title: '邀请成功', icon: 'success' });
    refreshGroupData();
  } catch (error) {
    uni.hideLoading();
    uni.showToast({ title: error.code === 10013 ? '该用户已在群内' : '邀请失败', icon: 'none' });
  }
};

// ---- 群资料编辑（仅群主） ----
const editGroupName = () => {
  uni.showModal({
    title: '修改群名称',
    content: group.profile?.name || '',
    editable: true,
    placeholderText: '请输入新的群名称',
    success: async (res) => {
      if (!res.confirm || !res.content?.trim()) return;
      try {
        uni.showLoading({ title: '保存中...' });
        await uni.$chat.updateGroupProfile({ groupID: group.profile.groupID, name: res.content.trim() });
        uni.hideLoading();
        uni.showToast({ title: '已修改', icon: 'success' });
        chat.currentTargetName = res.content.trim();
        refreshGroupData();
      } catch (e) { uni.hideLoading(); uni.showToast({ title: '修改失败', icon: 'none' }); }
    }
  });
};

const editGroupNotification = () => {
  uni.showModal({
    title: '编辑群公告',
    content: group.profile?.notification || '',
    editable: true,
    placeholderText: '输入新的群公告',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        uni.showLoading({ title: '保存中...' });
        await uni.$chat.updateGroupProfile({ groupID: group.profile.groupID, notification: (res.content || '').trim() });
        uni.hideLoading();
        uni.showToast({ title: '已发布', icon: 'success' });
        refreshGroupData();
      } catch (e) { uni.hideLoading(); uni.showToast({ title: '发布失败', icon: 'none' }); }
    }
  });
};

const editGroupIntroduction = () => {
  uni.showModal({
    title: '编辑群简介',
    content: group.profile?.introduction || '',
    editable: true,
    placeholderText: '输入新的群简介',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        uni.showLoading({ title: '保存中...' });
        await uni.$chat.updateGroupProfile({ groupID: group.profile.groupID, introduction: (res.content || '').trim() });
        uni.hideLoading();
        uni.showToast({ title: '已修改', icon: 'success' });
        refreshGroupData();
      } catch (e) { uni.hideLoading(); uni.showToast({ title: '修改失败', icon: 'none' }); }
    }
  });
};

const toggleMuteAll = async (e) => {
  const value = !!e.detail.value;
  try {
    uni.showLoading({ title: '设置中...' });
    await uni.$chat.updateGroupProfile({ groupID: group.profile.groupID, muteAllMembers: value });
    uni.hideLoading();
    uni.showToast({ title: value ? '已全员禁言' : '已解除全员禁言', icon: 'none' });
    group.profile.muteAllMembers = value;
  } catch (err) { uni.hideLoading(); uni.showToast({ title: '设置失败', icon: 'none' }); }
};

// ---- 群名片 ----
const editMyNameCard = () => {
  uni.showModal({
    title: '修改我的群名片',
    content: myNameCard.value || '',
    editable: true,
    placeholderText: '输入我的群内名片',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        uni.showLoading({ title: '保存中...' });
        await uni.$chat.setGroupMemberNameCard({ groupID: group.profile.groupID, nameCard: (res.content || '').trim() });
        uni.hideLoading();
        uni.showToast({ title: '已修改', icon: 'success' });
        fetchGroupProfile();
      } catch (err) { uni.hideLoading(); uni.showToast({ title: '修改失败', icon: 'none' }); }
    }
  });
};

const editMemberNameCard = (m) => {
  uni.showModal({
    title: '修改群名片',
    content: m.nameCard || '',
    editable: true,
    placeholderText: '输入该成员的群内名片',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        uni.showLoading({ title: '保存中...' });
        await uni.$chat.setGroupMemberNameCard({ groupID: group.profile.groupID, userID: m.userID, nameCard: (res.content || '').trim() });
        uni.hideLoading();
        uni.showToast({ title: '已修改', icon: 'success' });
        refreshGroupData();
      } catch (err) { uni.hideLoading(); uni.showToast({ title: '修改失败', icon: 'none' }); }
    }
  });
};

// ---- 成员角色管理（仅群主） ----
const promoteToAdmin = (m) => {
  uni.showModal({
    title: '设为管理员',
    content: `确定将 ${memberName(m)} 设为群管理员吗？`,
    success: async (res) => {
      if (!res.confirm) return;
      try {
        uni.showLoading();
        await uni.$chat.setGroupMemberRole({ groupID: group.profile.groupID, userID: m.userID, role: TYPES.GRP_MBR_ROLE_ADMIN });
        uni.hideLoading();
        uni.showToast({ title: '已设为管理员', icon: 'success' });
        refreshGroupData();
      } catch (err) { uni.hideLoading(); uni.showToast({ title: '操作失败', icon: 'none' }); }
    }
  });
};

const demoteFromAdmin = (m) => {
  uni.showModal({
    title: '取消管理员',
    content: `确定取消 ${memberName(m)} 的管理员身份吗？`,
    success: async (res) => {
      if (!res.confirm) return;
      try {
        uni.showLoading();
        await uni.$chat.setGroupMemberRole({ groupID: group.profile.groupID, userID: m.userID, role: TYPES.GRP_MBR_ROLE_MEMBER });
        uni.hideLoading();
        uni.showToast({ title: '已取消管理员', icon: 'success' });
        refreshGroupData();
      } catch (err) { uni.hideLoading(); uni.showToast({ title: '操作失败', icon: 'none' }); }
    }
  });
};

// ---- 禁言管理 ----
const muteMember = (m) => {
  uni.showActionSheet({
    itemList: ['禁言 10 分钟', '禁言 1 小时', '禁言 24 小时'],
    success: async (res) => {
      const seconds = [600, 3600, 86400][res.tapIndex];
      try {
        uni.showLoading({ title: '禁言中...' });
        await uni.$chat.setGroupMemberMuteTime({ groupID: group.profile.groupID, userID: m.userID, muteTime: seconds });
        uni.hideLoading();
        uni.showToast({ title: '已禁言', icon: 'success' });
        refreshGroupData();
      } catch (err) { uni.hideLoading(); uni.showToast({ title: '禁言失败', icon: 'none' }); }
    }
  });
};

const unmuteMember = async (m) => {
  try {
    uni.showLoading({ title: '操作中...' });
    await uni.$chat.setGroupMemberMuteTime({ groupID: group.profile.groupID, userID: m.userID, muteTime: 0 });
    uni.hideLoading();
    uni.showToast({ title: '已解除禁言', icon: 'success' });
    refreshGroupData();
  } catch (err) { uni.hideLoading(); uni.showToast({ title: '操作失败', icon: 'none' }); }
};

// ---- 移除成员 / 转让群主 / 解散 / 退出 ----
const removeMember = (m) => {
  uni.showModal({
    title: '移出群聊',
    content: `确定将 ${memberName(m)} 移出群聊吗？`,
    success: async (res) => {
      if (!res.confirm) return;
      try {
        uni.showLoading({ title: '移出中...' });
        await uni.$chat.deleteGroupMember({ groupID: group.profile.groupID, userIDList: [m.userID] });
        uni.hideLoading();
        uni.showToast({ title: '已移出', icon: 'success' });
        closeMemberPanel();
        refreshGroupData();
      } catch (err) { uni.hideLoading(); uni.showToast({ title: '操作失败', icon: 'none' }); }
    }
  });
};

const transferOwner = (m) => {
  uni.showModal({
    title: '转让群主',
    content: `确定将群主转让给 ${memberName(m)} 吗？转让后你将自动成为普通成员。`,
    success: async (res) => {
      if (!res.confirm) return;
      try {
        uni.showLoading();
        await uni.$chat.changeGroupOwner({ groupID: group.profile.groupID, newOwnerID: m.userID });
        uni.hideLoading();
        uni.showToast({ title: '群主已转让', icon: 'success' });
        closeMemberPanel();
        refreshGroupData();
      } catch (err) { uni.hideLoading(); uni.showToast({ title: '操作失败', icon: 'none' }); }
    }
  });
};

const dismissGroup = () => {
  uni.showModal({
    title: '解散群聊',
    content: '解散后群聊及聊天记录将永久删除，且无法恢复。确定解散吗？',
    confirmColor: '#ff4d4f',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        uni.showLoading();
        await uni.$chat.dismissGroup(group.profile?.groupID || chat.currentConvId.replace('GROUP', ''));
        uni.hideLoading();
        uni.showToast({ title: '群聊已解散', icon: 'success' });
        closeGroupPanel();
        backToList();
      } catch (err) { uni.hideLoading(); uni.showToast({ title: '解散失败', icon: 'none' }); }
    }
  });
};

const quitGroup = () => {
  closeGroupPanel();
  uni.showModal({
    title: '退出群聊',
    content: '确定要退出该群聊吗？退出后需重新加入才能发言。',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading();
          await uni.$chat.quitGroup(group.profile?.groupID || chat.currentConvId.replace('GROUP', ''));
          uni.hideLoading();
          uni.showToast({ title: '已退出群聊', icon: 'success' });
          backToList();
        } catch (error) {
          uni.hideLoading();
          uni.showToast({ title: '退出失败', icon: 'none' });
        }
      }
    }
  });
};

// ---- 入群申请处理 ----
const handleGroupApp = async (app, accept) => {
  try {
    uni.showLoading({ title: '处理中...' });
    await uni.$chat.handleGroupApplication({
      handleAction: accept ? 'Agree' : 'Reject',
      application: app
    });
    uni.hideLoading();
    uni.showToast({ title: accept ? '已同意' : '已拒绝', icon: 'success' });
    fetchGroupApps();
    if (accept) fetchGroupMembers(false);
  } catch (error) {
    uni.hideLoading();
    uni.showToast({ title: '处理失败', icon: 'none' });
  }
};

// ---- 展示辅助 ----
const memberName = (m) => m?.nameCard || m?.nick || m?.userID || '未知';
const memberRoleLabel = (role) => role === 'Owner' ? '群主' : role === 'Admin' ? '管理员' : '成员';
const groupTypeLabel = (type) => ({
  [TYPES.GRP_WORK]: '私有群',
  [TYPES.GRP_PUBLIC]: '公开群',
  [TYPES.GRP_MEETING]: '聊天室',
  [TYPES.GRP_AVCHATROOM]: '音视频聊天室',
  [TYPES.GRP_COMMUNITY]: '社区'
}[type] || '未知');
const joinOptionLabel = (v) => ({
  [TYPES.JOIN_OPTIONS_FREE_ACCESS]: '自由加入',
  [TYPES.JOIN_OPTIONS_NEED_PERMISSION]: '需管理员验证',
  [TYPES.JOIN_OPTIONS_DISABLE_APPLY]: '禁止申请'
}[v] || '未知');
const isMemberMuted = (m) => (m?.muteUntil || 0) * 1000 > Date.now();
const canManageMember = (m) => {
  if (!m || m.userID === myUserID) return false;
  if (isGroupOwner.value) return true;             // 群主可管理所有人
  if (isGroupAdmin.value && m.role === 'Member') return true; // 管理员只能管普通成员
  return false;
};
const appIsUnhandled = (app) => app?.handleResult === 'UnHandled' || !app?.handleResult;
const handleResultLabel = (v) => v === 'Agree' ? '已同意' : v === 'Reject' ? '已拒绝' : '未处理';

const formatFullTime = (ts) => {
  if (!ts) return '';
  // 兼容：秒(数字/数字字符串) 与 毫秒(时间戳) 混用
  const ms = (typeof ts === 'number' || /^\d+$/.test(ts)) ? Number(ts) * 1000 : ts;
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const copyText = (text) => {
  if (!text) return;
  uni.setClipboardData({ data: String(text), success: () => uni.showToast({ title: '已复制', icon: 'none' }) });
};

// 群系统提示消息文案
const groupTipText = (msg) => {
  const p = msg.payload || {};
  const op = p.operationType;
  const opName = p.operatorID || '系统';
  const list = (p.userIDList || []).join('、');
  switch (op) {
    case 1: return `${opName} 邀请 ${list || '成员'} 加入了群聊`;
    case 2: return `${opName} 退出了群聊`;
    case 3: return `${opName} 将 ${list} 移出了群聊`;
    case 4: return `${opName} 将 ${list} 设为管理员`;
    case 5: return `${opName} 取消了 ${list} 的管理员`;
    case 6: return `${opName} 修改了群资料`;
    case 7: return `${opName} 更新了群成员资料`;
    case 10: return `${list} 已被禁言`;
    case 11: return `${list} 已被解除禁言`;
    default: return msg.messageForShow || '群消息';
  }
};

// ================= 聊天室通用模块 =================
const openChat = async (convId, targetName) => {
  chat.currentConvId = convId;
  chat.currentTargetName = targetName;
  chat.messageList = [];
  ui.currentView = 'chat';

  try {
    const res = await uni.$chat.getMessageList({ conversationID: chat.currentConvId, count: 20 });
    chat.messageList = res.data.messageList;
    scrollToBottom();
    await uni.$chat.setMessageRead({ conversationID: chat.currentConvId });
  } catch (error) {
    console.error('拉取记录失败', error);
  }

  // 群聊：预取群资料（成员数展示 + 本地缓存，供成员列表使用）
  if (isCurrentGroup.value) {
    group.profile = null;
    group.memberList = [];
    fetchGroupProfile();
  }
};

const backToList = () => {
  ui.currentView = 'list';
  chat.currentConvId = '';
  clearSearch(); 
  fetchConversationList(); 
};

const sendMessage = async () => {
  if (!chat.inputText.trim() || !chat.currentConvId) return;

  const targetId = chat.currentConvId.replace(isCurrentGroup.value ? 'GROUP' : 'C2C', '');

  try {
    const message = uni.$chat.createTextMessage({
      to: targetId,
      conversationType: isCurrentGroup.value ? TencentCloudChat.TYPES.CONV_GROUP : TencentCloudChat.TYPES.CONV_C2C,
      payload: { text: chat.inputText }
    });

    chat.messageList.push(message);
    chat.inputText = '';
    scrollToBottom();

    await uni.$chat.sendMessage(message);
  } catch (error) {
    uni.showToast({ title: '发送失败', icon: 'none' });
  }
};

const onMessageReceived = (event) => {
  event.data.forEach((msg) => {
    if (msg.conversationID === chat.currentConvId) {
      chat.messageList.push(msg);
      scrollToBottom();
      uni.$chat.setMessageRead({ conversationID: chat.currentConvId });
    }
  });
};

// ================= 图片消息模块 =================
const chooseAndSendImage = () => {
  if (!chat.currentConvId) return;

  // 官方文档：小程序端将 chooseImage 的 success 回调参数整体作为 payload.file
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const targetId = chat.currentConvId.replace(isCurrentGroup.value ? 'GROUP' : 'C2C', '');
      try {
        const message = uni.$chat.createImageMessage({
          to: targetId,
          conversationType: isCurrentGroup.value ? TencentCloudChat.TYPES.CONV_GROUP : TencentCloudChat.TYPES.CONV_C2C,
          payload: { file: res },
          onProgress: (event) => console.log('图片上传中', event)
        });

        chat.messageList.push(message);
        scrollToBottom();
        await uni.$chat.sendMessage(message);
      } catch (error) {
        console.error('图片发送失败', error);
        uni.showToast({ title: '图片发送失败', icon: 'none' });
      }
    }
  });
};

// 取图片展示地址：优先 COS 原图地址，未上传完成时回退本地临时路径
const getImageUrl = (msg) => {
  const list = msg.payload?.imageInfoArray;
  if (Array.isArray(list) && list.length) {
    const last = list[list.length - 1];
    if (last?.url || last?.tempUrl) return last.url || last.tempUrl;
  }
  return msg.payload?.imageUrl || msg.payload?.tempImageUrl || msg.payload?.file?.url || '';
};

// 点击图片大图预览
const previewImage = (msg) => {
  const url = getImageUrl(msg);
  if (url) uni.previewImage({ urls: [url], current: url });
};

// ================= 语音消息模块 =================
const toggleRecording = () => {
  if (ui.isRecording) {
    recorderManager.stop(); // 结束录音
    return;
  }
  if (!chat.currentConvId) return;

  ui.isRecording = true;
  ui.recordSeconds = 0;
  recorderTimer = setInterval(() => { ui.recordSeconds++; }, 1000);
  recorderManager.start({ duration: 60000, format: 'aac' });
};

recorderManager.onStop((res) => {
  ui.isRecording = false;
  clearRecorderTimer();
  if (res && res.tempFilePath) {
    sendAudioMessage(res); // res: { tempFilePath, duration(ms), fileSize }
  } else {
    uni.showToast({ title: '录音已取消', icon: 'none' });
  }
});

recorderManager.onError(() => {
  ui.isRecording = false;
  clearRecorderTimer();
  uni.showToast({ title: '录音失败', icon: 'none' });
});

const sendAudioMessage = async (res) => {
  if (!chat.currentConvId) return;
  const targetId = chat.currentConvId.replace(isCurrentGroup.value ? 'GROUP' : 'C2C', '');
  try {
    const message = uni.$chat.createAudioMessage({
      to: targetId,
      conversationType: isCurrentGroup.value ? TencentCloudChat.TYPES.CONV_GROUP : TencentCloudChat.TYPES.CONV_C2C,
      payload: { file: res }, // 官方：传 recorder onStop 回调对象
      onProgress: (event) => console.log('语音上传中', event)
    });

    // 发送方本地立即显示真实时长（onStop 的 duration 单位为毫秒）
    message.payload.duration = Math.max(1, Math.round(res.duration / 1000));

    chat.messageList.push(message);
    scrollToBottom();
    await uni.$chat.sendMessage(message);
  } catch (error) {
    console.error('语音发送失败', error);
    uni.showToast({ title: '语音发送失败', icon: 'none' });
  }
};

// 语音时长（秒），兼容收/发两种消息结构
const soundDuration = (msg) => msg.payload?.duration || msg.payload?.second || 0;

// 语音播放地址：优先云端 URL，否则本地临时路径
// 注意：SDK 发送成功后在 payload.remoteAudioUrl 更新 COS 地址，需兜底
const getSoundUrl = (msg) => msg.payload?.url || msg.payload?.remoteAudioUrl || msg.payload?.tempUrl || msg.payload?.file?.url || '';

const playVoice = (msg) => {
  const url = getSoundUrl(msg);
  if (!url) return uni.showToast({ title: '音频暂不可用', icon: 'none' });

  // 每次播放创建全新的音频上下文，避免复用旧实例导致静默失败
  if (audioCtx) { audioCtx.destroy(); audioCtx = null; }
  const ctx = uni.createInnerAudioContext();
  audioCtx = ctx;
  ctx.autoplay = true;
  ctx.obeyMuteSwitch = false;
  ctx.onError(() => {
    uni.showToast({ title: '播放失败', icon: 'none' });
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
  nextTick(() => {
    ui.scrollTarget = '';
    setTimeout(() => { ui.scrollTarget = 'scroll-bottom-anchor'; }, 50);
  });
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};
</script>

<style scoped>
/* ========== 全局架构 ========== */
.app-container { height: 100vh; display: flex; flex-direction: column; background-color: #ededed; font-family: -apple-system, sans-serif; }
.view-list, .view-chat { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* ========== 顶栏与搜素 ========== */
.top-action-bar { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: #fff; }
.search-type-switch { display: flex; background: #f0f0f0; border-radius: 16px; overflow: hidden; }
.search-type-switch text { padding: 5px 14px; font-size: 13px; color: #666; transition: background 0.2s; }
.search-type-switch text.active { background: #07c160; color: #fff; font-weight: bold; }
.create-group-btn { margin: 0; font-size: 13px; background: #007aff; color: #fff; border-radius: 16px; height: 30px; line-height: 30px; padding: 0 12px; }

.search-bar { display: flex; padding: 10px 15px; background: #fff; border-bottom: 1px solid #f5f5f5; align-items: center; }
.search-input-box { flex: 1; display: flex; align-items: center; background: #f5f5f5; border-radius: 6px; height: 36px; padding: 0 10px; }
.search-input { flex: 1; font-size: 14px; }
.search-btn { width: 65px; height: 36px; line-height: 36px; margin-left: 10px; font-size: 14px; background: #07c160; color: #fff; padding: 0; border-radius: 6px; }

/* ========== 通用列表项 (组件化CSS) ========== */
.section-title { font-size: 12px; color: #888; padding: 12px 15px 6px; }
.scroll-list { flex: 1; }
.list-item { display: flex; padding: 12px 15px; background-color: #fff; border-bottom: 1px solid #f5f5f5; align-items: center; position: relative; }
.avatar { width: 48px; height: 48px; background-color: #007aff; color: #fff; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; margin-right: 12px; }
.group-avatar { background-color: #ff9a9e; border-radius: 50%; } 
.info-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; justify-content: center; }
.header-row { display: flex; justify-content: space-between; margin-bottom: 4px; align-items: center; }
.title { font-size: 16px; color: #333; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub-title { font-size: 12px; color: #999; margin-top: 4px; }
.time { font-size: 12px; color: #b2b2b2; }
.msg-preview { font-size: 13px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.unread-badge { position: absolute; left: 50px; top: 6px; background-color: #fa5151; color: white; font-size: 11px; height: 18px; min-width: 18px; line-height: 18px; text-align: center; border-radius: 9px; padding: 0 5px; }
.action-btn { width: 60px; height: 30px; line-height: 30px; font-size: 13px; padding: 0; border-radius: 15px; margin: 0; }
.action-btn.primary { background: #07c160; color: #fff; }
.action-btn.danger { background: #ff758c; color: #fff; }
.empty-tip { text-align: center; color: #999; font-size: 14px; margin-top: 60px; }

/* ========== 聊天窗口 ========== */
.nav-bar { background: #fff; height: 44px; display: flex; justify-content: space-between; align-items: center; padding: 0 15px; border-bottom: 1px solid #eaeaea; }
.nav-icon { color: #333; font-size: 16px; width: 60px; }
.nav-icon.right { text-align: right; font-size: 20px; color: #666; }
.nav-center { flex: 1; display: flex; flex-direction: column; align-items: center; overflow: hidden; }
.nav-title { font-size: 16px; font-weight: bold; color: #333; }
.nav-subtitle { font-size: 10px; color: #888; }

.message-board { flex: 1; padding: 15px; box-sizing: border-box; }
.msg-row { display: flex; margin-bottom: 20px; align-items: flex-start; }
.msg-in { justify-content: flex-start; }
.msg-out { justify-content: flex-end; }
.msg-avatar { width: 40px; height: 40px; background-color: #ccc; color: #fff; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 16px; margin: 0 10px; }
.msg-out .msg-avatar { background-color: #007aff; }
.msg-content-wrapper { display: flex; flex-direction: column; align-items: flex-start; max-width: 65%; }
.sender-name { font-size: 11px; color: #999; margin-bottom: 4px; margin-left: 2px; }
.msg-bubble { padding: 10px 14px; border-radius: 8px; font-size: 15px; line-height: 1.5; word-break: break-all; }
.msg-in .msg-bubble { background-color: #fff; color: #333; }
.msg-out .msg-bubble { background-color: #95ec69; color: #000; }

/* 图片消息 */
.msg-image { width: 160px; border-radius: 8px; background-color: #fff; }

/* 语音消息 */
.sound-bubble { display: flex; align-items: center; min-width: 100px; cursor: pointer; }
.sound-play-icon { font-size: 13px; margin-right: 6px; color: #07c160; }
.msg-out .sound-play-icon { color: #000; }
.sound-duration { font-size: 14px; }

.recording-tip { padding: 6px 15px; background: #fff5f5; color: #ff4d4f; font-size: 13px; border-top: 1px solid #ffe0e0; }

.input-area { display: flex; padding: 10px 15px; background-color: #f7f7f7; border-top: 1px solid #d9d9d9; align-items: center; padding-bottom: calc(10px + env(safe-area-inset-bottom)); }
.tool-btn { width: 40px; height: 40px; line-height: 40px; text-align: center; font-size: 20px; margin-right: 8px; background-color: #fff; border-radius: 6px; }
.tool-btn.recording { background-color: #ff4d4f; }
.chat-input { flex: 1; background-color: #fff; height: 40px; border-radius: 6px; padding: 0 12px; font-size: 15px; }
.send-btn { margin-left: 10px; width: 65px; height: 40px; line-height: 40px; background-color: #07c160; color: #fff; font-size: 14px; border-radius: 6px; padding: 0; }

/* ========== 弹窗与动作面板 ========== */
.modal-mask { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 999; }
.modal-content { width: 80%; background: #fff; border-radius: 12px; padding: 25px 20px; box-sizing: border-box; }
.modal-title { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 20px; }
.modal-input { border: 1px solid #ddd; height: 42px; border-radius: 6px; padding: 0 10px; font-size: 15px; margin-bottom: 25px; }
.modal-actions { display: flex; justify-content: space-between; }
.modal-btn { width: 45%; height: 42px; line-height: 42px; font-size: 15px; border-radius: 6px; margin: 0; }
.modal-btn.cancel { background: #f5f5f5; color: #666; }
.modal-btn.confirm { background: #007aff; color: #fff; }

.bottom-panel { position: absolute; bottom: 0; width: 100%; background: #fff; border-radius: 16px 16px 0 0; padding-bottom: env(safe-area-inset-bottom); animation: slideUp 0.3s ease-out; }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
.panel-header { display: flex; justify-content: space-between; padding: 15px 20px; border-bottom: 1px solid #eee; font-size: 16px; font-weight: bold; }
.close-btn { color: #999; font-size: 18px; }
.panel-body { padding: 20px; }
.panel-item { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 15px; color: #333; }
.item-value { color: #888; }
.selectable { user-select: text; }
.panel-action-btn { height: 44px; line-height: 44px; font-size: 15px; border-radius: 8px; margin-bottom: 12px; }
.panel-action-btn.primary { background: #f0f8ff; color: #007aff; border: 1px solid #cce4ff; }
.panel-action-btn.danger { background: #fff1f0; color: #ff4d4f; border: 1px solid #ffa39e; }
.panel-action-btn.warn { background: #fffbe6; color: #d4a017; border: 1px solid #ffe58f; }

/* ========== 创建群弹窗 ========== */
.modal-content { max-height: 82vh; overflow-y: auto; }
.form-row { margin-bottom: 12px; }
.form-label { display: block; font-size: 13px; color: #888; margin-bottom: 8px; }
.chip-row { display: flex; flex-wrap: wrap; }
.chip { padding: 7px 14px; margin-right: 10px; margin-bottom: 6px; background: #f5f5f5; color: #666; border-radius: 16px; font-size: 13px; }
.chip.active { background: #07c160; color: #fff; font-weight: bold; }
.modal-textarea { width: 100%; height: 56px; border: 1px solid #ddd; border-radius: 6px; padding: 8px 10px; font-size: 14px; margin-bottom: 12px; box-sizing: border-box; }

/* ========== 群管理面板 ========== */
.group-mask { align-items: stretch; }
.group-panel { width: 100%; height: 100%; background: #f7f7f7; display: flex; flex-direction: column; box-sizing: border-box; }
.tab-bar { display: flex; background: #fff; border-bottom: 1px solid #eee; }
.tab-bar text { flex: 1; text-align: center; padding: 12px 0; font-size: 14px; color: #666; position: relative; }
.tab-bar text.active { color: #07c160; font-weight: bold; }
.tab-bar text.active::after { content: ''; position: absolute; left: 50%; transform: translateX(-50%); bottom: 0; width: 30px; height: 3px; background: #07c160; border-radius: 2px; }
.group-panel-body { flex: 1; padding: 15px; box-sizing: border-box; }

.group-head { display: flex; align-items: center; margin-bottom: 16px; }
.group-avatar-lg { width: 64px; height: 64px; border-radius: 12px; background-color: #ff9a9e; margin-right: 14px; }
.group-avatar-lg.placeholder { display: flex; align-items: center; justify-content: center; color: #fff; font-size: 26px; font-weight: bold; }
.group-head-info { flex: 1; overflow: hidden; }
.group-name-row { display: flex; align-items: center; margin-bottom: 4px; }
.group-name { font-size: 18px; font-weight: bold; color: #333; margin-right: 8px; }
.edit-link { color: #007aff; font-size: 13px; }
.group-id { font-size: 12px; color: #888; }
.group-id:active { color: #007aff; }

.info-list { background: #fff; border-radius: 10px; padding: 4px 14px; margin-bottom: 14px; }
.info-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; font-size: 14px; color: #333; border-bottom: 1px solid #f5f5f5; }
.info-item:last-child { border-bottom: none; }
.info-item text:first-child { color: #888; }

.section-block { background: #fff; border-radius: 10px; padding: 14px; margin-bottom: 14px; }
.section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.section-head text:first-child { font-size: 14px; font-weight: bold; color: #333; }
.section-content { font-size: 14px; color: #666; line-height: 1.6; word-break: break-all; }

/* ========== 成员列表 ========== */
.member-add-bar { display: flex; background: #fff; border-radius: 10px; padding: 8px; margin-bottom: 12px; align-items: center; }
.member-add-bar .search-input { flex: 1; height: 34px; background: #f5f5f5; border-radius: 6px; padding: 0 10px; font-size: 14px; margin-left: 0; }
.member-add-bar .search-btn { margin-left: 8px; }
.member-item { display: flex; align-items: center; background: #fff; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; }
.small-avatar { width: 40px; height: 40px; font-size: 16px; border-radius: 8px; }
.role-badge { font-size: 11px; padding: 2px 8px; border-radius: 8px; }
.role-badge.owner { background: #fff1f0; color: #ff4d4f; }
.role-badge.admin { background: #fffbe6; color: #d4a017; }
.role-badge.member { background: #f5f5f5; color: #666; }
.chevron { color: #ccc; font-size: 20px; margin-left: 8px; }
.load-more { margin: 10px auto; background: #f0f0f0; color: #666; font-size: 13px; border-radius: 16px; height: 34px; line-height: 34px; padding: 0 20px; }

/* ========== 入群申请 ========== */
.apply-item { display: flex; align-items: center; background: #fff; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; }
.apply-actions { display: flex; }
.apply-actions .action-btn { margin-left: 8px; }
.handled-tag { color: #999; font-size: 12px; }

/* ========== 成员管理子面板 ========== */
.member-panel { background: #fff; }
.member-profile-head { display: flex; flex-direction: column; align-items: center; padding: 24px 0 16px; }
.big-avatar { width: 72px; height: 72px; background: #07c160; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; font-weight: bold; margin-bottom: 10px; }
.member-name { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 8px; }
.member-info-row { display: flex; justify-content: space-between; padding: 12px 20px; font-size: 14px; color: #333; border-bottom: 1px solid #f5f5f5; }
.member-info-row text:first-child { color: #888; }
.member-actions { padding: 20px; }

/* ========== 群系统提示消息 ========== */
.msg-tip-row { justify-content: center; margin: 14px 0; }
.msg-tip { background: rgba(0, 0, 0, 0.06); color: #888; font-size: 12px; padding: 5px 12px; border-radius: 8px; max-width: 85%; text-align: center; }
</style>