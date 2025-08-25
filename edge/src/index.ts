export interface Env {
	R2: R2Bucket
	VIEWER_SHA256: string
	ADMIN_SHA256: string
	SIGNING_SECRET: string
	TOKEN_TTL?: string
	CORS_ORIGIN?: string
}

const CORS = (env: Env) => ({
	'access-control-allow-origin': env.CORS_ORIGIN || '*',
	'access-control-allow-headers': 'content-type,authorization',
	'access-control-allow-methods': 'GET,POST,OPTIONS,DELETE',
})
const json = (d: unknown, s = 200, h: Record<string, string> = {}) =>
	new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', ...h } })

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
const u8 = (s: string) => new TextEncoder().encode(s)

async function sha256(s: string) {
	const d = await crypto.subtle.digest('SHA-256', u8(s))
	return Array.from(new Uint8Array(d)).map(x => x.toString(16).padStart(2, '0')).join('')
}
async function hmac(secret: string, data: string) {
	const key = await crypto.subtle.importKey('raw', u8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
	const sig = await crypto.subtle.sign('HMAC', key, u8(data))
	return b64(new Uint8Array(sig))
}
async function sign(env: Env, payload: Record<string, unknown>) {
	const body = b64(u8(JSON.stringify(payload)))
	const sig = await hmac(env.SIGNING_SECRET, body)
	return `${body}.${sig}`
}
async function verify(env: Env, token?: string) {
	if (!token) return null
	const [body, sig] = token.split('.')
	if (!body || !sig) return null
	const check = await hmac(env.SIGNING_SECRET, body)
	if (check !== sig) return null
	const data = JSON.parse(atob(body)) as { role: 'viewer' | 'admin', exp: number }
	if (!data?.exp || Date.now() > data.exp) return null
	return data
}
function mime(key: string) {
	const ext = key.split('.').pop()?.toLowerCase() || ''
	if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`
	if (['mp4', 'webm', 'm4v', 'mov', 'ogv', 'ogg'].includes(ext)) return ext === 'ogv' ? 'video/ogg' : `video/${ext}`
	return 'application/octet-stream'
}

export default {
	async fetch(req: Request, env: Env) {
		const url = new URL(req.url)
		if (req.method === 'OPTIONS') return new Response('', { headers: CORS(env) })

		// ---- 登录：POST /login { role, code } ----
		if (url.pathname === '/login' && req.method === 'POST') {
			const { role, code } = await req.json() as { role: 'viewer' | 'admin', code: string }
			if (!role || !code) return json({ error: 'bad request' }, 400, CORS(env))
			const hash = await sha256(code)
			console.log('[login]', { role, code, hash })     // ← 临时日志，dev 终端能看到
			const target = role === 'admin' ? env.ADMIN_SHA256 : env.VIEWER_SHA256
			if (hash !== target) return json({ error: 'invalid code' }, 401, CORS(env))
			const ttl = Number(env.TOKEN_TTL || '3600') * 1000
			const token = await sign(env, { role, exp: Date.now() + ttl })

			  
			return json({ token, role, ttl }, 200, CORS(env))
		}
		  

		// ---- 需要鉴权的接口 ----
		const auth = req.headers.get('authorization') || ''
		const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
		const sess = await verify(env, token)
		if (!sess) return json({ error: 'unauthorized' }, 401, CORS(env))

		// ---- 列表：GET /list ----
		if (url.pathname === '/list' && req.method === 'GET') {
			// 没接 R2 时返回空列表，接了 R2 再打开：
			if (!env.R2) return json({ items: [], truncated: false }, 200, CORS(env))
			const listed = await env.R2.list({ limit: 1000 })
			const items = listed.objects.map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded?.toISOString() || null, type: mime(o.key) }))
			return json({ items, truncated: listed.truncated}, 200, CORS(env))
		}

		// ---- 读文件：GET /file/<key> ----
		if (url.pathname.startsWith('/file/') && req.method === 'GET') {
			if (!env.R2) return json({ error: 'R2 not bound' }, 500, CORS(env))
			const key = decodeURIComponent(url.pathname.replace('/file/', ''))
			const obj = await env.R2.get(key)
			if (!obj) return new Response('Not found', { status: 404, headers: CORS(env) })
			return new Response(obj.body, { status: 200, headers: { ...CORS(env), 'content-type': mime(key) } })
		}

		// ---- 删除：DELETE /file/<key> (admin only) ----
		if (url.pathname.startsWith('/file/') && req.method === 'DELETE') {
			if (sess.role !== 'admin') return json({ error: 'forbidden' }, 403, CORS(env))
			const key = decodeURIComponent(url.pathname.replace('/file/', ''))
			await env.R2.delete(key)
			return json({ ok: true }, 200, CORS(env))
		}

		// 健康检查
		return json({ ok: true, service: 'worker' }, 200, CORS(env))
	}
}
