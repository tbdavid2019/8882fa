import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],  // 載入測試環境設定
    include: ['tests/**/*.test.js', 'src/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.js'],
      exclude: [
        'src/ui/**',  // 前端程式碼單獨測試
        'src/worker.js',  // Worker 入口需要整合測試
        'src/**/*.test.js'
      ]
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
