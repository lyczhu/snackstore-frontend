import { test, expect } from '@playwright/test'

/**
 * M1′-10 冒烟：只覆盖「能让用户走通」的主干与三个已修复过的坑，
 * 细节分支由各包的单元测试负责（shared 85 / weapp 30 / admin 15 / mobile 38）。
 */
const PHONE = '13800000000'
const PASSWORD = '123456'

test.beforeEach(async ({ request }) => {
  // mock 状态在内存里，用例之间必须重置，否则订单/购物车互相污染
  const res = await request.post('/api/_test/reset')
  expect(res.ok()).toBeTruthy()
})

async function login(page) {
  await page.goto('/login')
  await page.getByPlaceholder('请输入手机号').fill(PHONE)
  await page.getByPlaceholder('请输入密码').fill(PASSWORD)
  await page.locator('.van-checkbox').click()
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/\/home$/)
}

/** 加购商品 1 并走到订单列表，返回第一张订单卡片 */
async function placeOrder(page) {
  await page.goto('/product/1')
  await page.getByRole('button', { name: '加入购物车' }).click()
  await expect(page.locator('.van-toast')).toContainText('已加入购物车')

  await page.goto('/cart')
  await page.getByRole('button', { name: /去结算/ }).click()
  await expect(page).toHaveURL(/\/order\/confirm$/)

  await page.getByRole('button', { name: '提交订单' }).click()
  await expect(page).toHaveURL(/\/order\/list$/)

  const card = page.locator('.order-card').first()
  await expect(card).toContainText('待支付')
  return card
}

test('未勾选协议时登录被拦截', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('请输入手机号').fill(PHONE)
  await page.getByPlaceholder('请输入密码').fill(PASSWORD)
  await page.getByRole('button', { name: '登录' }).click()

  await expect(page.locator('.van-toast')).toContainText('请先阅读并同意')
  await expect(page).toHaveURL(/\/login$/)
})

test('下单 → 收银台支付 → 订单变为已完成', async ({ page }) => {
  await login(page)
  const card = await placeOrder(page)

  await card.getByRole('button', { name: '支付' }).click()
  await expect(page).toHaveURL(/\/payment\/\d+$/)
  await expect(page.locator('.payment-page')).toContainText('演示环境')

  await page.getByRole('button', { name: /确认支付/ }).click()
  await expect(page.locator('.result-text')).toContainText('支付成功')

  await page.getByRole('button', { name: '查看订单' }).click()
  await expect(page).toHaveURL(/\/order\/\d+$/)
  await expect(page.locator('.status-bar')).toContainText('已完成')
})

test('取消订单后进入「已取消」Tab', async ({ page }) => {
  await login(page)
  const card = await placeOrder(page)

  await card.getByRole('button', { name: '取消' }).click()
  await page.locator('.van-dialog__confirm').click()
  await expect(page.locator('.van-toast')).toContainText('订单已取消')

  await page.getByRole('tab', { name: '已取消' }).click()
  await expect(page.locator('.order-card').first()).toContainText('已取消')
})

test('已下架商品禁止加购，售罄商品给出提示', async ({ page }) => {
  await login(page)

  await page.goto('/product/3')
  await expect(page.getByRole('button', { name: '已下架' })).toBeDisabled()

  await page.goto('/product/4')
  await page.getByRole('button', { name: '加入购物车' }).click()
  await expect(page.locator('.van-toast')).toContainText('商品已售罄')
})
