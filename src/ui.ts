export const $ = (sel: string) => document.querySelector(sel) as HTMLElement
export function makeHearts(count = 60) {
    const wrap = $('#hearts')
    const rand = (a: number, b: number) => a + Math.random() * (b - a)
    for (let i = 0; i < count; i++) {
        const h = document.createElement('div'); h.className = 'heart'
        h.style.left = rand(0, 100) + 'vw'
        h.style.animationDelay = rand(-6, 0) + 's'
        h.style.animationDuration = rand(4, 10) + 's'
        h.style.transform = `translateY(${rand(10, 80)}vh) rotate(45deg)`
        h.style.opacity = String(rand(.4, .95))
        h.style.width = rand(10, 22) + 'px'
        wrap.appendChild(h)
    }
}