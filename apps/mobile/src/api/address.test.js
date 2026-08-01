import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// mock 掉真实 axios 封装，避免发网络请求
vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn()
  }
}))

import request from '@/utils/request'
import { useUserStore } from '@/stores/user'
import {
  getAddressList,
  getAddressById,
  postAddress,
  putAddress,
  deleteAddress,
  setDefaultAddress
} from './address'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  request.get.mockResolvedValue({ data: [] })
  request.post.mockResolvedValue({ data: {} })
  request.put.mockResolvedValue({ data: {} })
  request.delete.mockResolvedValue({ data: {} })
  request.patch.mockResolvedValue({ data: {} })
})

describe('address api - userId 防护', () => {
  it('未登录时拒绝请求，不拼出 /users/undefined/... 非法路径', async () => {
    const userStore = useUserStore()
    userStore.token = ''
    userStore.userInfo = null
    await expect(getAddressList()).rejects.toThrow('登录信息缺失')
    expect(request.get).not.toHaveBeenCalled()
  })

  it('未登录时其余写接口同样被拦截', async () => {
    const userStore = useUserStore()
    userStore.token = ''
    userStore.userInfo = null
    await expect(postAddress({ detail: 'x' })).rejects.toThrow('登录信息缺失')
    await expect(putAddress(1, {})).rejects.toThrow('登录信息缺失')
    await expect(deleteAddress(1)).rejects.toThrow('登录信息缺失')
    await expect(setDefaultAddress(1)).rejects.toThrow('登录信息缺失')
    expect(request.post).not.toHaveBeenCalled()
  })

  it('已登录时把 userId 拼进查询路径', async () => {
    const userStore = useUserStore()
    userStore.token = 't'
    userStore.userInfo = { id: 42 }
    await getAddressList()
    expect(request.get).toHaveBeenCalledWith('/users/42/addresses')
  })

  it('getAddressById / postAddress / putAddress / deleteAddress / setDefaultAddress 路径正确', async () => {
    const userStore = useUserStore()
    userStore.token = 't'
    userStore.userInfo = { id: 42 }

    await getAddressById(7)
    expect(request.get).toHaveBeenCalledWith('/users/42/addresses/7')

    await postAddress({ detail: 'x' })
    expect(request.post).toHaveBeenCalledWith('/users/42/addresses', { detail: 'x' })

    await putAddress(7, { detail: 'y' })
    expect(request.put).toHaveBeenCalledWith('/users/42/addresses/7', { detail: 'y' })

    await deleteAddress(7)
    expect(request.delete).toHaveBeenCalledWith('/users/42/addresses/7')

    await setDefaultAddress(7)
    expect(request.patch).toHaveBeenCalledWith('/users/42/addresses/7/default')
  })
})
