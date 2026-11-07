import { createPagedList } from '../../utils/usePagedList.js'
import { getProductList, getCategoryList } from '../../api/product.js'
import { syncTabBadge } from '../../stores/cart.js'

Page({
  data: {
    keyword: '',
    categories: [],
    currentCategoryId: null,
    currentCategoryName: '',
    banners: [],
    sectionTitle: '推荐商品',
    items: [],
    loading: false,
    finished: false,
    listError: false,
    initialLoading: true,
    loadError: false
  },

  list: null,

  onLoad() {
    this.list = createPagedList({
      fetcher: (pageNum, pageSize) => {
        const params = { pageNum, pageSize, status: 1 }
        if (this.data.currentCategoryId) params.categoryId = this.data.currentCategoryId
        if (this.data.keyword) params.keyword = this.data.keyword
        return getProductList(params)
      }
    })
    this.loadCategories()
    this.load()
    syncTabBadge()
  },

  loadCategories() {
    // 分类加载失败不阻塞主流程，降级为无分类栏（接口错误已由请求层提示）
    getCategoryList()
      .then((res) => this.setData({ categories: (res && res.data) || [] }))
      .catch(() => {})
  },

  sync() {
    const l = this.list
    const d = this.data
    const banners = !d.keyword && !d.currentCategoryId ? l.items.slice(0, 3) : []
    const sectionTitle = d.keyword ? '搜索“' + d.keyword + '”' : d.currentCategoryName || '推荐商品'
    this.setData({
      items: l.items,
      loading: l.loading,
      finished: l.finished,
      listError: l.listError,
      initialLoading: l.initialLoading,
      loadError: l.loadError,
      banners,
      sectionTitle
    })
  },

  load() {
    this.list.onLoad().then(() => this.sync())
  },

  retry() {
    this.list.resetAndReload().then(() => this.sync())
  },

  onReachBottom() {
    if (!this.list.finished && !this.list.loading) this.load()
  },

  onPullDownRefresh() {
    this.list.resetAndReload().then(() => {
      this.sync()
      wx.stopPullDownRefresh()
    })
  },

  selectCategory(e) {
    const id = e.currentTarget.dataset.id
    // 再次点击已选分类则取消筛选，回到推荐流
    if (this.data.currentCategoryId === id) {
      this.setData({ currentCategoryId: null, currentCategoryName: '' })
    } else {
      const cat = this.data.categories.find((c) => c.id === id)
      this.setData({ currentCategoryId: id, currentCategoryName: cat ? cat.name : '' })
    }
    this.retry()
  },

  // 输入防抖 400ms 自动搜索；搜索时清除分类筛选（对齐 H5 handleSearch）
  onSearch(e) {
    this.setData({ keyword: e.detail, currentCategoryId: null, currentCategoryName: '' })
    clearTimeout(this._t)
    this._t = setTimeout(() => this.retry(), 400)
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/product-detail/product-detail?id=' + e.currentTarget.dataset.id })
  },

  goBanner(e) {
    this.goDetail(e)
  }
})
