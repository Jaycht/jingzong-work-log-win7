/**
 * 构建前版本同步脚本
 * 从 src/version.ts 读取 APP_VERSION，同步写入 package.json
 * 确保安装包版本号与应用版本号一致
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// 从 src/version.ts 读取 APP_VERSION
const versionTs = readFileSync(resolve(ROOT, 'src', 'version.ts'), 'utf-8');
const match = versionTs.match(/export\s+const\s+APP_VERSION\s*=\s*"V([\d.]+)"/);
if (!match) {
  console.error('❌ 无法从 src/version.ts 解析 APP_VERSION');
  process.exit(1);
}
const appVersion = match[1]; // e.g. "2.6.18"

// 写入 package.json
const pkgPath = resolve(ROOT, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const oldVersion = pkg.version;

pkg.version = appVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

console.log(`✅ package.json 版本已同步：${oldVersion} → ${appVersion}`);
console.log(`ℹ️  源：src/version.ts → APP_VERSION = V${appVersion}`);
