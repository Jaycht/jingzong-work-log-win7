# 经侦大队工作记录管理系统

面向 Windows 桌面安装包交付的 Electron 应用，前端采用 React + TypeScript + Vite，负责经侦业务记录、统计分析、附件管理、备份恢复与报表生成。

## 技术栈

React 19、TypeScript、Vite 8、Ant Design 6、Zustand、ECharts、Electron

## 本地开发

```bash
npm install
npm run dev
npm run electron:dev
```

## 构建

```bash
npm run build
npm run electron:build
```

说明：

- `npm run build` 只构建前端资源。
- `npm run electron:build` 生成桌面安装包，并在构建前自动递增版本号。
- `npm run electron:build:dir` 生成未打包目录，便于本地验包。

## 目录结构

```text
src/                 React 页面、组件、状态与工具函数
electron/            Electron 主进程与 preload
public/              静态资源
scripts/             构建辅助脚本
build/               安装器自定义配置
.github/workflows/   CI 构建流程
```

## 交付方向

项目当前以 Windows 桌面安装程序为唯一交付形态，不再维护浏览器单文件分发方案。
