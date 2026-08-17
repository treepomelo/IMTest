/**
 * 全局配置：切换 本地测试 / 服务器测试 只需改 USE_SERVER 一个开关
 *   USE_SERVER = true  → 使用 SERVER 配置
 *   USE_SERVER = false → 使用 LOCAL 配置
 */
const USE_SERVER = false;

const LOCAL = {
  host: '127.0.0.1',
  port: 8001,
};

const SERVER = {
  host: '111.228.39.227',
  port: 8001,
};

const cur = USE_SERVER ? SERVER : LOCAL;

export const BASE_URL = `http://${cur.host}:${cur.port}`;
