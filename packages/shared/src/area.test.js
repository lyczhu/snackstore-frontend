import { describe, it, expect } from 'vitest'
import { resolveAreaCodes } from './area.js'

// 精简版面积数据：两个省、含一组同名区县（朝阳区）
const AREA_LIST = {
  province_list: {
    110000: '北京市',
    440000: '广东省'
  },
  city_list: {
    110100: '北京市',
    440100: '广州市',
    440300: '深圳市'
  },
  county_list: {
    110105: '朝阳区',
    110106: '丰台区',
    440104: '越秀区',
    440305: '南山区'
  }
}

describe('resolveAreaCodes', () => {
  it('三级名称全部命中时返回三级编码', () => {
    expect(resolveAreaCodes(AREA_LIST, '广东省', '深圳市', '南山区')).toEqual([
      '440000',
      '440300',
      '440305'
    ])
  })

  it('区县为空或未命中时只返回到市级', () => {
    expect(resolveAreaCodes(AREA_LIST, '广东省', '深圳市', '')).toEqual(['440000', '440300'])
    expect(resolveAreaCodes(AREA_LIST, '广东省', '深圳市', '不存在区')).toEqual([
      '440000',
      '440300'
    ])
  })

  it('市未命中时只返回到省级', () => {
    expect(resolveAreaCodes(AREA_LIST, '北京市', '不存在市', '朝阳区')).toEqual(['110000'])
  })

  it('省未命中或数据缺失时返回 null', () => {
    expect(resolveAreaCodes(AREA_LIST, '不存在省', '深圳市', '南山区')).toBeNull()
    expect(resolveAreaCodes(AREA_LIST, '', '', '')).toBeNull()
    expect(resolveAreaCodes(null, '广东省', '深圳市', '南山区')).toBeNull()
  })

  it('同名区县按上下级编码前缀归属，不会跨市错配', () => {
    // 朝阳区在北京市与长春市同名；广州市下无朝阳区，不应回落命中北京那条
    expect(resolveAreaCodes(AREA_LIST, '广东省', '广州市', '朝阳区')).toEqual(['440000', '440100'])
    expect(resolveAreaCodes(AREA_LIST, '北京市', '北京市', '朝阳区')).toEqual([
      '110000',
      '110100',
      '110105'
    ])
  })
})
