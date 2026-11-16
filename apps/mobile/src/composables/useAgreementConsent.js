import { ref } from 'vue'

// 模块级状态：从登录页跳到协议页再返回时，勾选不会被重置
const agreed = ref(false)

export function useAgreementConsent() {
  return agreed
}
