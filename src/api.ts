const API = import.meta.env.VITE_API_BASE as string

let token = localStorage.getItem('wg_token') ?? ''
export const getToken = () => token
export const setToken = (t: string) => { token = t; localStorage.setItem('wg_token', t) }

type HDR = HeadersInit
const jsonHdr: HDR = { 'content-type': 'application/json' }

// 关键：使用条件展开，避免出现 { authorization: undefined }
function authHeaders(): HDR {
  return token ? { authorization: 'Bearer ' + token } : {}
}

export async function login(role: 'viewer' | 'admin', code: string) {
  const r = await fetch(API + '/login', {
    method: 'POST',
    headers: jsonHdr,                       // 这里就是普通 JSON 头
    body: JSON.stringify({ role, code }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || r.statusText)
  setToken(j.token)
  return j
}

export async function list() {
  const r = await fetch(API + '/list', { headers: authHeaders() })  // 这里的 headers 是 HeadersInit
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || r.statusText)
  return j as { items: { key: string; type: 'image' | 'video'; size: number; uploaded: string | null }[]; truncated: boolean }
}

export function fileUrl(key: string) {
  const base = import.meta.env.VITE_API_BASE
  // const t = encodeURIComponent(getToken() || '')
  const t = getToken() || ''
  return `${base}/file/${encodeURIComponent(key)}?t=${t}`
}

export async function remove(key: string) {
  const r = await fetch(API + '/file/' + encodeURIComponent(key), {
    method: 'DELETE',
    headers: authHeaders(),                 // 同理
  })
  if (!r.ok) throw new Error('删除失败')
  return true
}
