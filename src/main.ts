import './style.css'
import { login, list, fileUrl, remove, getToken } from './api'


// ====== 小工具 ======
const $ = (sel: string) => document.querySelector(sel) as HTMLElement
function makeHearts(count = 140) {
  const wrap = $('#hearts')
  const rand = (a: number, b: number) => a + Math.random() * (b - a)
  wrap.innerHTML = ''
  for (let i = 0; i < count; i++) {
    const h = document.createElement('div'); h.className = 'heart'
    h.style.left = rand(10, 90) + '2vw'                 // 让心心更居中一些
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
// === DOM 引用（和 index.html 中的 id 一一对应） ===
const adminBtn = document.getElementById('adminBtn') as HTMLButtonElement
const logoutBtn = document.getElementById('logout') as HTMLButtonElement
const adminPanel = document.getElementById('admin-panel') as HTMLElement
const uploadBtn = document.getElementById('uploadBtn') as HTMLButtonElement
const editMsgBtn = document.getElementById('editMsgBtn') as HTMLButtonElement
const viewBtn = document.getElementById('viewBtn') as HTMLButtonElement
const filePicker = document.getElementById('filePicker') as HTMLInputElement
const gallery = document.getElementById('gallery') as HTMLElement

function roleFromToken(): 'viewer' | 'admin' | null {
  const t = getToken()
  if (!t) return null
  const p = parseJwt(t)
  return p?.role === 'admin' || p?.role === 'viewer' ? p.role : null
}

// 统一切 UI（登录/登出后都调它）
function applyUI() {
  const role = roleFromToken()
  if (!role) {
    // 未登录
    adminBtn.style.display = 'inline-block'
    logoutBtn.style.display = 'none'
    adminPanel.style.display = 'none'
    return
  }
  // 已登录
  adminBtn.style.display = 'none'
  logoutBtn.style.display = 'inline-block'
  adminPanel.style.display = role === 'admin' ? 'block' : 'none'
}

// —— “查看大家的祝福”按钮 ——（未登录先弹 viewer 口令）
viewBtn.onclick = async () => {
  lock(viewBtn, true, '加载中')
  try {
    if (!getToken()) openCode('viewer')
    else await showGallery()
  } finally {
    lock(viewBtn, false)
  }
}

// —— 打开登录弹窗（默认访客，弹窗里可切换管理员）——
adminBtn.onclick = () => openCode('viewer')

// —— 上传：管理员可见 ——
// 用隐藏的 input，避免重复创建 input
uploadBtn?.addEventListener('click', () => filePicker.click())
filePicker.onchange = async () => {
  if (!filePicker.files?.length) return
  const file = filePicker.files[0]
  try {
    lock(uploadBtn!, true, '上传中...')
    // TODO: 调你的上传 API（R2/Supabase）
    void file
    // await upload(file)
    toast('上传成功')
    await showGallery()
  } catch (e: any) {
    toast(e?.message || '上传失败')
  } finally {
    lock(uploadBtn!, false)
    filePicker.value = ''
  }
}

// —— 编辑祝福：管理员可见 ——（示例：弹输入框）
editMsgBtn?.addEventListener('click', async () => {
  const old = (document.getElementById('bless') as HTMLElement)?.textContent || ''
  const next = prompt('请输入新的祝福语：', old?.trim() || '')
  if (next == null) return
  try {
    lock(editMsgBtn, true, '保存中...');
    // TODO: 调用保存祝福语 API（或直接本地存储/Worker KV）
    (document.getElementById('bless') as HTMLElement).textContent = next
    toast('已更新祝福语')
  } catch (e: any) {
    toast(e?.message || '保存失败')
  } finally {
    lock(editMsgBtn, false)
  }
})
// —— 登出 ——（清 token + 复原 UI + 清画廊）
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('wg_token')
  applyUI()
  gallery.style.display = 'none'
  gallery.innerHTML = ''
  toast('已退出')
  location.reload(); // 或者重置UI
})

// —— 登录弹窗元素 —— 
const codeModal = document.getElementById('codeModal') as HTMLElement
const codeInput = document.getElementById('codeInput') as HTMLInputElement
const codeErr = document.getElementById('codeErr') as HTMLDivElement
const codeTitle = document.getElementById('codeTitle') as HTMLElement
const codeSubmit = document.getElementById('codeSubmit') as HTMLButtonElement
const codeSwitch = document.getElementById('codeSwitch') as HTMLButtonElement
const codeClose = document.getElementById('codeClose') as HTMLButtonElement
let codeRole: 'viewer' | 'admin' = 'viewer'
function openCode(role: 'viewer' | 'admin' = 'viewer') { codeRole = role; codeTitle.textContent = role === 'viewer' ? '输入口令' : '管理员口令'; codeSwitch.textContent = role === 'viewer' ? '切换为管理员' : '切换为访客'; codeErr.style.display = 'none'; codeInput.value = ''; codeModal.style.display = 'grid' }
function closeCode() { codeModal.style.display = 'none' }
codeClose.onclick = closeCode
codeSwitch.onclick = () => openCode(codeRole === 'viewer' ? 'admin' : 'viewer')
codeSubmit.onclick = async () => {
  const v = codeInput.value.trim()
  if (!v) { codeErr.textContent = '请输入口令'; codeErr.style.display = 'block'; return }
  lock(codeSubmit, true, '验证中')
  try {
    await login(codeRole, v)           // 成功会保存 token
    closeCode()
    toast(codeRole === 'admin' ? '欢迎管理员' : '验证成功')
    applyUI()                          // ✅ 切换 UI
    await showGallery()                // 两种角色都给看；如果只想 viewer 看，这里改条件
  } catch (e: any) {
    codeErr.textContent = e?.message || '口令不正确'
    codeErr.style.display = 'block'
  } finally {
    lock(codeSubmit, false)
  }
}

// ===== 页面进来先应用一次 UI（若已有 token 可直接露出退出/上传）======
applyUI()

// ===== 登出逻辑 =====
document.getElementById('logout')!.addEventListener('click', () => {
  localStorage.removeItem('wg_token');
  // === UI 复原 ===
  document.getElementById('admin')!.style.display = 'inline-block' // 登录按钮回来
  document.getElementById('logout')!.style.display = 'none'
  document.getElementById('admin-panel')!.style.display = 'none' // 上传隐藏
  gallery.innerHTML = '' // 清空展示
  toast('已退出')
  location.reload(); // 或者重置UI
});

// ====== 画廊渲染（含骨架占位） ======
// 骨架占位
function renderSkeleton(n = 8) {
  const tpl = (document.getElementById('card-skeleton') as HTMLTemplateElement).content
  gallery.innerHTML = ''
  for (let i = 0; i < n; i++) gallery.appendChild(tpl.cloneNode(true))
}
// document.getElementById('uploadBtn')?.addEventListener('click', () => {
//   const fileInput = document.createElement('input')
//   fileInput.type = 'file'
//   fileInput.accept = 'video/*,image/*'
//   fileInput.onchange = async () => {
//     if (fileInput.files?.length) {
//       const file = fileInput.files[0]
//       try {
//         lock(document.getElementById('uploadBtn') as HTMLButtonElement, true, '上传中...')
//         // TODO: 调用 API 上传到 R2/Supabase
//         toast('上传成功')
//         await showGallery() // 刷新
//       } catch (e: any) {
//         toast(e?.message || '上传失败')
//       } finally {
//         lock(document.getElementById('uploadBtn') as HTMLButtonElement, false)
//       }
//     }
//   }
//   fileInput.click()
// })


async function showGallery() {
  const stage = document.querySelector('main.stage') as HTMLElement
  if (stage && !stage.classList.contains('compact')) stage.classList.add('compact')
  gallery.style.display = 'grid'
  gallery.innerHTML = '' // 可先放骨架
  renderSkeleton(8)
  try {
    const res = await list()
    gallery.innerHTML = ''  // 拿到数据后把骨架清掉
    if (!res.items.length) { 
      // gallery.innerHTML = '<div class="empty">还没有祝福，做第一个送祝福的人吧</div>'; 
      const tpl = (document.getElementById('card-empty') as HTMLTemplateElement).content.cloneNode(true)
      gallery.appendChild(tpl)
      return 
    }
    const isAdmin = parseJwt(getToken())?.role === 'admin'
    res.items.forEach((it, i) => {
      const url = fileUrl(it.key)
      const card = document.createElement('div')
      card.className = 'card'
      card.style.position = 'relative'
      card.style.setProperty('--delay', `${i * 60}ms`) // 卡片错峰入场
      card.innerHTML = it.type === 'image'
        ? `<img src="${url}" alt="">`
        : `<video src="${url}" controls playsinline></video>`
      if (isAdmin) {
        const del = document.createElement('button')
        del.textContent = '删除'
        del.style.cssText = 'position:absolute;right:10px;top:10px'
        del.onclick = async () => {
          if (!confirm('确定删除？')) return
          lock(del as any, true, '…')
          try { await remove(it.key); card.remove(); toast('已删除') }
          finally { lock(del as any, false) }
        }
        card.appendChild(del)
      }
      gallery.appendChild(card)
    })
  } catch (e: any) {
    toast(e?.message || '加载失败')
  }
}
function parseJwt(t: string) { try { const [b] = t.split('.'); return JSON.parse(atob(b)) } catch { return null } }
console.log("API_BASE=", import.meta.env.VITE_API_BASE);
