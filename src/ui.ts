export const $ = (sel: string) => document.querySelector(sel) as HTMLElement
export async function makeHearts(count = 140) {
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
export function makeOrbs(count = 3) {
  const wrap = $('.orbs');
  for (let i = 0; i < count; i++) {
    const orb = document.createElement('div');
    orb.className = 'orb rose';
    // 每个光点一个相位和速度
    orb.dataset.phase = String(Math.random() * Math.PI * 2);
    orb.dataset.speed = String(0.3 + Math.random() * 0.25); // 0.3~0.55 rad/s
    wrap.appendChild(orb);
  }
}

/** 玫瑰曲线动画：r = a * sin(kθ)，k 取奇数会更像花瓣 */
export function animateOrbs() {
  const orbs = Array.from(document.querySelectorAll<HTMLDivElement>('.orb.rose'));
  if (!orbs.length) return;
  const stage = document.querySelector('main.stage') as HTMLElement;
  const rect = stage.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const a = Math.min(rect.width, rect.height) * 0.28;  // 曲线尺度
  const k = 5;                                         // 花瓣数（奇数更好看）
  let t0 = performance.now();
  let elapsed = 0;
  function frame(t: number) {
    const dt = (t - t0) / 1000;
    t0 = t;
    elapsed += dt;
    orbs.forEach((orb) => {
      const phase = Number(orb.dataset.phase || '0');
      const speed = Number(orb.dataset.speed || '0.4');
      const theta = phase + elapsed * speed;   // ← 用累计时间
      const r = a * Math.sin(k * theta);
      const x = cx + r * Math.cos(theta);
      const y = cy + r * Math.sin(theta);
      orb.style.transform = `translate(${x}px, ${y}px)`;
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
