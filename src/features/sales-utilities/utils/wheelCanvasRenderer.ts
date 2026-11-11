const WHEEL_PALETTE = [
    { bg: '#0066ab', text: '#ffffff' },
    { bg: '#12c3f4', text: '#0b2333' },
    { bg: '#0369a1', text: '#ffffff' },
    { bg: '#ffffff', text: '#0b2333' }
];

function getSliceColors(idx: number, total: number) {
    if (total > 4 && idx === total - 1 && idx % 4 === 0) {
        return { bg: '#38bdf8', text: '#0b2333' };
    }
    return WHEEL_PALETTE[idx % WHEEL_PALETTE.length];
}

/**
 * Vẽ Canvas Vòng quay may mắn sắc nét theo devicePixelRatio
 */
export function drawWheelCanvas(
    canvas: HTMLCanvasElement,
    items: string[],
    rotationRad: number
): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssSize = canvas.clientWidth || 340;
    const pixelSize = Math.round(cssSize * dpr);
    if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
        canvas.width = pixelSize;
        canvas.height = pixelSize;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssSize, cssSize);

    const cx = cssSize / 2;
    const cy = cssSize / 2;
    const radius = Math.max(40, cssSize / 2 - 6);

    if (items.length === 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();
        ctx.fillStyle = '#475569';
        ctx.font = '700 13px Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Nhập danh sách để quay', cx, cy - 42);
        ctx.restore();
        return;
    }

    const sliceAngle = (Math.PI * 2) / items.length;
    const fontSize = items.length > 20 ? 10 : items.length > 14 ? 11.5 : items.length > 8 ? 13 : 14.5;
    const maxChars = items.length > 18 ? 11 : items.length > 12 ? 14 : 19;

    items.forEach((label, idx) => {
        const start = rotationRad + idx * sliceAngle;
        const end = start + sliceAngle;
        const palette = getSliceColors(idx, items.length);

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, end);
        ctx.closePath();
        ctx.fillStyle = palette.bg;
        ctx.fill();

        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(0, 102, 171, 0.18)';
        ctx.stroke();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(start + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = palette.text;
        ctx.font = `700 ${fontSize}px Roboto, sans-serif`;

        const truncated = label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
        ctx.fillText(truncated, radius - 16, 0);
        ctx.restore();
    });

    ctx.restore();
}

