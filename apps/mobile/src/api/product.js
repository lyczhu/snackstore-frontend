import request from '@/utils/request'
import { createProductApi } from '@snackstore/shared'

export const { getProductList, getProductDetail, getCategoryList } = createProductApi(request)
