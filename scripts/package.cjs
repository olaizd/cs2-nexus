'use strict';
const fs = require('fs');
const path = require('path');
const packager = require('electron-packager');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'release');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

(async () => {
  const appPaths = await packager({
    dir: ROOT,
    name: 'CS2 NEXUS',
    platform: 'win32',
    arch: 'x64',
    out: OUT,
    overwrite: true,
    asar: true,
    icon: path.join(ROOT, 'assets', 'icon.ico'),
    appVersion: '1.0.0',
    prune: true,
    ignore: [
      /^\/data($|\/)/,
      /^\/shots($|\/)/,
      /^\/scripts($|\/)/,
      /^\/vendor($|\/)/,
      /^\/release($|\/)/,
      /^\/\.cache($|\/)/,
      /^\/\.tmp($|\/)/,
      /^\/electron.*\.log$/,
      /^\/README\.md$/,
      /^\/assets\/make_icon\.py$/,
    ],
  });

  const dest = appPaths[0];
  const data = path.join(dest, 'data');
  fs.mkdirSync(data, { recursive: true });
  copyDir(path.join(ROOT, 'data', 'seed'), path.join(data, 'seed'));
  copyDir(path.join(ROOT, 'data', 'app'), path.join(data, 'app'));
  fs.mkdirSync(path.join(data, 'demos'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'data', 'demos', 'index.json'), path.join(data, 'demos', 'index.json'));

  for (const entry of fs.readdirSync(path.join(ROOT, 'data', 'demos'))) {
    if (entry.toLowerCase().endsWith('.dem')) {
      fs.copyFileSync(path.join(ROOT, 'data', 'demos', entry), path.join(data, 'demos', entry));
    }
  }

  fs.writeFileSync(path.join(dest, '启动说明.txt'), [
    'CS2 NEXUS // 战术终端',
    '',
    '双击 CS2 NEXUS.exe 启动。',
    '所有数据、缓存与 Demo 都在本目录 data 文件夹，可整体移动到其他盘。',
    '首次使用 HLTV Demo 下载时若弹出 Cloudflare 验证，请完成一次人机验证。',
    'CS2 安装目录可在“终端设置”中重新检测。',
  ].join('\r\n'), 'utf8');

  console.log('PACKAGED:', dest);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
