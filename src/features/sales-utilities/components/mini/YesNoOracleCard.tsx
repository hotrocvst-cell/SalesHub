import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, CheckCircle2, XCircle, RotateCcw, Compass } from 'lucide-react';
import {
    secureRandomInt,
    playFeedbackTone,
    createSpinTicker,
    unlockSoundEngine
} from '../../utils/randomUtils';

interface Props {
    soundEnabled: boolean;
}

export default function YesNoOracleCard({ soundEnabled }: Props) {
    const [question, setQuestion] = useState('');
    const [result, setResult] = useState<'YES' | 'NO' | null>(null);
    const [flashSide, setFlashSide] = useState<'YES' | 'NO'>('YES');
    const [isDeciding, setIsDeciding] = useState(false);
    const [revealKey, setRevealKey] = useState(0);
    const [stats, setStats] = useState({ yes: 0, no: 0 });

    const intervalRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);

    const clearTimers = () => {
        if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    useEffect(() => {
        return clearTimers;
    }, []);

    const handleDecide = () => {
        if (isDeciding) return;
        if (soundEnabled) unlockSoundEngine();
        clearTimers();

        setIsDeciding(true);
        setResult(null);

        const ticker = soundEnabled ? createSpinTicker('slot', 80) : null;
        ticker?.tick();

        let step = 0;
        intervalRef.current = window.setInterval(() => {
            step++;
            setFlashSide(step % 2 === 0 ? 'YES' : 'NO');
            ticker?.tick();
        }, 95);

        timeoutRef.current = window.setTimeout(() => {
            clearTimers();
            const finalAnswer: 'YES' | 'NO' = secureRandomInt(0, 1) === 0 ? 'YES' : 'NO';
            setResult(finalAnswer);
            setIsDeciding(false);
            setRevealKey(k => k + 1);
            setStats(prev => ({
                yes: prev.yes + (finalAnswer === 'YES' ? 1 : 0),
                no: prev.no + (finalAnswer === 'NO' ? 1 : 0)
            }));
            if (soundEnabled) playFeedbackTone('win');
        }, 900);
    };

    const handleReset = () => {
        if (isDeciding) return;
        setStats({ yes: 0, no: 0 });
        setResult(null);
    };

    const activeSide = isDeciding ? flashSide : result;

    return (
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#0066ab] flex items-center justify-center shrink-0">
                        <HelpCircle className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                        <h3 className="text-sm font-extrabold text-slate-900">Quyết Định Yes / No</h3>
                        <p className="text-[11px] text-slate-600 tabular-nums">
                            Có: <strong className="text-emerald-700">{stats.yes}</strong> • Không: <strong className="text-rose-700">{stats.no}</strong>
                        </p>
                    </div>
                </div>
                {(stats.yes > 0 || stats.no > 0) && (
                    <button
                        type="button"
                        onClick={handleReset}
                        aria-label="Đặt lại thống kê Yes No"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                    >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                )}
            </div>

            <input
                type="text"
                aria-label="Câu hỏi (tùy chọn)"
                value={question}
                disabled={isDeciding}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleDecide(); }}
                placeholder="Nghĩ trong đầu câu hỏi hoặc gõ nhanh tại đây..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-500 outline-none focus:bg-white focus:ring-1 focus:ring-[#0066ab]"
            />

            <div
                key={revealKey}
                className={`relative min-h-[154px] rounded-2xl border p-4 flex flex-col items-center justify-center text-center gap-1.5 overflow-hidden transition-colors duration-200 ${
                    isDeciding
                        ? activeSide === 'YES'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-rose-50 border-rose-300 text-rose-800'
                        : result === 'YES'
                            ? 'yn-reveal-pop bg-emerald-600 border-emerald-700 text-white'
                            : result === 'NO'
                                ? 'yn-reveal-pop bg-rose-600 border-rose-700 text-white'
                                : 'bg-[#f4f9fd] border-sky-100 text-slate-700'
                }`}
            >
                {isDeciding && (
                    <span
                        aria-hidden="true"
                        className={`yn-ring-pulse absolute w-28 h-28 rounded-full border-2 ${
                            activeSide === 'YES' ? 'border-emerald-500' : 'border-rose-500'
                        }`}
                    />
                )}

                <div className="relative z-10 flex flex-col items-center gap-1">
                    {isDeciding ? (
                        <div className="yn-blink flex flex-col items-center gap-1">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider">
                                Đang quyết định...
                            </span>
                            <span className="text-4xl font-black tracking-wide">
                                {activeSide === 'YES' ? 'CÓ' : 'KHÔNG'}
                            </span>
                        </div>
                    ) : result === 'YES' ? (
                        <>
                            <CheckCircle2 className="w-7 h-7 text-emerald-100" aria-hidden="true" />
                            <span className="text-4xl sm:text-5xl font-black tracking-wide">CÓ · YES</span>
                            <span className="text-[11px] font-medium text-emerald-50 max-w-[260px] truncate">
                                {question.trim() ? `“${question.trim()}”` : 'Nhấn lại để hỏi câu tiếp theo'}
                            </span>
                        </>
                    ) : result === 'NO' ? (
                        <>
                            <XCircle className="w-7 h-7 text-rose-100" aria-hidden="true" />
                            <span className="text-4xl sm:text-5xl font-black tracking-wide">KHÔNG · NO</span>
                            <span className="text-[11px] font-medium text-rose-50 max-w-[260px] truncate">
                                {question.trim() ? `“${question.trim()}”` : 'Nhấn lại để hỏi câu tiếp theo'}
                            </span>
                        </>
                    ) : (
                        <>
                            <Compass className="w-8 h-8 text-[#0066ab]/50" aria-hidden="true" />
                            <span className="text-3xl font-black text-slate-400 tracking-wider">—</span>
                            <span className="text-[11px] text-slate-600 font-medium">
                                Tập trung câu hỏi trong đầu rồi nhấn nút bên dưới
                            </span>
                        </>
                    )}
                </div>
            </div>

            <button
                type="button"
                onClick={handleDecide}
                disabled={isDeciding}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-[#0066ab] to-[#0369a1] hover:from-[#005591] hover:to-[#0284c7] disabled:opacity-60 text-white rounded-xl text-xs font-black shadow-sm transition cursor-pointer active:scale-[0.99]"
            >
                {isDeciding ? 'Đang hỏi...' : 'HỎI NGAY'}
            </button>
        </section>
    );
}
