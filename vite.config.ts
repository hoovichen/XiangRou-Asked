import { defineConfig } from 'vite'

// ① 如果这是“项目页”
//   base: '/wedding-greet/'

// ② 如果这是“用户主页”或“自定义域名”
//   base: '/'

// wedding-greet/vite.config.ts

export default defineConfig(({ mode }) => ({
  base: mode === 'netlify' ? '/' : '/XiangRou-Asked/',  // 默认是 GitHub Pages
}))
