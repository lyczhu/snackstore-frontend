import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Lazyload } from 'vant'
import App from './App.vue'
import router from './router'
import '@/styles/tokens.css'
import '@/styles/common.css'
// Toast/Dialog 为 JS 调用式组件，unplugin 无法探测，样式需手动引入；
// 模板内 van-* 组件的 JS 与样式均由 unplugin-vue-components 按需注入
import 'vant/es/toast/style'
import 'vant/es/dialog/style'
import { setupErrorTracking, reportError } from '@snackstore/shared'

const app = createApp(App)
const pinia = createPinia()

// 捕获 Vue 组件渲染/生命周期中的未处理错误，统一走上报通道
app.config.errorHandler = (err, instance, info) => reportError(err, { type: 'vue', info })

app.use(pinia)
app.use(router)
app.use(Lazyload) // van-image 懒加载依赖
app.mount('#app')

// 注册全局错误监听（window error / 未捕获 Promise），配合 hidden sourcemap 上报
setupErrorTracking()
