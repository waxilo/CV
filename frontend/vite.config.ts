import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { resolve } from 'path';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      // 前后端共享的模板 schema（纯 TS 源码，由 vite 一起编译）
      '@cv/template-schema': resolve(__dirname, '../shared/template-schema/src/index.ts'),
      '/@': resolve(__dirname, 'src'),
      '@': resolve(__dirname, 'src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    fs: {
      // 允许读取 frontend 之外的 shared 目录
      allow: [resolve(__dirname, '..')],
    },
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  // 网页部署与 Tauri 共用同一份构建产物
  build: {
    target: process.env.TAURI_ENV_PLATFORM
      ? process.env.TAURI_ENV_PLATFORM === 'windows'
        ? 'chrome105'
        : 'safari13'
      : 'es2020',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    /*
     * 用 jsdom 而不是 node：sanitizeHtml 在没有 DOMParser 的环境下会退化成
     * 正则实现，而生产环境走的是 DOM 白名单遍历。用 node 环境跑安全用例，
     * 测的就不是实际生效的那条代码路径。
     */
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts'],
  },
});
