Component({
  properties: {
    product: { type: Object, value: null },
    // grid：首页双列；list：分类页单列带描述（与 H5 ProductCard 的 mode 同义）
    mode: { type: String, value: 'grid' }
  },

  methods: {
    // 商品卡本质是链接（H5 用 router-link 包裹），小程序里由组件自己跳详情，
    // 宿主页面不必再写 data-id + bind:tap。
    goDetail() {
      const p = this.data.product
      if (!p || p.id === undefined || p.id === null) return
      wx.navigateTo({ url: '/pages/product-detail/product-detail?id=' + p.id })
    }
  }
})
