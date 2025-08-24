import { supabase } from './supabaseClient'


// src/storage.ts
export async function uploadBlob(path: string, blob: Blob) {
    const { data, error } = await supabase
        .storage.from('media')
        .upload(path, blob, {
            upsert: true,
            contentType: blob.type || 'application/octet-stream',
            cacheControl: '3600',
        });
    if (error) throw error;
    return data; // { path, id, ... }
}


export async function signedUrl(path: string, expires = 60 * 60) {
    const { data, error } = await supabase.storage.from('media').createSignedUrl(path, expires)
    if (error) throw error
    return data.signedUrl
}


export async function upsertAsset(payload: any) {
    const { error } = await supabase.from('media_assets').insert(payload)
    if (error) throw error
}


export async function generateThumbForImage(file: File): Promise<Blob> {
    const img = document.createElement('img')
    const url = URL.createObjectURL(file)
    await new Promise<void>((res) => { img.onload = () => res(); img.src = url })
    const canvas = document.createElement('canvas')
    const maxW = 480
    const ratio = Math.min(1, maxW / img.naturalWidth)
    canvas.width = img.naturalWidth * ratio
    canvas.height = img.naturalHeight * ratio
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob: Blob = await new Promise(r => canvas.toBlob(b => r(b!), 'image/jpeg', .82))
    URL.revokeObjectURL(url)
    return blob
}