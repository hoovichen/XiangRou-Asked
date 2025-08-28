export interface Env {
	R2: R2Bucket
	VIEWER_SHA256: string
	ADMIN_SHA256: string
	SIGNING_SECRET: string
	TOKEN_TTL?: string
	CORS_ORIGIN?: string
}

const CORS = (env: Env, req?: Request) => {
	// 支持多域白名单
	const list = (env.CORS_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean)
	const origin = req?.headers.get('Origin') || ''
	const allow =
		list.includes('*') ? '*' :
			list.includes(origin) ? origin : ''

	const h: Record<string, string> = {
		'access-control-allow-origin': env.CORS_ORIGIN || '*',
		'access-control-expose-headers': 'content-type,content-range,accept-ranges',
		'access-control-allow-headers': 'content-type,authorization,ranges',
		'access-control-allow-methods': 'GET,POST,OPTIONS,DELETE',
		'access-control-max-age': '86400',
	}
	if (allow) {
		h['access-control-allow-origin'] = allow
		if (allow !== '*') h['vary'] = 'Origin'
	}
	return h
}
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
function pickToken(req: Request, url: URL) {
	const q = url.searchParams.get('t');
	// console.log(q);
	if (q) return decodeURIComponent(q);
	const a = req.headers.get('authorization') || '';
	return a.startsWith('Bearer ') ? a.slice(7) : '';
}

export default {
	async fetch(req: Request, env: Env) {
		const url = new URL(req.url)
		if (req.method === 'OPTIONS') return new Response('', { headers: CORS(env, req) })

		// ---- 登录：POST /login { role, code } ----
		if (url.pathname === '/login' && req.method === 'POST') {
			const { role, code } = await req.json() as { role: 'viewer' | 'admin', code: string }
			if (!role || !code) return json({ error: 'bad request' }, 400, CORS(env, req))
			const hash = await sha256(code)
			// console.log('[login]', { role, code, hash })     // ← 临时日志，dev 终端能看到
			const target = role === 'admin' ? env.ADMIN_SHA256 : env.VIEWER_SHA256
			if (hash !== target) return json({ error: 'invalid code' }, 401, CORS(env, req))
			const ttl = Number(env.TOKEN_TTL || '3600') * 1000
			const token = await sign(env, { role, exp: Date.now() + ttl })


			return json({ token, role, ttl }, 200, CORS(env, req))
		}
		// ---- 需要鉴权的接口 ----
		// 既支持 Header Bearer，也支持 URL ?t=
		const token = pickToken(req, url);
		const sess = await verify(env, token)
		if (!sess) return json({ error: 'unauthorized' }, 401, CORS(env, req))

		// ---- 列表：GET /list ----
		if (url.pathname === '/list' && req.method === 'GET') {
			// 没接 R2 时返回空列表，接了 R2 再打开：
			// console.log('hasR2 =', !!env.R2)
			console.log('list get file  '+ token);
			if (!env.R2) return json({ items: [], truncated: false }, 200, CORS(env, req))
			const listed = await env.R2.list({ limit: 1000 })
			// console.log(listed.objects.map(o => o.key))
			const items = listed.objects.map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded?.toISOString() || null, type: mime(o.key) }))
			return json({ items, truncated: listed.truncated }, 200, CORS(env, req))
		}

		// ---- 读文件：GET /file/<key> ----
		if (url.pathname.startsWith('/file/') && req.method === 'GET') {
			if (!env.R2) return json({ error: 'R2 not bound' }, 500, CORS(env, req));
			const key = decodeURIComponent(url.pathname.replace('/file/', ''));
			const range = req.headers.get('range');            // e.g. "bytes=0-" 或 "bytes=100-199"

			// --- Range: 按片返回，206
			if (range) {
				const m = /bytes=(\d+)-(\d+)?/i.exec(range);
				const start = m ? Number(m[1]) : 0;
				const end = m && m[2] ? Number(m[2]) : undefined;

				const obj = await env.R2.get(key, end !== undefined
					? { range: { offset: start, length: end - start + 1 } }
					: { range: { offset: start } }
				);
				if (!obj) return new Response('Not found', { status: 404, headers: CORS(env, req) });

				const size = obj.size ?? 0; // 对象总大小
				// 如果请求里有 end，就用 end-start+1；否则就是 size - start
				const length = end !== undefined ? end - start + 1 : (size - start);
				const last   = start + length - 1;

				const headers: Record<string, string> = {
					...CORS(env, req),
					'content-type': mime(key),
					'accept-ranges': 'bytes',
					'content-length': String(length),
					'content-range': `bytes ${start}-${last}/${size}`,
				};
				return new Response(obj.body, { status: 206, headers });
			}

			// --- 非 Range: 整文件，200
			const obj = await env.R2.get(key);
			if (!obj) return new Response('Not found', { status: 404, headers: CORS(env, req) });

			return new Response(obj.body, {
				status: 200,
				headers: {
					...CORS(env, req),
					'content-type': mime(key),
					'accept-ranges': 'bytes',
					'content-length': String(obj.size),
				}
			});
		}

		// ---- 删除：DELETE /file/<key> (admin only) ----
		if (url.pathname.startsWith('/file/') && req.method === 'DELETE') {
			console.log('delete   ' + token);
			if (sess.role !== 'admin') return json({ error: 'forbidden' }, 403, CORS(env, req))
			const key = decodeURIComponent(url.pathname.replace('/file/', ''))
			await env.R2.delete(key)
			return json({ ok: true }, 200, CORS(env, req))
		}
		// POST /upload  (需要携带 Authorization: Bearer <token>)
		if (url.pathname === '/upload' && req.method === 'POST') {
			if (!env.R2) return json({ error: 'R2 not bound' }, 500, CORS(env, req))
			const sess = await verify(env, (req.headers.get('authorization') || '').replace(/^Bearer /, ''))
			if (!sess) return json({ error: 'unauthorized' }, 401, CORS(env, req))

			const form = await req.formData()
			const file = form.get('file') as File | null
			if (!file) return json({ error: 'no file' }, 400, CORS(env, req))

			const key = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${file.name}`
			await env.R2.put(key, await file.arrayBuffer(), {
				httpMetadata: { contentType: file.type }
			})
			return json({ key }, 200, CORS(env, req))
		}


		// 健康检查
		return json({ ok: true, service: 'worker' }, 200, CORS(env, req))
	}
}
