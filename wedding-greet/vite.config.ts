import { defineConfig } from 'vite'

// ① 如果这是“项目页”
//   base: '/wedding-greet/'

// ② 如果这是“用户主页”或“自定义域名”
//   base: '/'

export default defineConfig({
  base: '/wedding-greet/', // ← 按你的仓库名改；若是用户主页或自定义域名，用 '/'
})
