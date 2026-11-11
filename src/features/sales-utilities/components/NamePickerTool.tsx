import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Play,
    RotateCcw,
    Settings2,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Maximize2,
    Minimize2
} from 'lucide-react';
import type { EmployeeItem } from '../../../core/lib/storage';
import { getShortenedEmployeeName } from '../../../core/lib/formatters';
import type { NamePickerConfig } from '../types';
import {
    parseLinesList,
    secureRandomInt,
    playFeedbackTone,
    createSpinTicker,
    unlockSoundEngine
} from '../utils/randomUtils';
import { triggerConfettiBurst } from '../utils/confettiBurst';
import NamePickerSettingsPanel from './NamePickerSettingsPanel';

interface Props {
    config: NamePickerConfig;
    storeEmployees: EmployeeItem[];
    storeLabel: string;
    soundEnabled: boolean;
    onChangeConfig: (next: NamePickerConfig) => void;
    onSaveConfig: (next: NamePickerConfig) => void;
    onRecordResult: (summary: string, payload: Record<string, unknown>) => void;
}

export default function NamePickerTool({
    config,
    storeEmployees,
    storeLabel,
    soundEnabled,
    onChangeConfig,
    onSaveConfig,
    onRecordResult
}: Props) {
    const [showSettings, setShowSettings] = useState(true);
    const [isSpinning, setIsSpinning] = useState(false);
    const [displayCandidate, setDisplayCandidate] = useState<string>('');
    const [winner, setWinner] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);

    const stageCardRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);

    const cancelSpinRaf = () => {
        if (rafRef.current !== null) {
            window.cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    };

    useEffect(() => {
        const onFsChange = () => {
            setIsFullscreen(document.fullscreenElement === stageCardRef.current);
        };
        document.addEventListener('fullscreenchange', onFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', onFsChange);
            cancelSpinRaf();
        };
    }, []);

    const allItems = useMemo(() => parseLinesList(config.rawItemsText), [config.rawItemsText]);
    const excludedSet = useMemo(() => new Set(config.excludedWinners || []), [config.excludedWinners]);
    const eligibleItems = useMemo(() => {
        if (!config.removeWinnerAfterDraw) return allItems;
        return allItems.filter(item => !excludedSet.has(item));
    }, [allItems, config.removeWinnerAfterDraw, excludedSet]);

    const handleLoadStoreEmployees = () => {
        if (storeEmployees.length === 0) {
            setErrorMsg(`ST ${storeLabel} chưa có nhân sự nào trong danh bạ hệ thống.`);
            return;
        }
        setErrorMsg('');
        const lines = storeEmployees.map(e => `${e.employee_id} - ${getShortenedEmployeeName(e.full_name || '')}`);
        const next: NamePickerConfig = { ...config, rawItemsText: lines.join('\n'), excludedWinners: [] };
        onChangeConfig(next);
        onSaveConfig(next);
    };

    const handleSpin = () => {
        if (isSpinning) return;
        setErrorMsg('');
        if (eligibleItems.length === 0) {
            setErrorMsg(
                allItems.length === 0
                    ? 'Vui lòng nhập ít nhất 1 tên/mã vào danh sách ở phần cài đặt.'
                    : 'Tất cả các mục trong danh sách đã trúng lượt trước. Hãy bấm "Khôi phục danh sách" để quay tiếp.'
            );
            return;
        }

        if (soundEnabled) unlockSoundEngine();
        cancelSpinRaf();

        if (eligibleItems.length === 1) {
            const single = eligibleItems[0];
            setDisplayCandidate(single);
            setWinner(single);
            if (soundEnabled) playFeedbackTone('win');
            triggerConfettiBurst({ originY: 0.44, particleCount: 75 });
            const nextCfg = config.removeWinnerAfterDraw
                ? { ...config, excludedWinners: [...(config.excludedWinners || []), single] }
                : config;
            onChangeConfig(nextCfg);
            onSaveConfig(nextCfg);
            onRecordResult(`Quay ngẫu nhiên: ${single}`, { winner: single, poolSize: 1 });
            return;
        }

        setIsSpinning(true);
        setWinner('');

        const winnerIdx = secureRandomInt(0, eligibleItems.length - 1);
        const chosen = eligibleItems[winnerIdx];
        const ticker = soundEnabled ? createSpinTicker('slot', 45) : null;

        const durationMs = 2400;
        const startTime = performance.now();
        let lastSwitchAt = 0;
        let lastCandidate = '';

        const step = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / durationMs);

            const intervalMs = 55 + Math.pow(progress, 3) * 220;
            if (now - lastSwitchAt >= intervalMs) {
                lastSwitchAt = now;
                let randItem = eligibleItems[secureRandomInt(0, eligibleItems.length - 1)];
                if (eligibleItems.length > 1 && randItem === lastCandidate) {
                    randItem = eligibleItems[(eligibleItems.indexOf(randItem) + 1) % eligibleItems.length];
                }
                lastCandidate = randItem;
                setDisplayCandidate(randItem);
                ticker?.tick();
            }

            if (progress < 1) {
                rafRef.current = window.requestAnimationFrame(step);
            } else {
                rafRef.current = null;
                setDisplayCandidate(chosen);
                setWinner(chosen);
                setIsSpinning(false);
                if (soundEnabled) playFeedbackTone('win');
                triggerConfettiBurst({ originY: 0.45, particleCount: 95 });

                const nextCfg = config.removeWinnerAfterDraw
                    ? { ...config, excludedWinners: [...(config.excludedWinners || []), chosen] }
                    : config;
                onChangeConfig(nextCfg);
                onSaveConfig(nextCfg);
                onRecordResult(`Quay ngẫu nhiên: ${chosen}`, {
                    winner: chosen,
                    remainingCount: Math.max(0, eligibleItems.length - (config.removeWinnerAfterDraw ? 1 : 0))
                });
            }
        };

        rafRef.current = window.requestAnimationFrame(step);
    };

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement && stageCardRef.current) {
                await stageCardRef.current.requestFullscreen();
            } else if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
        } catch {
            // Không hỗ trợ fullscreen
        }
    };

    return (
        <div className="space-y-4">
            <div
                ref={stageCardRef}
                className={`bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4 ${
                    isFullscreen ? 'flex flex-col justify-center max-w-none w-full h-full bg-[#f4f9fd]' : ''
                }`}
            >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                        <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                            Quay Ngẫu Nhiên Theo Danh Sách
                        </h2>
                        <p className="text-xs text-slate-600 tabular-nums">
                            Khả dụng: <strong className="text-[#0066ab]">{eligibleItems.length}</strong> / {allItems.length} mục
                            {config.excludedWinners?.length > 0 && ` • Đã trúng: ${config.excludedWinners.length}`}
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setShowSettings(s => !s)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 inline-flex items-center gap-1.5 transition cursor-pointer"
                        >
                            <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{showSettings ? 'Ẩn cài đặt' : 'Cài đặt'}</span>
                            {showSettings ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
                        </button>

                        <button
                            type="button"
                            onClick={toggleFullscreen}
                            aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Phóng to toàn màn hình'}
                            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer"
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" aria-hidden="true" /> : <Maximize2 className="w-4 h-4" aria-hidden="true" />}
                        </button>
                    </div>
                </div>

                <div className="relative p-3.5 sm:p-5 rounded-[26px] bg-gradient-to-br from-[#0066ab] to-[#0284c7] shadow-lg">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-2 rounded-[20px] border-[3px] border-dotted border-white/75"
                    />
                    <div className={`relative z-10 bg-white rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-2 shadow-inner ${isFullscreen ? 'min-h-[300px]' : 'min-h-[175px] sm:min-h-[210px]'}`}>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                            {isSpinning ? 'Đang quay chọn ngẫu nhiên...' : winner ? 'Chúc mừng người được chọn' : 'Sẵn sàng quay'}
                        </span>
                        <div
                            key={winner ? `win-${winner}` : 'rolling'}
                            className={`font-black tracking-tight break-words max-w-full ${
                                isFullscreen ? 'text-4xl sm:text-6xl' : 'text-2xl sm:text-4xl'
                            } ${
                                isSpinning
                                    ? 'vt-shake text-[#0284c7]'
                                    : winner
                                        ? 'yn-reveal-pop text-[#0066ab]'
                                        : 'text-slate-400'
                            }`}
                        >
                            {displayCandidate || 'Nhấn QUAY NGAY bên dưới'}
                        </div>
                    </div>
                </div>

                {errorMsg && (
                    <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={handleSpin}
                        disabled={isSpinning}
                        className="flex-1 min-w-[180px] py-3 px-4 bg-gradient-to-r from-[#0066ab] to-[#0369a1] hover:from-[#005591] hover:to-[#0284c7] disabled:opacity-60 text-white rounded-xl text-sm font-black inline-flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-[0.99]"
                    >
                        <Play className="w-4 h-4" aria-hidden="true" />
                        <span>{isSpinning ? 'Đang quay...' : 'QUAY NGAY'}</span>
                    </button>

                    {(config.excludedWinners?.length || 0) > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                if (isSpinning) return;
                                const next: NamePickerConfig = { ...config, excludedWinners: [] };
                                onChangeConfig(next);
                                onSaveConfig(next);
                                setErrorMsg('');
                            }}
                            disabled={isSpinning}
                            className="px-3.5 py-3 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center gap-1.5 transition cursor-pointer"
                        >
                            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Đặt lại đã trúng ({config.excludedWinners.length})</span>
                        </button>
                    )}
                </div>

                {(config.excludedWinners?.length || 0) > 0 && (
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-600 mr-1">
                            Đã trúng ({config.excludedWinners.length}):
                        </span>
                        {config.excludedWinners.map((item, idx) => (
                            <span
                                key={`${item}-${idx}`}
                                className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-[#0066ab] border border-sky-200"
                            >
                                {item}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {showSettings && (
                <NamePickerSettingsPanel
                    config={config}
                    storeLabel={storeLabel}
                    storeEmployeesCount={storeEmployees.length}
                    onChangeConfig={onChangeConfig}
                    onSaveConfig={onSaveConfig}
                    onLoadStoreEmployees={handleLoadStoreEmployees}
                />
            )}
        </div>
    );
}
