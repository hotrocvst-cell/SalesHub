import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    RotateCcw,
    AlertCircle,
    Eye,
    EyeOff,
    Maximize2,
    Minimize2,
    Disc3
} from 'lucide-react';
import type { EmployeeItem } from '../../../core/lib/storage';
import { getShortenedEmployeeName } from '../../../core/lib/formatters';
import type { LuckyWheelConfig } from '../types';
import {
    parseLinesList,
    secureRandomInt,
    playFeedbackTone,
    createSpinTicker,
    unlockSoundEngine
} from '../utils/randomUtils';
import { triggerConfettiBurst } from '../utils/confettiBurst';
import { drawWheelCanvas } from '../utils/wheelCanvasRenderer';
import LuckyResultModal from './LuckyResultModal';
import LuckyWheelSettingsPanel from './LuckyWheelSettingsPanel';

interface Props {
    config: LuckyWheelConfig;
    storeEmployees: EmployeeItem[];
    storeLabel: string;
    soundEnabled: boolean;
    onChangeConfig: (next: LuckyWheelConfig) => void;
    onSaveConfig: (next: LuckyWheelConfig) => void;
    onRecordResult: (summary: string, payload: Record<string, unknown>) => void;
}

export default function LuckyWheelTool({
    config,
    storeEmployees,
    storeLabel,
    soundEnabled,
    onChangeConfig,
    onSaveConfig,
    onRecordResult
}: Props) {
    const stageCardRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rotationRef = useRef<number>(0);
    const animFrameRef = useRef<number | null>(null);
    const nextSpinTimerRef = useRef<number | null>(null);

    const [isSpinning, setIsSpinning] = useState(false);
    const [winner, setWinner] = useState<string>('');
    const [showModal, setShowModal] = useState(false);
    const [recentWinners, setRecentWinners] = useState<string[]>([]);
    const [spinDurationSec, setSpinDurationSec] = useState<number>(5);
    const [errorMsg, setErrorMsg] = useState('');
    const [hideEditor, setHideEditor] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const allItems = useMemo(() => parseLinesList(config.rawItemsText), [config.rawItemsText]);
    const excludedSet = useMemo(() => new Set(config.excludedWinners || []), [config.excludedWinners]);
    const wheelItems = useMemo(() => {
        if (!config.removeWinnerAfterSpin) return allItems;
        return allItems.filter(item => !excludedSet.has(item));
    }, [allItems, config.removeWinnerAfterSpin, excludedSet]);

    const renderCurrentWheel = useCallback(() => {
        if (canvasRef.current) {
            drawWheelCanvas(canvasRef.current, wheelItems, rotationRef.current);
        }
    }, [wheelItems]);

    useEffect(() => {
        renderCurrentWheel();
        window.addEventListener('resize', renderCurrentWheel);
        return () => window.removeEventListener('resize', renderCurrentWheel);
    }, [renderCurrentWheel, hideEditor, isFullscreen]);

    useEffect(() => {
        const onFsChange = () => {
            setIsFullscreen(document.fullscreenElement === stageCardRef.current);
        };
        document.addEventListener('fullscreenchange', onFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', onFsChange);
            if (animFrameRef.current) window.cancelAnimationFrame(animFrameRef.current);
            if (nextSpinTimerRef.current) window.clearTimeout(nextSpinTimerRef.current);
        };
    }, []);

    const handleSpin = () => {
        if (isSpinning) return;
        setErrorMsg('');

        if (wheelItems.length < 2) {
            setErrorMsg(
                allItems.length < 2
                    ? 'Cần ít nhất 2 mục (mỗi dòng một mục) để quay Vòng quay may mắn.'
                    : 'Số mục còn lại ít hơn 2. Hãy bấm "Khôi phục danh sách" để quay lượt mới.'
            );
            return;
        }

        if (soundEnabled) unlockSoundEngine();

        const winnerIdx = secureRandomInt(0, wheelItems.length - 1);
        const chosen = wheelItems[winnerIdx];
        const sliceAngle = (Math.PI * 2) / wheelItems.length;
        const jitterRatio = (secureRandomInt(0, 100) / 100 - 0.5) * 0.55;
        const innerOffset = jitterRatio * sliceAngle;

        const twoPi = Math.PI * 2;
        const currentMod = ((rotationRef.current % twoPi) + twoPi) % twoPi;
        const desiredRaw = -Math.PI / 2 - (winnerIdx + 0.5) * sliceAngle + innerOffset;
        const desiredMod = ((desiredRaw % twoPi) + twoPi) % twoPi;
        const deltaMod = (desiredMod - currentMod + twoPi) % twoPi;

        const extraSpins = Math.max(6, Math.round(spinDurationSec * 2.2));
        const startRotation = rotationRef.current;
        const targetRotation = startRotation + extraSpins * twoPi + deltaMod;

        const durationMs = spinDurationSec * 1000;
        const startTime = performance.now();
        let lastSliceIndex = Math.floor((startRotation + Math.PI / 2) / sliceAngle);
        const ticker = soundEnabled ? createSpinTicker('wheel', 24) : null;

        setIsSpinning(true);
        setShowModal(false);
        setWinner('');

        const step = (now: number) => {
            const elapsed = now - startTime;
            const t = Math.min(1, elapsed / durationMs);
            const eased = 1 - Math.pow(1 - t, 3.2);
            rotationRef.current = startRotation + (targetRotation - startRotation) * eased;

            const currentSliceIndex = Math.floor((rotationRef.current + Math.PI / 2) / sliceAngle);
            if (currentSliceIndex !== lastSliceIndex) {
                lastSliceIndex = currentSliceIndex;
                ticker?.tick();
            }

            renderCurrentWheel();

            if (t < 1) {
                animFrameRef.current = window.requestAnimationFrame(step);
            } else {
                animFrameRef.current = null;
                rotationRef.current = targetRotation;
                renderCurrentWheel();
                setIsSpinning(false);
                setWinner(chosen);
                setShowModal(true);
                setRecentWinners(prev => [chosen, ...prev].slice(0, 8));
                if (soundEnabled) playFeedbackTone('win');
                triggerConfettiBurst({ originY: 0.48, particleCount: 95 });

                const nextCfg = config.removeWinnerAfterSpin
                    ? { ...config, excludedWinners: [...(config.excludedWinners || []), chosen] }
                    : config;
                onChangeConfig(nextCfg);
                onSaveConfig(nextCfg);
                onRecordResult(`Vòng quay may mắn: ${chosen}`, {
                    winner: chosen,
                    sliceCount: wheelItems.length
                });
            }
        };

        animFrameRef.current = window.requestAnimationFrame(step);
    };

    const handleSpinRef = useRef(handleSpin);
    handleSpinRef.current = handleSpin;

    const handleSpinNextFromModal = () => {
        setShowModal(false);
        if (nextSpinTimerRef.current) window.clearTimeout(nextSpinTimerRef.current);
        nextSpinTimerRef.current = window.setTimeout(() => {
            handleSpinRef.current();
        }, 250);
    };

    const handleLoadStoreEmployees = () => {
        if (storeEmployees.length === 0) {
            setErrorMsg(`ST ${storeLabel} chưa có nhân sự nào trong danh bạ hệ thống.`);
            return;
        }
        setErrorMsg('');
        const lines = storeEmployees.map(e => `${e.employee_id} - ${getShortenedEmployeeName(e.full_name || '')}`);
        const next: LuckyWheelConfig = { ...config, rawItemsText: lines.join('\n'), excludedWinners: [] };
        onChangeConfig(next);
        onSaveConfig(next);
    };

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement && stageCardRef.current) {
                await stageCardRef.current.requestFullscreen();
            } else if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
        } catch {
            // Trình duyệt không hỗ trợ Fullscreen
        }
    };

    return (
        <>
            <div className={`grid grid-cols-1 ${hideEditor ? '' : 'lg:grid-cols-[minmax(0,1fr)_330px]'} gap-4 items-start`}>
                <div
                    ref={stageCardRef}
                    className={`bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4 ${
                        isFullscreen ? 'flex flex-col justify-center max-w-none w-full h-full bg-[#f4f9fd]' : ''
                    }`}
                >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#0066ab] flex items-center justify-center shrink-0">
                                <Disc3 className="w-4 h-4" aria-hidden="true" />
                            </div>
                            <div>
                                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                                    Vòng Quay May Mắn
                                </h2>
                                <p className="text-xs text-slate-600 tabular-nums">
                                    <strong className="text-[#0066ab]">{wheelItems.length}</strong> / {allItems.length} mục • Chạm <strong>QUAY</strong> ở tâm vòng
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setHideEditor(h => !h)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 inline-flex items-center gap-1.5 transition cursor-pointer"
                            >
                                {hideEditor ? <Eye className="w-3.5 h-3.5" aria-hidden="true" /> : <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />}
                                <span>{hideEditor ? 'Hiện cài đặt' : 'Ẩn cài đặt'}</span>
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

                    <div className="flex flex-col items-center gap-4 py-2">
                        <div className={`relative flex items-center justify-center ${
                            isFullscreen
                                ? 'w-[340px] h-[340px] sm:w-[480px] sm:h-[480px]'
                                : 'w-[300px] h-[300px] sm:w-[390px] sm:h-[390px]'
                        }`}>
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 36 42"
                                className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-8 h-9 drop-shadow-md"
                            >
                                <path d="M18 40 L3 14 A15 15 0 1 1 33 14 Z" fill="#0066ab" stroke="#ffffff" strokeWidth="2.5" />
                                <circle cx="18" cy="14" r="5" fill="#ffffff" />
                            </svg>

                            <canvas
                                ref={canvasRef}
                                aria-label="Vòng quay may mắn"
                                className="w-full h-full block rounded-full ring-4 ring-white shadow-[0_14px_38px_rgba(0,102,171,0.24)] border-2 border-sky-200"
                            />

                            <button
                                type="button"
                                onClick={handleSpin}
                                disabled={isSpinning}
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[#0066ab] to-[#0284c7] hover:from-[#005591] hover:to-[#0369a1] disabled:opacity-85 text-white border-[5px] border-white shadow-xl font-black text-sm sm:text-base tracking-wide flex items-center justify-center transition cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#12c3f4]"
                            >
                                {isSpinning ? '...' : 'QUAY'}
                            </button>
                        </div>

                        {winner && !isSpinning && (
                            <div className="yn-reveal-pop w-full max-w-md rounded-2xl bg-[#f4f9fd] border border-sky-200 px-4 py-3 text-center space-y-0.5">
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0066ab] block">
                                    Kết quả lượt vừa quay
                                </span>
                                <div className="text-lg sm:text-xl font-black text-slate-900 break-words">{winner}</div>
                            </div>
                        )}

                        {recentWinners.length > 0 && (
                            <div className="w-full pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-bold text-slate-500 mr-1">Gần nhất:</span>
                                {recentWinners.map((item, idx) => (
                                    <span
                                        key={`${item}-${idx}`}
                                        className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-[#0066ab] border border-sky-200"
                                    >
                                        {item}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {errorMsg && (
                        <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {(config.excludedWinners?.length || 0) > 0 && (
                        <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-900 flex-wrap">
                            <span>Đã loại tạm <strong>{config.excludedWinners.length}</strong> mục vừa trúng.</span>
                            <button
                                type="button"
                                disabled={isSpinning}
                                onClick={() => {
                                    const next = { ...config, excludedWinners: [] };
                                    onChangeConfig(next);
                                    onSaveConfig(next);
                                }}
                                className="font-bold text-amber-950 hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Khôi phục danh sách</span>
                            </button>
                        </div>
                    )}
                </div>

                {!hideEditor && (
                    <LuckyWheelSettingsPanel
                        config={config}
                        isSpinning={isSpinning}
                        storeLabel={storeLabel}
                        storeEmployeesCount={storeEmployees.length}
                        spinDurationSec={spinDurationSec}
                        onChangeDuration={setSpinDurationSec}
                        onChangeConfig={onChangeConfig}
                        onSaveConfig={onSaveConfig}
                        onLoadStoreEmployees={handleLoadStoreEmployees}
                    />
                )}
            </div>

            <LuckyResultModal
                isOpen={showModal && Boolean(winner)}
                badgeLabel="Vòng quay may mắn"
                titleLabel="Xin chúc mừng kết quả vừa quay:"
                resultText={winner}
                primaryActionLabel={wheelItems.length >= 2 ? 'Quay tiếp' : undefined}
                onPrimaryAction={wheelItems.length >= 2 ? handleSpinNextFromModal : undefined}
                onClose={() => setShowModal(false)}
            />
        </>
    );
}
