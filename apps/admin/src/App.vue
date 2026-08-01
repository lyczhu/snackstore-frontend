<template>
  <!-- 全量引入移除后，中文语言包改由 el-config-provider 按需注入 -->
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>

<script setup>
import zhCn from 'element-plus/es/locale/lang/zh-cn'
</script>
