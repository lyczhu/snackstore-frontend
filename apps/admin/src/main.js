import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
// 设计令牌与全局基础样式
import '@/styles/index.css'
import { setupErrorTracking, reportError } from '@snackstore/shared'

// Element Plus 组件/样式由 vite.config.js 的 unplugin 按需引入，
// 此处不再全量注册组件、全量 CSS 与全部图标，主包体积大幅下降。
// 中文语言包通过 App.vue 中的 <el-config-provider> 注入。
const app = createApp(App)
const pinia = createPinia()

// 捕获 Vue 组件渲染/生命周期中的未处理错误，统一走上报通道
app.config.errorHandler = (err, instance, info) => reportError(err, { type: 'vue', info })

app.use(pinia)
app.use(router)
app.mount('#app')

// 注册全局错误监听（window error / 未捕获 Promise），配合 hidden sourcemap 上报
setupErrorTracking()
