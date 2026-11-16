/**
 * E2E 冒烟用的后端 mock（真实 HTTP，由 Vite dev 代理转发，不用浏览器路由拦截）。
 *
 * 契约与 packages/shared 保持一致：成功体 { code, message, data }，分页端点 data.data 为数组。
 * 全部状态只在内存里，POST /api/_test/reset 在每条用例前重置，保证用例互不影响。
 * 这不是生产后端，只为覆盖「登录 → 加购 → 下单 → 支付 → 取消」冒烟链路而存在。
 */
import { createServer } from 'node:http'

const PORT = Number(process.env.MOCK_PORT) || 8099

const img = (text, bg = '#e55a2b') =>
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="${bg}"/><text x="100" y="110" font-size="48" text-anchor="middle" fill="#fff">${text}</text></svg>`
  ).toString('base64')

const CATEGORIES = [
  { id: 1, name: '膨化零食', sort: 10, status: 1 },
  { id: 2, name: '糖果巧克力', sort: 20, status: 1 }
]

const PRODUCTS = [
  {
    id: 1,
    name: '冒烟零食 1 号',
    price: '4.00',
    coverImage: img('1'),
    stock: 99,
    status: 1,
    categoryId: 1,
    categoryName: '膨化零食',
    description: '冒烟测试商品',
    detail: '<p>图文详情</p>'
  },
  {
    id: 2,
    name: '冒烟零食 2 号',
    price: '7.00',
    coverImage: img('2', '#ff8f65'),
    stock: 99,
    status: 1,
    categoryId: 2,
    categoryName: '糖果巧克力',
    description: '冒烟测试商品',
    detail: '<p>图文详情</p>'
  },
  {
    id: 3,
    name: '冒烟零食 3 号（已下架）',
    price: '10.00',
    coverImage: img('3', '#767676'),
    stock: 0,
    status: 0,
    categoryId: 1,
    categoryName: '膨化零食',
    description: '用于验证失效态',
    detail: '<p>图文详情</p>'
  },
  {
    id: 4,
    name: '冒烟零食 4 号（售罄）',
    price: '12.00',
    coverImage: img('4', '#999999'),
    stock: 0,
    status: 1,
    categoryId: 1,
    categoryName: '膨化零食',
    description: '在售但无库存',
    detail: '<p>图文详情</p>'
  }
]

const USER = { id: 1, nickname: '冒烟用户', phone: '13800000000', avatar: img('头') }

let addresses = []
let orders = []
let orderSeq = 100

function reset() {
  addresses = [
    {
      id: 1,
      receiverName: '张三',
      receiverPhone: '13800000000',
      province: '浙江省',
      city: '杭州市',
      district: '西湖区',
      detail: '文三路 100 号',
      isDefault: 1
    }
  ]
  orders = []
  orderSeq = 100
}
reset()

const ok = (data) => ({ code: 200, message: 'ok', data })
const paged = (list) => ({ code: 200, message: 'ok', data: { data: list, total: list.length } })

const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'))
      } catch {
        resolve({})
      }
    })
  })
}

function toOrderItem(product, quantity, index) {
  return {
    id: index + 1,
    productId: product.id,
    productName: product.name,
    productImage: product.coverImage,
    productPrice: product.price,
    quantity
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname.replace(/^\/api/, '')
  const send = (body, status = 200) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body))
  }

  // 每条用例前重置内存状态
  if (path === '/_test/reset' && req.method === 'POST') {
    reset()
    return send(ok(true))
  }

  if (path === '/auth/login' || path === '/auth/admin/login') {
    return send(ok({ token: 'e2e-token', user: USER }))
  }

  if (path === '/products/categories') return send(ok(CATEGORIES))

  if (path === '/product-search') {
    const categoryId = url.searchParams.get('categoryId')
    const list = PRODUCTS.filter((p) => p.status === 1).filter(
      (p) => !categoryId || p.categoryId === Number(categoryId)
    )
    return send(paged(list))
  }

  const productMatch = path.match(/^\/products\/(\d+)$/)
  if (productMatch) {
    const product = PRODUCTS.find((p) => p.id === Number(productMatch[1]))
    if (!product) return send({ code: 404, message: '商品不存在' })
    return send(ok(product))
  }

  const addressMatch = path.match(/^\/users\/(\d+)\/addresses$/)
  if (addressMatch && req.method === 'GET') return send(ok(addresses))

  if (path === '/orders' && req.method === 'POST') {
    const body = await readBody(req)
    const items = (body.items || []).map((item, index) => {
      const product = PRODUCTS.find((p) => p.id === Number(item.productId)) || PRODUCTS[0]
      return toOrderItem(product, item.quantity, index)
    })
    const totalCents = items.reduce(
      (sum, item) => sum + Math.round(Number(item.productPrice) * 100) * item.quantity,
      0
    )
    orderSeq += 1
    const order = {
      id: orderSeq,
      orderNo: 'NO2026' + orderSeq,
      status: 0,
      totalAmount: (totalCents / 100).toFixed(2),
      createdAt: fmt(new Date()),
      payTime: null,
      items,
      receiverName: body.receiverName || '',
      receiverPhone: body.receiverPhone || '',
      receiverAddress: body.receiverAddress || ''
    }
    orders.unshift(order)
    return send(ok(order))
  }

  if (path === '/orders' && req.method === 'GET') {
    const status = url.searchParams.get('status')
    const list =
      status === null || status === '' ? orders : orders.filter((o) => o.status === Number(status))
    return send(paged(list))
  }

  const orderStatusMatch = path.match(/^\/orders\/(\d+)\/status$/)
  if (orderStatusMatch && req.method === 'PATCH') {
    const order = orders.find((o) => o.id === Number(orderStatusMatch[1]))
    if (!order) return send({ code: 404, message: '订单不存在' })
    order.status = Number(url.searchParams.get('status'))
    order.payTime = order.status === 1 ? fmt(new Date()) : null
    return send(ok(true))
  }

  const orderMatch = path.match(/^\/orders\/(\d+)$/)
  if (orderMatch) {
    const id = Number(orderMatch[1])
    const order = orders.find((o) => o.id === id)
    if (req.method === 'DELETE') {
      if (!order) return send({ code: 404, message: '订单不存在' })
      if (order.status !== 2) return send({ code: 400, message: '仅允许删除已取消订单' })
      orders = orders.filter((o) => o.id !== id)
      return send(ok(true))
    }
    if (!order) return send({ code: 404, message: '订单不存在' })
    return send(ok(order))
  }

  send({ code: 404, message: 'not found: ' + path })
})

server.listen(PORT, () => {
  console.log('[e2e-mock] listening on http://localhost:' + PORT + '/api')
})
