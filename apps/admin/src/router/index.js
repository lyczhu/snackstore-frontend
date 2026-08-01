import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '管理员登录', requiresAuth: false }
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/views/Layout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '控制台', requiresAuth: true }
      },
      {
        path: 'product',
        name: 'ProductList',
        component: () => import('@/views/ProductList.vue'),
        meta: { title: '商品管理', requiresAuth: true }
      },
      {
        path: 'category',
        name: 'CategoryList',
        component: () => import('@/views/CategoryList.vue'),
        meta: { title: '分类管理', requiresAuth: true }
      },
      {
        path: 'order',
        name: 'OrderList',
        component: () => import('@/views/OrderList.vue'),
        meta: { title: '订单管理', requiresAuth: true }
      },
      {
        path: 'user',
        name: 'UserList',
        component: () => import('@/views/UserList.vue'),
        meta: { title: '用户管理', requiresAuth: true }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: { title: '系统设置', requiresAuth: true }
      }
    ]
  },
  {
    // 补 404 catchAll 路由
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: '页面不存在', requiresAuth: false }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 零食商城管理后台` : '零食商城管理后台'
  // 登录态统一从 Pinia auth store 读取（单一数据源），localStorage 仅作 store 的持久化层
  const authStore = useAuthStore()
  const token = authStore.token
  // 宽松角色校验（防御纵深）：仅当登录响应携带 role 字段且非 admin 时才拦截登出；
  // role 字段缺失时放行，由服务端接口 403 兜底，避免后端字段变动误伤管理员
  // 注意：后端角色枚举为大写 'ADMIN'（见 UserList 的展示逻辑），此处统一转大写比较，避免大小写误伤管理员
  const role = authStore.adminInfo?.role
  const isNonAdmin = role != null && String(role).toUpperCase() !== 'ADMIN'
  if (to.meta.requiresAuth && (!token || isNonAdmin)) {
    if (isNonAdmin) authStore.logout()
    // 未登录跳转登录页时带上目标路由，登录成功后回跳（非管理员误闯不带 redirect）
    next({ name: 'Login', query: isNonAdmin ? {} : { redirect: to.fullPath } })
  } else if (to.name === 'Login' && token) {
    // 已登录访问 /login 回跳控制台
    next({ name: 'Dashboard' })
  } else {
    next()
  }
})

export default router
