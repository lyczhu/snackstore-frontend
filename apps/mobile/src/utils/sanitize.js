import DOMPurify from 'dompurify'

// 净化后端返回的富文本，防止存储型 XSS（窃取 localStorage token）。
// 使用 DOMPurify 默认白名单（允许 p/img/a 等排版标签，剔除 script/iframe/事件属性），
// 额外禁用 style 避免恶意定位覆盖。
export function sanitizeHtml(html) {
  return DOMPurify.sanitize(html || '', {
    FORBID_TAGS: ['style', 'form', 'input', 'button'],
    FORBID_ATTR: ['style']
  })
}
