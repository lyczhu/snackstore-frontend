<template>
  <div class="agreement-page">
    <PageNavBar :title="doc ? doc.title : '协议'" />

    <van-empty v-if="!doc" image="error" description="页面不存在">
      <van-button round type="primary" size="small" @click="goBack">返回</van-button>
    </van-empty>

    <template v-else>
      <p class="doc-meta">最后更新：{{ doc.updatedAt }}</p>
      <p class="doc-summary">{{ doc.summary }}</p>

      <section v-for="(section, i) in doc.sections" :key="i" class="doc-section">
        <h2>{{ section.heading }}</h2>
        <p v-for="(text, j) in section.paragraphs || []" :key="'p' + j">{{ text }}</p>
        <ul v-if="section.bullets">
          <li v-for="(item, k) in section.bullets" :key="'b' + k">{{ item }}</li>
        </ul>
      </section>

      <van-button block round plain type="primary" class="back-btn" @click="goBack"
        >返回</van-button
      >
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAgreement } from '@snackstore/shared'
import PageNavBar from '@/components/PageNavBar.vue'

const route = useRoute()
const router = useRouter()
const doc = computed(() => getAgreement(route.params.type))

function goBack() {
  if (window.history.state?.back) router.back()
  else router.replace('/mine')
}
</script>

<style lang="scss" scoped>
.agreement-page {
  min-height: 100vh;
  padding: 16px;
  background: var(--color-bg);
}

.doc-meta {
  font-size: 12px;
  color: var(--color-text-placeholder);
  margin-bottom: 8px;
}

.doc-summary {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 16px;
}

.doc-section {
  background: #fff;
  border-radius: var(--radius-card);
  padding: 16px;
  margin-bottom: 12px;

  h2 {
    font-size: 15px;
    color: var(--color-text);
    margin-bottom: 8px;
  }

  p {
    font-size: 13px;
    line-height: 1.7;
    color: var(--color-text-secondary);
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  ul {
    padding-left: 18px;
  }

  li {
    font-size: 13px;
    line-height: 1.7;
    color: var(--color-text-secondary);
    list-style: disc;
    margin-bottom: 4px;
  }
}

.back-btn {
  margin-top: 8px;
}
</style>
