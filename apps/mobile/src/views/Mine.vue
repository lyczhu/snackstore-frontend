<template>
  <div class="mine-page">
    <!-- 已登录：纯展示，不可点击 -->
    <div v-if="userStore.isLoggedIn" class="user-card">
      <van-image
        round
        width="64"
        height="64"
        :src="userStore.userInfo?.avatar"
        :alt="userStore.userInfo?.nickname || '用户头像'"
      >
        <template #error>
          <div class="avatar-fallback">
            <van-icon name="user-o" size="32" />
          </div>
        </template>
      </van-image>
      <div class="user-info">
        <h3>{{ userStore.userInfo?.nickname || '用户' }}</h3>
        <p>{{ userStore.userInfo?.phone }}</p>
      </div>
    </div>
    <!-- 未登录：导航到登录页，用语义化链接 -->
    <router-link v-else to="/login" class="user-card clickable">
      <div class="avatar-fallback avatar-placeholder">
        <van-icon name="user-o" size="32" />
      </div>
      <div class="user-info">
        <h3>点击登录</h3>
      </div>
    </router-link>

    <div class="menu-list">
      <router-link to="/order/list" class="menu-item">
        <van-icon name="orders-o" />
        <span>我的订单</span>
        <van-icon name="arrow" class="arrow" />
      </router-link>
      <router-link to="/address" class="menu-item">
        <van-icon name="location-o" />
        <span>收货地址</span>
        <van-icon name="arrow" class="arrow" />
      </router-link>
      <button v-if="userStore.isLoggedIn" type="button" class="menu-item" @click="handleLogout">
        <van-icon name="revoke" /><!-- 退出登录（当前 Vant 版本无 log-out 图标，用 revoke 替代） -->
        <span>退出登录</span>
        <van-icon name="arrow" class="arrow" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { showSuccessToast, showConfirmDialog } from 'vant'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

async function handleLogout() {
  try {
    await showConfirmDialog({ title: '提示', message: '确定要退出登录吗？' })
  } catch {
    return // 用户取消
  }
  userStore.logout()
  // 不再清空购物车——本地购物车按账号隔离存储，重新登录后自动恢复
  showSuccessToast('已退出登录')
  router.push('/login')
}
</script>

<style lang="scss" scoped>
.mine-page {
  padding: 16px;
}

.user-card {
  display: flex;
  align-items: center;
  /* 装饰性渐变保留原品牌橙（标题为 18px 粗体大字，对比度达标） */
  background: linear-gradient(135deg, var(--color-primary-raw), var(--color-primary-light));
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  color: #fff;

  &.clickable {
    cursor: pointer;
    transition: transform 0.2s;

    &:active {
      transform: scale(0.98);
    }
  }

  .user-info {
    margin-left: 16px;

    h3 {
      font-size: 18px;
      margin-bottom: 4px;
    }

    p {
      font-size: 14px;
      opacity: 0.9;
    }
  }
}

.avatar-fallback {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.avatar-placeholder {
  background: rgba(255, 255, 255, 0.3);
}

.menu-list {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  transition: background-color 0.2s;
  text-align: left;

  &:active {
    background: var(--color-bg);
  }

  &:last-child {
    border-bottom: none;
  }

  span {
    flex: 1;
    margin-left: 12px;
    font-size: 15px;
    color: var(--color-text);
  }

  .arrow {
    color: var(--color-text-placeholder); /* 原 #ccc 对比度不足 */
  }
}
</style>
