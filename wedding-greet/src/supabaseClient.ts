import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anon) {
  console.error('[ENV MISSING]', { url, anon })
  alert('缺少 Supabase 配置（.env.local 未生效或变量未以 VITE_ 开头）')
}

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true }
})

// 暴露到全局，方便在控制台里看（这里就不用 import.meta 了）
;(window as any).__SUPA = { url, anon_head: anon ? anon.slice(0,6)+'…' : '' }
//temp
;(window as any).healthcheck = async () => {
    // console.log('[ENV]', __SUPA)
    const db = await supabase.from('media_assets').select('id').limit(1)
    console.log('[DB select]', db.error ?? 'OK', db.data)
    const auth = await supabase.auth.getSession()
    console.log('[Auth session]', auth.data.session ? 'logged in' : 'no session', auth.error ?? '')
    const st = await supabase.storage.from('media').list('', { limit: 1 })
    console.log('[Storage list]', st.error ?? 'OK', st.data)
  }