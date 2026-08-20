<template>
  <el-container class="layout">
    <!-- 桌面端可折叠侧边栏 -->
    <el-aside v-if="!isMobile" :width="collapsed ? '64px' : '220px'" class="aside">
      <div class="logo">
        <h3 v-show="!collapsed">零食商城后台</h3>
      </div>
      <el-menu
        :default-active="route.path"
        router
        :collapse="collapsed"
        background-color="#1a1a2e"
        text-color="#a0aec0"
        active-text-color="#fff"
      >
        <el-menu-item v-for="item in menus" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <!-- 移动端改用抽屉菜单 -->
    <el-drawer v-else v-model="drawerVisible" direction="ltr" :with-header="false" size="220px">
      <el-menu
        :default-active="route.path"
        router
        class="drawer-menu"
        background-color="#1a1a2e"
        text-color="#a0aec0"
        active-text-color="#fff"
        @select="drawerVisible = false"
      >
        <el-menu-item v-for="item in menus" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-drawer>
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-button
            text
            :icon="isMobile ? Expand : collapsed ? Expand : Fold"
            aria-label="切换菜单"
            @click="toggleMenu"
          />
          <span>{{ route.meta.title }}</span>
        </div>
        <div class="header-right">
          <span class="admin-name">{{ authStore.adminInfo?.nickname || '管理员' }}</span>
          <el-button text @click="handleLogout">退出登录</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
// 显式 import 的命令式组件不带样式注入：el-message-box.css 自带
// overlay 遮罩与居中规则（.is-message-box .el-overlay-message-box），缺失时
// 确认框会失去垂直居中，必须手动引入
import 'element-plus/theme-chalk/el-message-box.css'
// 图标按需引入
import {
  DataAnalysis,
  Goods,
  Menu,
  List,
  User,
  Setting,
  Expand,
  Fold
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const menus = [
  { path: '/dashboard', title: '控制台', icon: DataAnalysis },
  { path: '/product', title: '商品管理', icon: Goods },
  { path: '/category', title: '分类管理', icon: Menu },
  { path: '/order', title: '订单管理', icon: List },
  { path: '/user', title: '用户管理', icon: User },
  { path: '/settings', title: '系统设置', icon: Setting }
]

const collapsed = ref(false)
const drawerVisible = ref(false)
const isMobile = ref(false)
let mql = null

function toggleMenu() {
  if (isMobile.value) drawerVisible.value = true
  else collapsed.value = !collapsed.value
}

onMounted(() => {
  mql = window.matchMedia('(max-width: 767px)')
  isMobile.value = mql.matches
  mql.addEventListener('change', onMediaChange)
})
onBeforeUnmount(() => mql?.removeEventListener('change', onMediaChange))
function onMediaChange(e) {
  isMobile.value = e.matches
  drawerVisible.value = false
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定退出登录？', '提示')
    authStore.logout() // 统一走 store，保证状态同步
    ElMessage.success('已退出')
    router.push('/login')
  } catch (e) {
    /* cancel */
  }
}
</script>

<style lang="scss" scoped>
.layout {
  min-height: 100vh;
}

.aside {
  background: var(--brand-bg);
  transition: width 0.2s;

  .logo {
    padding: 20px;
    text-align: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
    white-space: nowrap;

    h3 {
      color: var(--text-inverse);
      font-size: 18px;
    }
  }

  :deep(.el-menu) {
    border-right: none;
  }
}

.drawer-menu {
  height: 100%;
  background: var(--brand-bg);
  border-right: none;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #eee;
  font-size: 16px;
  color: var(--text-primary);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;

  .admin-name {
    font-size: 14px;
    color: var(--text-secondary);
  }
}

.main {
  background: var(--page-bg);
}
</style>
