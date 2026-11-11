import React, { useState, useEffect, useRef } from 'react';
import { Timer, Play, Pause, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import { playFeedbackTone, unlockSoundEngine } from '../../utils/randomUtils';
import { triggerConfettiBurst } from '../../utils/confettiBurst';
import CountdownDigitDisplay from './CountdownDigitDisplay';

interface Props {
    soundEnabled: boolean;
}

export default function CountdownTimerCard({ soundEnabled }: Props) {
    const [timerMode, setTimerMode] = useState<'minutes' | 'target_time'>('minutes');
    const [minutesInput, setMinutesInput] = useState<number>(5);
    const [targetTimeInput, setTargetTimeInput] = useState<string>(() => {
        const d = new Date(Date.now() + 10 * 60 * 1000);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });
    const [remainingSec, setRemainingSec] = useState<number>(300);
    const [timerRunning, setTimerRunning] = useState<boolean>(false);
    const [timerFinished, setTimerFinished] = useState<boolean>(false);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

    const cardRef = useRef<HTMLElement | null>(null);
    const endAtMsRef = useRef<number | null>(null);
    const lastBeepSecondRef = useRef<number | null>(null);

    useEffect(() => {
        const onFsChange = () => {
            setIsFullscreen(document.fullscreenElement === cardRef.current);
        };
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    useEffect(() => {
        if (!timerRunning) return;
        const tick = () => {
            if (!endAtMsRef.current) return;
            const left = Math.ceil((endAtMsRef.current - Date.now()) / 1000);
            if (left <= 0) {
                setRemainingSec(0);
                setTimerRunning(false);
                setTimerFinished(true);
                endAtMsRef.current = null;
                lastBeepSecondRef.current = null;
                if (soundEnabled) playFeedbackTone('alarm');
                triggerConfettiBurst({ originY: 0.55, particleCount: 95 });
            } else {
                setRemainingSec(left);
                if (soundEnabled && left <= 5 && lastBeepSecondRef.current !== left) {
                    lastBeepSecondRef.current = left;
                    playFeedbackTone('countdown_tick');
                }
            }
        };
        tick();
        const id = window.setInterval(tick, 250);
        return () => window.clearInterval(id);
    }, [timerRunning, soundEnabled]);

    const computeSecondsFromInputs = (): number => {
        if (timerMode === 'minutes') {
            return Math.max(1, Math.min(1440, minutesInput || 1)) * 60;
        }
        const [hhStr, mmStr] = (targetTimeInput || '00:00').split(':');
        const hh = parseInt(hhStr || '0', 10);
        const mm = parseInt(mmStr || '0', 10);
        const now = new Date();
        const target = new Date(now);
        target.setHours(hh, mm, 0, 0);
        if (target.getTime() <= now.getTime()) {
            target.setDate(target.getDate() + 1);
        }
        return Math.max(1, Math.round((target.getTime() - now.getTime()) / 1000));
    };

    const handleStart = () => {
        if (soundEnabled) unlockSoundEngine();
        setTimerFinished(false);
        lastBeepSecondRef.current = null;
        const secondsToRun =
            remainingSec > 0 && !timerFinished && endAtMsRef.current === null
                ? remainingSec
                : computeSecondsFromInputs();
        setRemainingSec(secondsToRun);
        endAtMsRef.current = Date.now() + secondsToRun * 1000;
        setTimerRunning(true);
    };

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement && cardRef.current) {
                await cardRef.current.requestFullscreen();
            } else if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
        } catch {
            // Trình duyệt không hỗ trợ Fullscreen
        }
    };

    return (
        <section
            ref={cardRef}
            className={`bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-3 ${
                isFullscreen ? 'justify-center max-w-none w-full h-full bg-[#f4f9fd]' : ''
            }`}
        >
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#0066ab] flex items-center justify-center shrink-0">
                        <Timer className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                        <h3 className="text-sm font-extrabold text-slate-900">Đếm Ngược</h3>
                        <p className="text-[11px] text-slate-600">Theo số phút hoặc mốc giờ cụ thể</p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[11px] font-bold">
                        <button
                            type="button"
                            disabled={timerRunning}
                            onClick={() => {
                                setTimerMode('minutes');
                                setTimerFinished(false);
                                endAtMsRef.current = null;
                                setRemainingSec(Math.max(1, minutesInput || 1) * 60);
                            }}
                            className={`px-2 py-1 rounded-md cursor-pointer ${timerMode === 'minutes' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'}`}
                        >
                            Số phút
                        </button>
                        <button
                            type="button"
                            disabled={timerRunning}
                            onClick={() => {
                                setTimerMode('target_time');
                                setTimerFinished(false);
                                endAtMsRef.current = null;
                            }}
                            className={`px-2 py-1 rounded-md cursor-pointer ${timerMode === 'target_time' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'}`}
                        >
                            Mốc giờ
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={toggleFullscreen}
                        aria-label={isFullscreen ? 'Thoát toàn màn hình đếm ngược' : 'Phóng to toàn màn hình đếm ngược'}
                        title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer"
                    >
                        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" /> : <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />}
                    </button>
                </div>
            </div>

            {timerMode === 'minutes' ? (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1 flex-wrap">
                        {[1, 3, 5, 10, 15].map(m => (
                            <button
                                key={m}
                                type="button"
                                disabled={timerRunning}
                                onClick={() => {
                                    setMinutesInput(m);
                                    setRemainingSec(m * 60);
                                    setTimerFinished(false);
                                    endAtMsRef.current = null;
                                }}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer disabled:opacity-50 ${
                                    minutesInput === m
                                        ? 'bg-[#0066ab] text-white border-[#0066ab]'
                                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                {m}p
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1">
                        <input
                            type="number"
                            aria-label="Số phút đếm ngược"
                            min={1}
                            max={1440}
                            disabled={timerRunning}
                            value={minutesInput}
                            onChange={e => {
                                const val = Math.max(1, Math.min(1440, parseInt(e.target.value || '1', 10)));
                                setMinutesInput(val);
                                setRemainingSec(val * 60);
                                setTimerFinished(false);
                                endAtMsRef.current = null;
                            }}
                            className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right tabular-nums"
                        />
                        <span className="text-[11px] font-bold text-slate-600">phút</span>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between gap-2">
                    <label htmlFor="mini-target-time" className="text-xs font-bold text-slate-700">
                        Đếm ngược tới mốc:
                    </label>
                    <input
                        id="mini-target-time"
                        type="time"
                        disabled={timerRunning}
                        value={targetTimeInput}
                        onChange={e => {
                            setTargetTimeInput(e.target.value);
                            setTimerFinished(false);
                            endAtMsRef.current = null;
                        }}
                        className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-900 tabular-nums"
                    />
                </div>
            )}

            <CountdownDigitDisplay
                remainingSec={remainingSec}
                timerFinished={timerFinished}
                isFullscreen={isFullscreen}
            />

            <div className="flex items-center gap-2">
                {!timerFinished && (
                    timerRunning ? (
                        <button
                            type="button"
                            onClick={() => {
                                setTimerRunning(false);
                                endAtMsRef.current = null;
                            }}
                            className="flex-1 py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>TẠM DỪNG</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleStart}
                            className="flex-1 py-2.5 px-3 bg-gradient-to-r from-[#0066ab] to-[#0369a1] hover:from-[#005591] hover:to-[#0284c7] text-white rounded-xl text-xs font-black inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                            <Play className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>BẮT ĐẦU</span>
                        </button>
                    )
                )}

                <button
                    type="button"
                    onClick={() => {
                        setTimerRunning(false);
                        setTimerFinished(false);
                        endAtMsRef.current = null;
                        lastBeepSecondRef.current = null;
                        setRemainingSec(computeSecondsFromInputs());
                    }}
                    aria-label="Đặt lại bộ đếm ngược"
                    className={`${timerFinished ? 'flex-1' : ''} px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer`}
                >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Đặt lại</span>
                </button>
            </div>
        </section>
    );
}
