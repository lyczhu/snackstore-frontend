// 统一 fixed 底部操作栏（对齐 H5 components/SubmitBar.vue：只负责吸底容器，内容由页面插槽提供）。
// H5 的 aboveTabbar 开关是给 van-tabbar 让位用的；小程序原生 tabBar 在 webview 之外，
// fixed bottom:0 天然贴在 tab 栏上方，故这里不需要该开关。
Component({})
