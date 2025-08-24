import './style.css'
import { supabase } from './supabaseClient'  // 你已有这个文件

// ====== 小工具 ======
const $ = (sel: string) => document.querySelector(sel) as HTMLElement
function makeHearts(count = 140) {
  const wrap = $('#hearts')
  const rand = (a: number, b: number) => a + Math.random() * (b - a)
  wrap.innerHTML = ''
  for (let i = 0; i < count; i++) {
    const h = document.createElement('div'); h.className = 'heart'
    h.style.left = rand(10, 90) + 'vw'                 // 让心心更居中一些
    h.style.animationDelay = rand(-6, 0) + 's'
    h.style.animationDuration = rand(6, 12) + 's'
    h.style.transform = `translateY(${rand(10, 80)}vh) rotate(45deg)`
    h.style.opacity = String(rand(.4, .95))
    h.style.width = rand(10, 22) + 'px'
    wrap.appendChild(h)
  }
}
// —— 按钮上锁（防重复点击）与 toast —— //
function lock(btn: HTMLButtonElement, on = true, loadingText?: string) {
  if (!btn) return
  if (on) {
    btn.setAttribute('disabled', 'true')
    btn.dataset._text = btn.textContent || ''
    if (loadingText) btn.textContent = loadingText
    btn.classList.add('btnloading')
  } else {
    btn.removeAttribute('disabled')
    if (btn.dataset._text) btn.textContent = btn.dataset._text
    btn.classList.remove('btnloading')
  }
}
function toast(msg: string, ms = 1800) {
  const t = document.createElement('div')
  t.className = 'toast'; t.textContent = msg
  document.body.appendChild(t)
  setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 300) }, ms)
}

// ====== 文案 ======
const params = new URLSearchParams(location.search)
const raw = getComputedStyle(document.documentElement).getPropertyValue('--msg').replace(/"/g, '').trim();
($('#bless') as HTMLElement).textContent = params.get('msg') || raw
const from = params.get('from')
if (from) ($('#sign') as HTMLElement).textContent = `— ${from}`
makeHearts(140)

// ====== 绑定元素（命名与 index.html 一致） ======
const loginBtn = $('#login') as HTMLButtonElement
const logoutBtn = $('#logout') as HTMLButtonElement
const viewBtn = $('#viewBtn') as HTMLButtonElement
const uploadBtn = $('#uploadBtn') as HTMLButtonElement
const filePicker = $('#filePicker') as HTMLInputElement
const gallery = $('#gallery') as HTMLDivElement

// —— 登录弹窗元素 —— 
// —— 登录弹窗逻辑 —— 
const authModal = document.getElementById('authModal')!
const authClose = document.getElementById('authClose') as HTMLButtonElement
const authEmail = document.getElementById('authEmail') as HTMLInputElement
const authPass = document.getElementById('authPassword') as HTMLInputElement
const authSubmit = document.getElementById('authSubmit') as HTMLButtonElement
const authSwitch = document.getElementById('authSwitch') as HTMLButtonElement
const authError = document.getElementById('authError') as HTMLDivElement

let authMode: 'login' | 'signup' = 'login'
function openAuth(mode: 'login' | 'signup' = 'login') {
  authMode = mode;
  (document.getElementById('authTitle') as HTMLElement).textContent = (mode === 'login' ? '登录' : '注册')
  authSubmit.textContent = (mode === 'login' ? '登录' : '注册')
  authSwitch.textContent = (mode === 'login' ? '点此注册' : '点此登录')
  authError.style.display = 'none'; authEmail.value = ''; authPass.value = ''
  authModal.classList.add('show')
}
function closeAuth() { authModal.classList.remove('show') }

loginBtn.onclick = () => openAuth('login')
logoutBtn.onclick = async () => { await supabase.auth.signOut(); location.reload() }
authClose.onclick = closeAuth
authSwitch.onclick = () => openAuth(authMode === 'login' ? 'signup' : 'login')

authSubmit.onclick = async () => {
  authError.style.display = 'none'
  const email = authEmail.value.trim()
  const password = authPass.value
  if (!email || !password) { authError.textContent = '请填写邮箱与密码'; authError.style.display = 'block'; return }
  lock(authSubmit, true, authMode === 'login' ? '登录中' : '注册中')
  try {
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      closeAuth(); toast('登录成功')
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } })
      if (error) throw error
      closeAuth(); toast('注册成功' + '（若开启邮箱确认，请去邮箱点链接）')
    }
  } catch (e: any) {
    authError.textContent = e?.message || String(e)
    authError.style.display = 'block'
  } finally {
    lock(authSubmit, false)
  }
}
const authMagic = document.getElementById('authMagic') as HTMLButtonElement
const authReset = document.getElementById('authReset') as HTMLButtonElement

// 邮件快捷登录（无需密码，点击邮件中的链接即可完成登录）
authMagic.onclick = async () => {
  const email = authEmail.value.trim()
  if (!email) { authError.textContent = '请先填写邮箱'; authError.style.display = 'block'; return }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin } // 需在 Auth->URL configuration 设好 Site URL
  })
  if (error) { authError.textContent = error.message; authError.style.display = 'block'; return }
  closeAuth()
  alert('已发送快捷登录邮件，请到邮箱点击链接后返回本页。')
}
// 忘记密码：发重设邮件
authReset.onclick = async () => {
  const email = authEmail.value.trim()
  if (!email) { authError.textContent = '请先填写邮箱'; authError.style.display = 'block'; return }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin + '/#recovery' // 返回后可提示用户输入新密码
  })
  if (error) { authError.textContent = error.message; authError.style.display = 'block'; return }
  closeAuth()
  alert('已发送重设密码邮件，请到邮箱完成操作。')
}
// 登录状态同步按钮显隐
supabase.auth.onAuthStateChange((_e, session) => {
  const authed = !!session
  loginBtn.style.display = authed ? 'none' : ''
  logoutBtn.style.display = authed ? '' : 'none'
})


// ====== 画廊渲染（含骨架占位） ======
// 骨架占位
function renderSkeleton(n = 8) {
  const tpl = (document.getElementById('card-skeleton') as HTMLTemplateElement).content
  gallery.innerHTML = ''
  for (let i = 0; i < n; i++) gallery.appendChild(tpl.cloneNode(true))
}

// ===== 递归列出 media 桶下所有文件（子目录全遍历） =====
// ===== 递归列出 media 桶下所有文件（子目录全遍历） =====
async function listAllFiles(prefix = ''): Promise<{ path: string, type: 'image' | 'video' }[]> {
  const out: { path: string, type: 'image' | 'video' }[] = []
  const stack = [prefix]  // DFS/BFS 都可，这里用栈
  while (stack.length) {
    const p = stack.pop()!
    const { data, error } = await supabase.storage.from('media').list(p, { limit: 1000, sortBy: { column: 'name', order: 'desc' } })
    if (error) { console.warn('list error @', p, error); continue }
    for (const it of data || []) {
      const full = p ? `${p}/${it.name}` : it.name
      // 判断“是否文件”：有 id 的是文件，没 id 的是目录（Supabase 的返回结构）
      if ((it as any).id) {
        const ext = it.name.split('.').pop()?.toLowerCase() || ''
        const videoExt = ['mp4', 'webm', 'mov', 'm4v', 'ogg', 'ogv']
        const imgExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif']
        const type: 'image' | 'video' = imgExt.includes(ext) ? 'image' : (videoExt.includes(ext) ? 'video' : 'video')
        out.push({ path: full, type })
      } else {
        stack.push(full)   // 子目录
      }
    }
  }
  return out  // 这里不裁剪，全部返回
}

// ===== 渲染画廊（优先读数据库；为空时用 Storage 兜底） =====
async function loadGallery() {
  const stage = document.querySelector('main.stage') as HTMLElement
  if (stage && !stage.classList.contains('compact')) stage.classList.add('compact')

  gallery.style.display = 'grid'
  renderSkeleton(8)

  // 1) 先试数据库
  const db = await supabase
    .from('media_assets')
    .select('id,type,file_path,title,created_at,status')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  gallery.innerHTML = ''

  if (db.error) {
    gallery.innerHTML = `<div class="card" style="opacity:.8">${db.error.message}</div>`
    return
  }

  if (db.data && db.data.length) {
    for (const row of db.data) {
      const { data: pub } = supabase.storage.from('media').getPublicUrl(row.file_path)
      const url = pub?.publicUrl || '#'
      const card = document.createElement('div'); card.className = 'card'
      card.innerHTML = row.type === 'image'
        ? `<img src="${url}" alt="${row.title || ''}">`
        : `<video src="${url}" controls playsinline></video>`
      gallery.appendChild(card)
    }
  } else {
    // 2) 数据表为空：用 Storage 全量兜底（能把你早期的 webm 都读出来）
    const files = await listAllFiles('')
    if (!files.length) {
      const empty = (document.getElementById('card-empty') as HTMLTemplateElement).content.cloneNode(true)
      gallery.appendChild(empty)
      return
    }
    for (const f of files) {
      const { data: pub } = supabase.storage.from('media').getPublicUrl(f.path)
      const url = pub?.publicUrl || '#'
      const card = document.createElement('div'); card.className = 'card'
      card.innerHTML = f.type === 'image'
        ? `<img src="${url}" alt="">`
        : `<video src="${url}" controls playsinline></video>`
      gallery.appendChild(card)
    }
  }
}

viewBtn.onclick = loadGallery

viewBtn.onclick = async () => {
  lock(viewBtn, true, '加载中')
  try { await loadGallery(); toast('已为你加载最新祝福') }
  catch (e: any) { toast('加载失败：' + (e?.message || e)) }
  finally { lock(viewBtn, false) }
}
// ====== 上传（登录后） ======
uploadBtn.onclick = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { openAuth('login'); return }
  filePicker.click()
}

filePicker.onchange = async () => {
  const file = filePicker.files?.[0]; if (!file) return
  lock(uploadBtn, true, '上传中')
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { openAuth('login'); return }

    const y = new Date().getFullYear()
    const m = String(new Date().getMonth() + 1).padStart(2, '0')
    const ext = file.name.split('.').pop()?.toLowerCase() || (file.type.startsWith('image/') ? 'jpg' : 'webm')
    const path = `${user.id}/${y}/${m}/${Date.now()}.${ext}`  // 唯一路径

    const up = await supabase.storage.from('media').upload(path, file, {
      upsert: true, contentType: file.type || 'application/octet-stream', cacheControl: '3600'
    })
    if (up.error) throw up.error

    const type = file.type.startsWith('image/') ? 'image' : 'video'
    const ins = await supabase.from('media_assets').insert({
      owner_id: user.id, type, file_path: path, title: file.name, status: 'active'
    })
    if (ins.error) throw ins.error

    toast('上传成功')
    if (gallery.style.display !== 'none') await loadGallery()
  } catch (e: any) {
    toast('上传失败：' + (e?.message || e))
    console.error(e)
  } finally {
    lock(uploadBtn, false)
    filePicker.value = ''
  }
}



