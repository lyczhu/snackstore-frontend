import { createPagedList } from '../../utils/usePagedList.js'
import { getProductList, getCategoryList } from '../../api/product.js'

Page({
  data: {
    categories: [],
    currentCategoryId: null,
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
      fetcher: (pageNum, pageSize) =>
        getProductList({ categoryId: this.data.currentCategoryId, pageNum, pageSize, status: 1 }),
      // 分类未就绪时不触发加载，保持骨架屏（对齐 H5 guard）
      guard: () => !!this.data.currentCategoryId
    })
    this.init()
  },

  init() {
    this.setData({ loadError: false })
    getCategoryList()
      .then((res) => {
        const categories = (res && res.data) || []
        this.setData({ categories })
        if (categories.length > 0) {
          this.setData({ currentCategoryId: categories[0].id })
          this.reload()
        } else {
          // 无分类：结束骨架，展示空态
          this.setData({ initialLoading: false })
        }
      })
      .catch(() => this.setData({ loadError: true, initialLoading: false }))
  },

  sync() {
    const l = this.list
    this.setData({
      items: l.items,
      loading: l.loading,
      finished: l.finished,
      listError: l.listError,
      initialLoading: l.initialLoading,
      loadError: l.loadError
    })
  },

  reload() {
    this.list.resetAndReload().then(() => this.sync())
  },

  selectCategory(e) {
    const id = e.currentTarget.dataset.id
    if (this.data.currentCategoryId === id) return
    this.setData({ currentCategoryId: id })
    this.reload()
  },

  onReachBottom() {
    if (!this.list.finished && !this.list.loading && this.data.currentCategoryId) {
      this.list.onLoad().then(() => this.sync())
    }
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/product-detail/product-detail?id=' + e.currentTarget.dataset.id })
  }
})
