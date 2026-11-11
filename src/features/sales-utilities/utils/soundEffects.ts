export type SpinSoundKind = 'wheel' | 'coin' | 'dice' | 'slot' | 'ball' | 'box';

let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
        sharedAudioContext = new AudioCtx();
    }
    if (sharedAudioContext.state === 'suspended') {
        sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
}

/**
 * Mở khóa AudioContext ngay trong thao tác chạm của người dùng trên mobile/PC
 */
export function unlockSoundEngine(): void {
    getSharedAudioContext();
}

/**
 * Phát âm thanh báo hiệu kết quả rõ nét bằng Web Audio API dùng chung 1 AudioContext bền vững
 */
export function playFeedbackTone(kind: 'win' | 'alarm' | 'flip' | 'countdown_tick' = 'win'): void {
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        const playNote = (
            freq: number,
            startOffset: number,
            duration: number,
            type: OscillatorType = 'triangle',
            gainVal = 0.2
        ) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, now + startOffset);
            gain.gain.setValueAtTime(0.0001, now + startOffset);
            gain.gain.linearRampToValueAtTime(gainVal, now + startOffset + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + startOffset);
            osc.stop(now + startOffset + duration + 0.03);
        };

        if (kind === 'flip') {
            playNote(1560, 0, 0.08, 'sine', 0.16);
            playNote(2093, 0.03, 0.09, 'sine', 0.11);
        } else if (kind === 'countdown_tick') {
            playNote(740, 0, 0.075, 'sine', 0.15);
        } else if (kind === 'win') {
            playNote(523.25, 0, 0.13, 'triangle', 0.2);
            playNote(659.25, 0.08, 0.14, 'triangle', 0.2);
            playNote(783.99, 0.16, 0.16, 'triangle', 0.22);
            playNote(1046.5, 0.24, 0.42, 'triangle', 0.24);
            playNote(1046.5, 0.24, 0.42, 'sine', 0.14);
        } else {
            playNote(880, 0, 0.15, 'triangle', 0.24);
            playNote(1046.5, 0.16, 0.15, 'triangle', 0.24);
            playNote(1318.5, 0.32, 0.26, 'triangle', 0.26);
            playNote(880, 0.65, 0.15, 'triangle', 0.22);
            playNote(1046.5, 0.81, 0.15, 'triangle', 0.22);
            playNote(1318.5, 0.97, 0.34, 'triangle', 0.25);
        }
    } catch {
        // Trình duyệt chặn AudioContext hoặc không hỗ trợ
    }
}

/**
 * Bộ phát tiếng hiệu ứng trong khi đang quay / tung xu / đổ xí ngầu / chạy tên
 */
export function createSpinTicker(
    kind: SpinSoundKind = 'wheel',
    minGapMs = 36
): { tick: () => void; close: () => void } {
    const ctx = getSharedAudioContext();
    if (!ctx) return { tick: () => {}, close: () => {} };
    let lastTickAt = 0;
    let stepIndex = 0;

    return {
        tick: () => {
            const nowMs = performance.now();
            if (nowMs - lastTickAt < minGapMs) return;
            lastTickAt = nowMs;
            stepIndex++;

            try {
                if (ctx.state === 'suspended') {
                    ctx.resume().catch(() => {});
                }
                const t = ctx.currentTime;

                if (kind === 'wheel') {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(760, t);
                    osc.frequency.exponentialRampToValueAtTime(340, t + 0.045);
                    gain.gain.setValueAtTime(0.16, t);
                    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(t);
                    osc.stop(t + 0.06);
                } else if (kind === 'coin') {
                    const oscMain = ctx.createOscillator();
                    const oscHarm = ctx.createOscillator();
                    const gain = ctx.createGain();
                    oscMain.type = 'sine';
                    oscHarm.type = 'triangle';
                    const baseFreq = stepIndex % 2 === 0 ? 1760 : 1975;
                    oscMain.frequency.setValueAtTime(baseFreq, t);
                    oscHarm.frequency.setValueAtTime(baseFreq * 1.5, t);
                    gain.gain.setValueAtTime(0.15, t);
                    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);
                    oscMain.connect(gain);
                    oscHarm.connect(gain);
                    gain.connect(ctx.destination);
                    oscMain.start(t);
                    oscHarm.start(t);
                    oscMain.stop(t + 0.07);
                    oscHarm.stop(t + 0.07);
                } else if (kind === 'dice') {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    const startFreq = stepIndex % 2 === 0 ? 340 : 430;
                    osc.frequency.setValueAtTime(startFreq, t);
                    osc.frequency.exponentialRampToValueAtTime(160, t + 0.045);
                    gain.gain.setValueAtTime(0.22, t);
                    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(t);
                    osc.stop(t + 0.055);
                } else if (kind === 'ball') {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(520, t);
                    osc.frequency.exponentialRampToValueAtTime(980, t + 0.065);
                    gain.gain.setValueAtTime(0.2, t);
                    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(t);
                    osc.stop(t + 0.09);
                } else if (kind === 'box') {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(660, t);
                    osc.frequency.exponentialRampToValueAtTime(1120, t + 0.08);
                    gain.gain.setValueAtTime(0.18, t);
                    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.095);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(t);
                    osc.stop(t + 0.1);
                } else {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(stepIndex % 2 === 0 ? 587 : 740, t);
                    gain.gain.setValueAtTime(0.17, t);
                    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(t);
                    osc.stop(t + 0.055);
                }
            } catch {
                // Bỏ qua nếu context chưa sẵn sàng
            }
        },
        close: () => {
            // Giữ lại sharedAudioContext cho lượt quay tiếp theo
        }
    };
}

