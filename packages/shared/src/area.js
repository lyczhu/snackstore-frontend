/**
 * 省市区回填（M1′-8）。
 *
 * 地址表只存省/市/区三个名称字符串，而 van-area 的选中值需要区划编码，
 * 因此编辑地址时按名称反查编码。数据由调用方注入（@vant/area-data 的 areaList），
 * 本模块不引入数据依赖，两端共用同一份匹配逻辑。
 */

/**
 * 在扁平区划表中按名称查编码，并用上级编码前缀限定归属。
 * 区划编码规则：省 6 位、市前 4 位与省同源、区前 4 位与市同源，
 * 借此避免「朝阳区」这类同名区县跨市错配。
 */
function findCode(list, name, prefix) {
  if (!list || !name) return null
  for (const [code, value] of Object.entries(list)) {
    if (value === name && (!prefix || code.startsWith(prefix))) return code
  }
  return null
}

/**
 * 按名称反查省市区编码，用于回填 van-area 的选中值。
 * @param {{province_list: object, city_list: object, county_list: object}|null} areaList
 * @param {string} province 省名
 * @param {string} city 市名
 * @param {string} district 区名
 * @returns {string[]|null} 逐级命中的编码；省名未命中返回 null
 */
export function resolveAreaCodes(areaList, province, city, district) {
  if (!areaList) return null
  const provinceCode = findCode(areaList.province_list, province)
  if (!provinceCode) return null

  const codes = [provinceCode]
  const cityCode = findCode(areaList.city_list, city, provinceCode.slice(0, 2))
  if (!cityCode) return codes
  codes.push(cityCode)

  const districtCode = findCode(areaList.county_list, district, cityCode.slice(0, 4))
  if (districtCode) codes.push(districtCode)
  return codes
}
