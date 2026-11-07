function req() {
  return getApp().globalData.request
}

export const getProductList = (params) => req().get('/product-search', { params })
export const getProductDetail = (id) => req().get(`/products/${id}`)
export const getCategoryList = () => req().get('/products/categories')
