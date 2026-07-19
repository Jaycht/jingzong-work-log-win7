import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { APP_VERSION } from './src/version'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'inject-version',
      transformIndexHtml(html) {
        return html.replace(/%APP_VERSION%/g, APP_VERSION);
      },
    },
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    // Win7 版运行在 Electron 22（Chromium 108），必须显式降级构建目标，
    // 否则默认 esnext 输出（可选链/空值合并等语法虽支持，但部分新语法 Chromium 108 无法解析）会白屏。
    target: ['chrome108'],
    cssCodeSplit: false,
  },
})
