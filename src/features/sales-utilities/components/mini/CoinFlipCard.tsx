import React, { useState, useEffect, useRef } from 'react';
import { Coins, RotateCcw, Crown, ShieldCheck } from 'lucide-react';
import {
    secureRandomInt,
    playFeedbackTone,
    createSpinTicker,
    unlockSoundEngine
} from '../../utils/randomUtils';

interface Props {
    soundEnabled: boolean;
}

export default function CoinFlipCard({ soundEnabled }: Props) {
    const [coinSide, setCoinSide] = useState<'SẤP' | 'NGỬA' | null>(null);
    const [isFlipping, setIsFlipping] = useState(false);
    const [stats, setStats] = useState({ sap: 0, ngua: 0 });

    const coinBodyRef = useRef<HTMLDivElement | null>(null);
    const coinShadowRef = useRef<HTMLDivElement | null>(null);
    const currentDegRef = useRef<number>(0);
    const rafRef = useRef<number | null>(null);
    const timerRef = useRef<number | null>(null);

    const stopAnimations = () => {
        if (rafRef.current !== null) {
            window.cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    useEffect(() => {
        return stopAnimations;
    }, []);

    const applyCoinTransform = (deg: number, liftY = 0, scale = 1) => {
        if (coinBodyRef.current) {
            coinBodyRef.current.style.transform = `translateY(${liftY.toFixed(2)}px) scale(${scale.toFixed(3)}) rotateY(${deg.toFixed(2)}deg)`;
        }
        if (coinShadowRef.current) {
            const liftProgress = Math.min(1, Math.abs(liftY) / 34);
            coinShadowRef.current.style.transform = `scaleX(${(1 - liftProgress * 0.38).toFixed(3)})`;
            coinShadowRef.current.style.opacity = `${(0.45 - liftProgress * 0.27).toFixed(2)}`;
        }
    };

    const handleFlip = () => {
        if (isFlipping) return;
        if (soundEnabled) unlockSoundEngine();

        stopAnimations();
        setIsFlipping(true);

        const nextSide: 'SẤP' | 'NGỬA' = secureRandomInt(0, 1) === 0 ? 'SẤP' : 'NGỬA';
        const startDeg = currentDegRef.current;
        const baseFullRot = Math.floor(startDeg / 360) * 360;
        const extraTurns = 6 + secureRandomInt(0, 3); // 6..9 vòng xoay tròn đầy đủ
        const targetDeg = baseFullRot + extraTurns * 360 + (nextSide === 'NGỬA' ? 180 : 0);

        const ticker = soundEnabled ? createSpinTicker('coin', 75) : null;
        ticker?.tick();

        const finalize = () => {
            currentDegRef.current = targetDeg;
            applyCoinTransform(targetDeg, 0, 1);
            setCoinSide(nextSide);
            setStats(prev => ({
                sap: prev.sap + (nextSide === 'SẤP' ? 1 : 0),
                ngua: prev.ngua + (nextSide === 'NGỬA' ? 1 : 0)
            }));
            setIsFlipping(false);
            if (soundEnabled) playFeedbackTone('win');
        };

        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            timerRef.current = window.setTimeout(finalize, 260);
            return;
        }

        const durationMs = 1650;
        const startTime = performance.now();
        let lastHalfTurn = Math.floor(startDeg / 180);

        const animateFrame = (now: number) => {
            const elapsed = now - startTime;
            const t = Math.min(1, elapsed / durationMs);
            // Giảm tốc mượt giúp giữ hồi hộp ở 0.5s cuối trước khi chạm mặt kết quả
            const eased = 1 - Math.pow(1 - t, 3.1);
            const currentDeg = startDeg + (targetDeg - startDeg) * eased;
            const arcWave = Math.sin(Math.PI * t);
            const liftY = -arcWave * 34;
            const scale = 1 + arcWave * 0.14;

            applyCoinTransform(currentDeg, liftY, scale);

            const halfTurnStep = Math.floor(currentDeg / 180);
            if (halfTurnStep !== lastHalfTurn) {
                lastHalfTurn = halfTurnStep;
                ticker?.tick();
            }

            if (t < 1) {
                rafRef.current = window.requestAnimationFrame(animateFrame);
            } else {
                rafRef.current = null;
                finalize();
            }
        };

        rafRef.current = window.requestAnimationFrame(animateFrame);
    };

    const handleReset = () => {
        if (isFlipping) return;
        stopAnimations();
        currentDegRef.current = 0;
        applyCoinTransform(0, 0, 1);
        setStats({ sap: 0, ngua: 0 });
        setCoinSide(null);
    };

    return (
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#0066ab] flex items-center justify-center shrink-0">
                        <Coins className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                        <h3 className="text-sm font-extrabold text-slate-900">Tung Đồng Xu</h3>
                        <p className="text-[11px] text-slate-600 tabular-nums">
                            Sấp: <strong className="text-amber-700">{stats.sap}</strong> • Ngửa: <strong className="text-[#0066ab]">{stats.ngua}</strong>
                        </p>
                    </div>
                </div>
                {(stats.sap > 0 || stats.ngua > 0) && (
                    <button
                        type="button"
                        onClick={handleReset}
                        aria-label="Đặt lại thống kê đồng xu"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                    >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                )}
            </div>

            {/* Sân khấu 3D Tung Đồng Xu (không dùng key động để transform 3D xoay liên tục) */}
            <div className="relative py-6 px-3 rounded-2xl bg-[#f4f9fd] border border-sky-100 flex flex-col items-center justify-center gap-3 overflow-hidden">
                <button
                    type="button"
                    onClick={handleFlip}
                    disabled={isFlipping}
                    aria-label="Chạm vào đồng xu để tung Sấp hoặc Ngửa"
                    className="coin-3d-stage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066ab] rounded-full cursor-pointer disabled:cursor-wait"
                >
                    <div
                        ref={coinBodyRef}
                        className="coin-3d-body relative w-[140px] h-[140px] rounded-full"
                    >
                        {/* Mặt SẤP (0 deg — Vàng kim) */}
                        <div className="coin-face coin-face-front absolute inset-0 rounded-full bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 border-4 border-amber-100 shadow-lg flex items-center justify-center p-2">
                            <div className="w-full h-full rounded-full border-2 border-dashed border-amber-900/30 flex flex-col items-center justify-center text-amber-950">
                                <Crown className="w-7 h-7 text-amber-900 mb-0.5" aria-hidden="true" />
                                <span className="text-xl font-black tracking-wider">SẤP</span>
                            </div>
                        </div>

                        {/* Mặt NGỬA (180 deg — Bạc sáng) */}
                        <div className="coin-face coin-face-back absolute inset-0 rounded-full bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 border-4 border-slate-100 shadow-lg flex items-center justify-center p-2">
                            <div className="w-full h-full rounded-full border-2 border-dashed border-slate-700/30 flex flex-col items-center justify-center text-slate-900">
                                <ShieldCheck className="w-7 h-7 text-slate-800 mb-0.5" aria-hidden="true" />
                                <span className="text-xl font-black tracking-wider">NGỬA</span>
                            </div>
                        </div>
                    </div>
                </button>

                {/* Bóng đổ co giãn theo độ cao đồng xu */}
                <div
                    ref={coinShadowRef}
                    aria-hidden="true"
                    className="w-24 h-2.5 rounded-full bg-slate-400/45 blur-[1px] transition-opacity"
                />

                <div className="text-xs font-bold text-slate-800 min-h-[20px]">
                    {isFlipping ? (
                        <span className="text-[#0066ab]">Đang tung đồng xu...</span>
                    ) : coinSide ? (
                        <span>
                            Kết quả: <strong className={coinSide === 'SẤP' ? 'text-amber-700' : 'text-[#0066ab]'}>{coinSide}</strong>
                        </span>
                    ) : (
                        <span className="text-slate-600 font-medium">Chạm đồng xu hoặc nhấn nút bên dưới</span>
                    )}
                </div>
            </div>

            <button
                type="button"
                onClick={handleFlip}
                disabled={isFlipping}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-[#0066ab] to-[#0369a1] hover:from-[#005591] hover:to-[#0284c7] disabled:opacity-60 text-white rounded-xl text-xs font-black shadow-sm transition cursor-pointer active:scale-[0.99]"
            >
                {isFlipping ? 'Đang tung...' : 'TUNG ĐỒNG XU'}
            </button>
        </section>
    );
}
