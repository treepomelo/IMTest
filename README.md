# IMTest

腾讯云 IM 通讯 + 音视频通话测试项目。

- 后端：ASP.NET Core (net8.0) — `ImDemo.Api`，负责生成 UserSig（SecretKey 只保存在后端）
- 前端：uni-app (Vue3) — `IMTest-VUE`，微信小程序(H5 编译也可用)
- 音视频：腾讯官方 **TUICallKit Web (Vue3)** `@trtc/calls-uikit-vue`，仅在 **浏览器(H5)** 环境运行

> ⚠️ 音视频通话功能为 H5-only。微信小程序版 TUICallKit 要求**企业主体认证**的小程序（`live-pusher`/`live-player` 组件仅企业主体可用），本项目使用 H5 浏览器测试，无需企业资质。

---

## 1. 腾讯云控制台需要开通的功能

1. **即时通信 IM**
   - 创建应用，记下 `SDKAppID`。
   - 在「即时通信 IM → 功能配置」里拿到 `SDKAppSecret`（即 `SecretKey`）。
2. **实时音视频 TRTC**
   - 开通 TRTC 服务（新用户有免费额度）。
   - 控制台确认应用的音频/视频通话能力可用。
3. **权限**：TUICallKit 通过 IM 信令 + TRTC 引擎工作，两者需要同一个 `SDKAppID`。

> TUICallKit 需要账号在该 IM 应用下真实存在（至少登录过一次）。

---

## 2. SDKAppID 配置位置

| 位置 | 文件 | 说明 |
|---|---|---|
| 后端 | `appsettings.json` → `TencentIM:SdkAppId` | 生成 UserSig 用 |
| 后端 | `appsettings.json` → `TencentIM:SecretKey` | ⚠️ 仅存在于后端，绝不允许进入前端 |
| 前端 | `IMTest-VUE/pages/index/index.vue` → `SDKAppID` | IM SDK 初始化用 |

前后端 `SDKAppID` 必须一致。

---

## 3. UserSig 获取方式

后端接口（复用，未新增）：

```
GET http://<host>:<port>/api/im/get-usersig?userId=<UserID>
```

返回：

```json
{ "code": 200, "message": "success", "data": { "userId": "xxx", "userSig": "eyJ..." } }
```

前端在登录时调用该接口拿 `userSig`，用于 IM 登录与 TUICallKit 初始化。

---

## 4. 前端启动方式（H5 浏览器）

1. 用 **HBuilderX** 打开 `IMTest-VUE`。
2. 修改 `IMTest-VUE/common/config.js`：
   - 本地测试：`USE_SERVER = false`（后端跑本机时）
   - 服务器测试：`USE_SERVER = true`，host/port 指向服务器
3. 运行 → **运行到浏览器 → Chrome**。
4. 打开两个浏览器窗口/标签页，分别用两个 UserID 登录。

> TUICallKit 是浏览器组件，**不能在微信开发者工具(小程序)里运行**。

---

## 5. 后端启动方式

```bash
cd ImDemo.Api
dotnet run
```

默认监听 `http://0.0.0.0:8001`，与前端 `common/config.js` 的默认端口一致。若需改端口，修改 `Program.cs` 的 `app.Run(...)`，并同步 `common/config.js` 中的 port。

> 服务器上部署时，确认防火墙/安全组放行对应端口（HTTP）。

---

## 6. 两个账号测试 1v1 通话

准备两个账号 A、B（浏览器两个窗口分别登录）：

1. A 搜索 B 的 UserID → 点「对话」进入 A↔B 聊天页。
2. B 同理进入 A↔B 聊天页。
3. **语音**：A 点聊天页顶部 `📞` → B 收到来电 → B 点接听。
   - 双方确认能听到声音；A 点静音 → B 听不到；A 取消静音 → 恢复；任一方挂断。
4. **视频**：A 点 `📹` → B 接听。
   - 双方确认能看到对方；测开关摄像头/麦克风；任一方挂断。
5. **拒绝**：A 呼叫 → B 点拒绝 → A 侧正确结束。

> 测试时双方都要停留在聊天页（TUICallKit 通话界面挂在聊天页上）。

---

## 7. 三个账号测试群聊通话

账号 A、B、C：

1. A 创建群聊，邀请 B、C（或用已有群）。
2. A 进入该群聊天页 → 点 `📞`（或 `📹`）→ 弹窗勾选 B、C → 发起通话。
3. B、C 收到来电，接听。
4. 确认三方语音/视频正常；任一方挂断。

---

## 8. 麦克风 / 摄像头权限说明

- 浏览器首次会弹权限请求，请选择「允许」。
- **拒绝权限时不会崩溃**，TUICallKit 自带错误提示。
- 若误拒绝：Chrome 地址栏左侧图标 → 网站设置 → 重置权限后刷新。
- 建议准备两套输入/输出设备，方便同时验证 A、B 两路声音。

---

## 9. HTTPS / localhost 注意事项

- `getUserMedia`（麦克风/摄像头）**只在安全上下文可用**：`https://` 或 `localhost`。
- 本地 `localhost` 可直接用 `http://`，无 HTTPS 门槛。
- 若用局域网 IP（如 `192.168.x.x` / 公网 IP）访问 H5，**必须配置 HTTPS**，否则没有 `navigator.mediaDevices`，音视频无法启动。
- 生产部署 H5 时请使用 HTTPS。

---

## 10. 常见问题

| 问题 | 解决 |
|---|---|
| 点 📞 提示「音视频组件未就绪」 | 重新登录触发 TUICallKit 初始化；确认控制台已开通 TRTC |
| 浏览器没有声音/画面 | 检查权限是否允许；浏览器设置里确认麦克风/摄像头设备 |
| 局域网 IP 访问无 mediaDevices | 需 HTTPS（见第 9 节） |
| 编译报 `Cannot find module 'vue'` | 在 `IMTest-VUE` 下执行 `npm install vue@3` |
| 对方收不到来电 | 双方须登录同一 IM 应用、停留在聊天页；确认 IM 登录成功 |
| 想在小程序里测试音视频 | 需要企业主体小程序，改用官方小程序版 TUICallKit（本方案不适用） |

---

## 依赖清单

| 包 | 用途 |
|---|---|
| `@trtc/calls-uikit-vue` | 腾讯 TUICallKit 音视频通话 UI 与信令（Web/Vue3） |
| `@trtc/call-engine-lite-js`、`@tencentcloud/tui-core-lite`、`@tencentcloud/lite-chat` | TUICallKit 的引擎/核心依赖（随主包自动安装） |
