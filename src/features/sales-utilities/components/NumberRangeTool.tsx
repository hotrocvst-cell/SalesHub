import React, { useState, useEffect, useRef } from 'react';
import { Hash, Play, Copy, Check, RotateCcw, AlertCircle } from 'lucide-react';
import type { NumberRangeConfig } from '../types';
import {
    drawNumbersInRange,
    playFeedbackTone,
    createSpinTicker,
    unlockSoundEngine
} from '../utils/randomUtils';
import { triggerConfettiBurst } from '../utils/confettiBurst';
import NumberRangeStage from './NumberRangeStage';

interface Props {
    config: NumberRangeConfig;
    soundEnabled: boolean;
    onChangeConfig: (next: NumberRangeConfig) => void;
    onSaveConfig: (next: NumberRangeConfig) => void;
    onRecordResult: (summary: string, payload: Record<string, unknown>) => void;
}

const PRESETS: Array<{ label: string; min: number; max: number; count: number }> = [
    { label: '1 – 10 (Lấy 1)', min: 1, max: 10, count: 1 },
    { label: '1 – 50 (Lấy 1)', min: 1, max: 50, count: 1 },
    { label: '1 – 100 (Lấy 3)', min: 1, max: 100, count: 3 },
    { label: '1 – 999 (Lấy 1)', min: 1, max: 999, count: 1 }
];

export default function NumberRangeTool({
    config,
    soundEnabled,
    onChangeConfig,
    onSaveConfig,
    onRecordResult
}: Props) {
    const [results, setResults] = useState<number[]>([]);
    const [lockedCount, setLockedCount] = useState<number>(0);
    const [isSpinning, setIsSpinning] = useState(false);
    const [copied, setCopied] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const intervalRef = useRef<number | null>(null);
    const timeoutsRef = useRef<number[]>([]);

    const clearAllTimers = () => {
        if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        timeoutsRef.current.forEach(id => window.clearTimeout(id));
        timeoutsRef.current = [];
    };

    useEffect(() => {
        return clearAllTimers;
    }, []);

    const lo = Math.min(config.min, config.max);
    const hi = Math.max(config.min, config.max);
    const totalRange = hi - lo + 1;

    const handleSpin = () => {
        if (isSpinning) return;
        setErrorMsg('');

        if (!Number.isFinite(config.min) || !Number.isFinite(config.max)) {
            setErrorMsg('Vui lòng nhập khoảng số hợp lệ.');
            return;
        }
        if (config.count < 1 || config.count > 200) {
            setErrorMsg('Số lượng mỗi lần quay nằm trong khoảng 1 đến 200.');
            return;
        }
        if (!config.allowDuplicate && config.count > totalRange) {
            setErrorMsg(`Khoảng ${lo}–${hi} chỉ có ${totalRange} số duy nhất. Hãy giảm số lượng hoặc cho phép trùng số.`);
            return;
        }

        if (soundEnabled) unlockSoundEngine();
        clearAllTimers();

        const finalNumbers = drawNumbersInRange(lo, hi, config.count, config.allowDuplicate);
        let currentLocked = 0;

        setIsSpinning(true);
        setLockedCount(0);
        setCopied(false);
        setResults(drawNumbersInRange(lo, hi, config.count, config.allowDuplicate));

        const spinTicker = soundEnabled ? createSpinTicker('slot', 85) : null;
        const lockTicker = soundEnabled ? createSpinTicker('ball', 25) : null;
        spinTicker?.tick();

        intervalRef.current = window.setInterval(() => {
            const spinningTail = drawNumbersInRange(lo, hi, finalNumbers.length, config.allowDuplicate);
            setResults(finalNumbers.map((val, idx) => (idx < currentLocked ? val : spinningTail[idx])));
            spinTicker?.tick();
        }, 75);

        const initialDelay = 800;
        const perBallDelay = finalNumbers.length <= 1
            ? 0
            : finalNumbers.length <= 12
                ? 130
                : Math.max(35, Math.round(1600 / finalNumbers.length));

        finalNumbers.forEach((_, idx) => {
            const lockTimer = window.setTimeout(() => {
                currentLocked = idx + 1;
                setLockedCount(currentLocked);
                setResults(prev => finalNumbers.map((val, i) => (i < currentLocked ? val : prev[i] ?? val)));

                if (currentLocked < finalNumbers.length) {
                    lockTicker?.tick();
                } else {
                    clearAllTimers();
                    setResults(finalNumbers);
                    setIsSpinning(false);
                    if (soundEnabled) playFeedbackTone('win');
                    triggerConfettiBurst({ originY: 0.42, particleCount: 75 });
                    onSaveConfig(config);
                    onRecordResult(
                        `Quay số (${lo}–${hi}, lấy ${finalNumbers.length}): ${finalNumbers.join(', ')}`,
                        { min: lo, max: hi, count: config.count, allowDuplicate: config.allowDuplicate, numbers: finalNumbers }
                    );
                }
            }, initialDelay + idx * perBallDelay);
            timeoutsRef.current.push(lockTimer);
        });
    };

    const handleKeyDownEnter = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSpin();
    };

    const handleCopy = () => {
        if (results.length === 0) return;
        navigator.clipboard.writeText(results.join(', '));
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#0066ab] flex items-center justify-center shrink-0">
                            <Hash className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                                Quay Số Ngẫu Nhiên Trực Tuyến
                            </h2>
                            <p className="text-xs text-slate-600 tabular-nums">
                                Sinh số bằng Crypto RNG công bằng • Khoảng {lo.toLocaleString('vi-VN')} – {hi.toLocaleString('vi-VN')}
                            </p>
                        </div>
                    </div>

                    {results.length > 0 && !isSpinning && (
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 inline-flex items-center gap-1.5 transition cursor-pointer"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                            <span>{copied ? 'Đã sao chép' : 'Sao chép kết quả'}</span>
                        </button>
                    )}
                </div>

                <NumberRangeStage results={results} lockedCount={lockedCount} isSpinning={isSpinning} />

                {errorMsg && (
                    <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                    <div>
                        <label htmlFor="nr-min" className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Số nhỏ nhất
                        </label>
                        <input
                            id="nr-min"
                            type="number"
                            value={config.min}
                            onKeyDown={handleKeyDownEnter}
                            onChange={e => onChangeConfig({ ...config, min: parseInt(e.target.value || '0', 10) })}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 tabular-nums outline-none focus:ring-2 focus:ring-[#0066ab] focus:bg-white"
                        />
                    </div>
                    <div>
                        <label htmlFor="nr-max" className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Số lớn nhất
                        </label>
                        <input
                            id="nr-max"
                            type="number"
                            value={config.max}
                            onKeyDown={handleKeyDownEnter}
                            onChange={e => onChangeConfig({ ...config, max: parseInt(e.target.value || '0', 10) })}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 tabular-nums outline-none focus:ring-2 focus:ring-[#0066ab] focus:bg-white"
                        />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label htmlFor="nr-count" className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Số lượng cần quay
                        </label>
                        <input
                            id="nr-count"
                            type="number"
                            min={1}
                            max={200}
                            value={config.count}
                            onKeyDown={handleKeyDownEnter}
                            onChange={e => onChangeConfig({ ...config, count: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 tabular-nums outline-none focus:ring-2 focus:ring-[#0066ab] focus:bg-white"
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {PRESETS.map(p => (
                            <button
                                key={p.label}
                                type="button"
                                onClick={() => onChangeConfig({ ...config, min: p.min, max: p.max, count: p.count })}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-sky-50 hover:text-[#0066ab] text-slate-800 border border-slate-200 transition cursor-pointer"
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={!config.allowDuplicate}
                            onChange={e => onChangeConfig({ ...config, allowDuplicate: !e.target.checked })}
                            className="w-4 h-4 rounded accent-[#0066ab] cursor-pointer"
                        />
                        <span>Không trùng số</span>
                    </label>
                </div>

                <div className="flex items-center gap-2 pt-1">
                    <button
                        type="button"
                        onClick={handleSpin}
                        disabled={isSpinning}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-[#0066ab] to-[#0369a1] hover:from-[#005591] hover:to-[#0284c7] disabled:opacity-60 text-white rounded-xl text-sm font-black inline-flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-[0.99]"
                    >
                        <Play className="w-4 h-4" aria-hidden="true" />
                        <span>{isSpinning ? 'Đang quay...' : 'QUAY NGAY'}</span>
                    </button>

                    {results.length > 0 && !isSpinning && (
                        <button
                            type="button"
                            onClick={() => setResults([])}
                            aria-label="Xóa kết quả số vừa quay"
                            className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
                            title="Xóa kết quả hiện tại"
                        >
                            <RotateCcw className="w-4 h-4" aria-hidden="true" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
