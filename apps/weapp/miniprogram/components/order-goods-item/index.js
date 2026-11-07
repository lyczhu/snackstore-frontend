Component({
  properties: {
    image: { type: String, value: '' },
    name: { type: String, value: '' },
    price: { type: null, value: '' },
    quantity: { type: null, value: 1 },
    // H5 imageSize 默认 60px → 120rpx
    imageSize: { type: String, value: '120rpx' }
  }
})
