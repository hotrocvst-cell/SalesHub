interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rotation: number;
    vRot: number;
    life: number;
    maxLife: number;
}

const CONFETTI_COLORS = [
    '#0066ab', // ocean deep
    '#12c3f4', // ocean cyan
    '#0284c7', // sky-600
    '#f59e0b', // amber-500
    '#16a34a', // green-600
    '#ffffff'  // crisp white
];

/**
 * Hiệu ứng pháo giấy gọn nhẹ bằng Canvas 2D thuần (không cần thư viện ngoài, tự dọn DOM sau ~1.8s).
 */
export function triggerConfettiBurst(options?: {
    originX?: number;
    originY?: number;
    particleCount?: number;
}): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const count = Math.min(130, Math.max(24, options?.particleCount ?? 75));
    const originXRatio = options?.originX ?? 0.5;
    const originYRatio = options?.originY ?? 0.45;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        canvas.remove();
        return;
    }
    ctx.scale(dpr, dpr);

    const originX = width * originXRatio;
    const originY = height * originYRatio;

    const particles: Particle[] = Array.from({ length: count }, (_, idx) => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.95);
        const speed = 5 + Math.random() * 8;
        return {
            x: originX + (Math.random() - 0.5) * 40,
            y: originY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            size: 5 + Math.random() * 5,
            color: CONFETTI_COLORS[idx % CONFETTI_COLORS.length],
            rotation: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 0.25,
            life: 0,
            maxLife: 70 + Math.random() * 35
        };
    });

    let rafId = 0;
    const step = () => {
        ctx.clearRect(0, 0, width, height);
        let aliveCount = 0;

        for (const p of particles) {
            p.life++;
            if (p.life >= p.maxLife) continue;
            aliveCount++;

            p.vy += 0.24; // Trọng lực nhẹ
            p.vx *= 0.985;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.vRot;

            const alpha = Math.max(0, 1 - Math.pow(p.life / p.maxLife, 2));
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size * 0.35, p.size, p.size * 0.7);
            ctx.restore();
        }

        if (aliveCount > 0) {
            rafId = window.requestAnimationFrame(step);
        } else {
            window.cancelAnimationFrame(rafId);
            canvas.remove();
        }
    };

    rafId = window.requestAnimationFrame(step);
}

