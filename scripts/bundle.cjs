'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'release', 'CS2 NEXUS');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist');

function copyDir(src, dest, filter = () => true) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (!filter(s, entry)) continue;
    if (entry.isDirectory()) copyDir(s, d, filter);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// Electron runtime
for (const entry of fs.readdirSync(ELECTRON, { withFileTypes: true })) {
  if (entry.name === 'resources') continue;
  const s = path.join(ELECTRON, entry.name);
  const d = path.join(DIST, entry.name);
  if (entry.isDirectory()) copyDir(s, d);
  else fs.copyFileSync(s, d);
}
fs.renameSync(path.join(DIST, 'electron.exe'), path.join(DIST, 'CS2 NEXUS.exe'));

// Application code in resources/app
const APP = path.join(DIST, 'resources', 'app');
fs.mkdirSync(APP, { recursive: true });
for (const f of ['main.js', 'preload.js', 'package.json']) fs.copyFileSync(path.join(ROOT, f), path.join(APP, f));
copyDir(path.join(ROOT, 'app'), path.join(APP, 'app'));
copyDir(path.join(ROOT, 'assets'), path.join(APP, 'assets'), (s) => !s.endsWith('make_icon.py'));
fs.mkdirSync(path.join(APP, 'scripts'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'scripts', 'hltv-demo.py'), path.join(APP, 'scripts', 'hltv-demo.py'));
copyDir(path.join(ROOT, 'vendor', 'py'), path.join(APP, 'vendor', 'py'), (s) => !s.includes('__pycache__') && !s.endsWith('.pyc'));

// Data next to the exe (portable, writable)
const DATA = path.join(DIST, 'data');
copyDir(path.join(ROOT, 'data', 'seed'), path.join(DATA, 'seed'));
fs.mkdirSync(path.join(DATA, 'app'), { recursive: true });
const settings = path.join(ROOT, 'data', 'app', 'settings.json');
if (fs.existsSync(settings)) fs.copyFileSync(settings, path.join(DATA, 'app', 'settings.json'));

fs.mkdirSync(path.join(DATA, 'demos'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'data', 'demos', 'index.json'), path.join(DATA, 'demos', 'index.json'));
for (const entry of fs.readdirSync(path.join(ROOT, 'data', 'demos'))) {
  if (entry.toLowerCase().endsWith('.dem')) {
    fs.copyFileSync(path.join(ROOT, 'data', 'demos', entry), path.join(DATA, 'demos', entry));
  }
}

fs.writeFileSync(path.join(DIST, '启动说明.txt'), [
  'CS2 NEXUS // 战术终端',
  '',
  '双击 CS2 NEXUS.exe 启动。',
  '所有数据、缓存与 Demo 都在本目录 data 文件夹，可整体移动到其他盘。',
  '',
  '实时同步',
  '- 默认每 60 秒自动拉取 5E 实时赛程/赛果，标题栏 AUTO 60s 会显示上次同步时间。',
  '- 每 15 分钟刷新双榜与战队索引；可在“终端设置”关闭实时自动同步。',
  '- 也可以点右上角“同步数据”手动全量刷新。',
  '',
  '选手档案',
  '- 打开战队档案 → 阵容，点击任意选手，或点击比赛终端里的选手行。',
  '- 可查看 Rating / ADR / KAST / KD、地图池、荣誉、最近 10 场比赛。',
  '- 平台入口：5E 精确个人主页；Steam / 完美 / HLTV 按昵称站内搜索；FACEIT 按昵称选手页。',
  '',
  '直播主播',
  '- 进行中的比赛，打开比赛终端后会出现“直播”标签。',
  '- 同时列出斗鱼 / 虎牙 / 抖音正在播该场的房间，按队名与中文别名匹配。',
  '- 虎牙标题没写队名时，会读取房间页赛事标签确认；例如 DANK1NG 会显示“赛事页确认”。',
  '- 抖音标题不一定包含对阵，未精确匹配时会标注“CS2 分区在播”。',
  '- 数据缓存 45 秒，可点“刷新主播”手动更新。',
  '',
  'Major 作业',
  '- 赛事开始前 7 天开放；左侧导航进入“Major 作业”。',
  '- 第一阶段 / 第二阶段 / 第三阶段：各选 7 支晋级 + 2 支 0-3。',
  '- 最终阶段：选 2 支将进入决赛的战队。',
  '- 点空框或点战队按钮入位；选满后点“锁定作业”，锁定后只读。',
  '- 结果按已结束比赛自动判定；底部按 1-0 / 0-1 / 2-0 / 0-2 / 1-1 / 1-2 / 2-1 / 3-0 / 3-1 / 3-2 / 2-2 / 2-3 / 1-3 / 0-3 分组。',
  '- 选择和锁定状态保存在 data/app/major-picks.json。',
  '',
  'Demo 与 CS2',
  '- Demo 下载不需要人机验证：程序用本地 Python 指纹链路解析 HLTV 页面并直连 R2。',
  '- 需要系统已安装 Python 3.13（PATH 中可找到 python）；依赖已内置，不联网安装。',
  '- 下载后自动用 WinRAR 解压，复制 .dem 到 CS2 目录并启动 +playdemo。',
  '- CS2 安装目录可在“终端设置”中重新检测。',
  '',
  '注意',
  '- 完美世界 PVP 公开站未提供职业战队赛事 API，职业赛事/战队数据以 5E + HLTV 为主。',
  '- 直播平台没有公开的赛事-房间映射，只能按标题/队名/房间页标签匹配，平台改版时可能临时不可用。',
  '- Major 后续阶段在上一阶段结束前会显示“等待战队确认”；5E 返回 TBD 时不会用猜测战队填充。',
].join('\r\n'), 'utf8');
if (fs.existsSync(path.join(ROOT, 'README.md'))) fs.copyFileSync(path.join(ROOT, 'README.md'), path.join(DIST, 'README.md'));

console.log('PORTABLE:', DIST);
