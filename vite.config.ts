import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist',
    // inlineLimit 设为无限大，确保所有资源内联
    assetsInlineLimit: 1024 * 1024,
  },
})
