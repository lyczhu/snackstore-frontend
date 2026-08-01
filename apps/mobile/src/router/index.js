import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'
import { useUserStore } from '@/stores/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/views/Layout.vue'),
    redirect: '/home',
    children: [
      {
        path: 'home',
        name: 'Home',
        component: () => import('@/views/Home.vue'),
        meta: { title: '首页', requiresAuth: false }
      },
      {
        path: 'category',
        name: 'Category',
        component: () => import('@/views/Category.vue'),
        meta: { title: '分类', requiresAuth: false }
      },
      {
        path: 'cart',
        name: 'Cart',
        component: () => import('@/views/Cart.vue'),
        meta: { title: '购物车', requiresAuth: true }
      },
      {
        path: 'mine',
        name: 'Mine',
        component: () => import('@/views/Mine.vue'),
        meta: { title: '我的', requiresAuth: true }
      }
    ]
  },
  {
    path: '/product/:id',
    name: 'ProductDetail',
    component: () => import('@/views/ProductDetail.vue'),
    meta: { title: '商品详情', requiresAuth: false }
  },
  {
    path: '/order/confirm',
    name: 'OrderConfirm',
    component: () => import('@/views/OrderConfirm.vue'),
    meta: { title: '确认订单', requiresAuth: true }
  },
  {
    path: '/order/list',
    name: 'OrderList',
    component: () => import('@/views/OrderList.vue'),
    meta: { title: '我的订单', requiresAuth: true }
  },
  {
    path: '/order/:id',
    name: 'OrderDetail',
    component: () => import('@/views/OrderDetail.vue'),
    meta: { title: '订单详情', requiresAuth: true }
  },
  {
    path: '/address',
    name: 'AddressList',
    component: () => import('@/views/AddressList.vue'),
    meta: { title: '地址管理', requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from) => {
  document.title = to.meta.title ? `${to.meta.title} - 零食商城` : '零食商城'
  // 登录态判断统一走 Pinia（唯一数据源），不再直接读 localStorage
  const userStore = useUserStore()
  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  } else {
    return true
  }
})

// 路由切换后焦点移至页面标题，帮助读屏用户定位
router.afterEach(() => {
  nextTick(() => {
    const el =
      document.querySelector('.van-nav-bar__title') || document.querySelector('.page-main-title')
    if (el) {
      el.setAttribute('tabindex', '-1')
      el.focus({ preventScroll: true })
    }
  })
})

export default router
