import { supabase } from './supabaseClient'


export type Role = 'viewer' | 'uploader' | 'admin'


export async function signIn(email: string) {
    // 简化：魔法链接登录；也可改为密码登录
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } })
    if (error) throw error
}


export async function signOut() {
    await supabase.auth.signOut()
}


export async function getRole(): Promise<Role> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'viewer'
    const { data, error } = await supabase.from('users_profile').select('role').eq('id', user.id).maybeSingle()
    if (error) throw error
    return (data?.role as Role) ?? 'viewer'
}