import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    Gift,
    RotateCcw,
    Eye,
    EyeOff,
    AlertCircle,
    Maximize2,
    Minimize2
} from 'lucide-react';
import type { GiftBoxConfig, GiftBoxInstance, GiftBoxRewardItem } from '../types';
import {
    secureShuffle,
    playFeedbackTone,
    createSpinTicker,
    unlockSoundEngine
} from '../utils/randomUtils';
import { triggerConfettiBurst } from '../utils/confettiBurst';
import LuckyResultModal from './LuckyResultModal';
import GiftBoxRewardsPanel from './GiftBoxRewardsPanel';

interface Props {
    config: GiftBoxConfig;
    soundEnabled: boolean;
    onChangeConfig: (next: GiftBoxConfig) => void;
    onSaveConfig: (next: GiftBoxConfig) => void;
    onRecordResult: (summary: string, payload: Record<string, unknown>) => void;
}

export function buildShuffledGiftBoxes(rewards: GiftBoxRewardItem[]): GiftBoxInstance[] {
    const flatPool: Array<{ rewardId: string; rewardName: string }> = [];
    rewards.forEach(rw => {
        const cleanName = rw.name.trim();
        const qty = Math.max(0, Math.min(50, Math.floor(Number(rw.quantity) || 0)));
        if (!cleanName || qty <= 0) return;
        for (let i = 0; i < qty; i++) {
            flatPool.push({ rewardId: rw.id, rewardName: cleanName });
        }
    });

    const shuffled = secureShuffle(flatPool);
    return shuffled.map((item, idx) => ({
        boxNumber: idx + 1,
        rewardId: item.rewardId,
        rewardName: item.rewardName,
        isOpened: false
    }));
}

export default function GiftBoxDrawTool({
    config,
    soundEnabled,
    onChangeConfig,
    onSaveConfig,
    onRecordResult
}: Props) {
    const boardCardRef = useRef<HTMLDivElement | null>(null);
    const openTimerRef = useRef<number | null>(null);

    const [newRewardName, setNewRewardName] = useState('');
    const [newRewardQty, setNewRewardQty] = useState(1);
    const [openingBoxNum, setOpeningBoxNum] = useState<number | null>(null);
    const [lastOpened, setLastOpened] = useState<GiftBoxInstance | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [hideOpenedBoxes, setHideOpenedBoxes] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const onFsChange = () => {
            setIsFullscreen(document.fullscreenElement === boardCardRef.current);
        };
        document.addEventListener('fullscreenchange', onFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', onFsChange);
            if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
        };
    }, []);

    const totalConfiguredCount = useMemo(
        () => config.rewards.reduce((sum, r) => sum + Math.max(0, Math.floor(Number(r.quantity) || 0)), 0),
        [config.rewards]
    );

    const openedBoxes = useMemo(() => config.boxes.filter(b => b.isOpened), [config.boxes]);
    const remainingCount = config.boxes.length - openedBoxes.length;
    const displayedBoxes = useMemo(
        () => (hideOpenedBoxes ? config.boxes.filter(b => !b.isOpened) : config.boxes),
        [config.boxes, hideOpenedBoxes]
    );

    const handleRegenerateBoxes = (rewardsList: GiftBoxRewardItem[]) => {
        if (openingBoxNum !== null) return;
        setErrorMsg('');
        const total = rewardsList.reduce((s, r) => s + Math.max(0, Math.floor(Number(r.quantity) || 0)), 0);
        if (total === 0) {
            setErrorMsg('Cần ít nhất 1 phần thưởng có số lượng lớn hơn 0.');
            return;
        }
        if (total > 80) {
            setErrorMsg('Tổng số hộp quà mỗi bàn nên từ 1 đến 80 hộp để hiển thị đẹp trên điện thoại.');
            return;
        }
        const boxes = buildShuffledGiftBoxes(rewardsList);
        const next: GiftBoxConfig = { ...config, rewards: rewardsList, boxes };
        setLastOpened(null);
        setShowModal(false);
        onChangeConfig(next);
        onSaveConfig(next);
    };

    const handleAddReward = () => {
        const clean = newRewardName.trim();
        if (!clean) {
            setErrorMsg('Vui lòng nhập tên phần thưởng.');
            return;
        }
        setErrorMsg('');
        const item: GiftBoxRewardItem = {
            id: `rw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: clean,
            quantity: Math.max(1, Math.min(50, Math.floor(newRewardQty || 1)))
        };
        setNewRewardName('');
        setNewRewardQty(1);
        handleRegenerateBoxes([...config.rewards, item]);
    };

    const handleUpdateReward = (id: string, field: 'name' | 'quantity', val: string | number) => {
        const nextRewards = config.rewards.map(r => {
            if (r.id !== id) return r;
            if (field === 'name') return { ...r, name: String(val) };
            return { ...r, quantity: Math.max(1, Math.min(50, Math.floor(Number(val) || 1))) };
        });
        onChangeConfig({ ...config, rewards: nextRewards });
    };

    const handleDeleteReward = (id: string) => {
        const nextRewards = config.rewards.filter(r => r.id !== id);
        if (nextRewards.length === 0) {
            onChangeConfig({ ...config, rewards: [], boxes: [] });
            onSaveConfig({ ...config, rewards: [], boxes: [] });
            return;
        }
        handleRegenerateBoxes(nextRewards);
    };

    const handleOpenBox = (boxNumber: number, btnEl: HTMLButtonElement) => {
        if (openingBoxNum !== null) return;
        const target = config.boxes.find(b => b.boxNumber === boxNumber);
        if (!target || target.isOpened) return;

        if (soundEnabled) unlockSoundEngine();
        const rect = btnEl.getBoundingClientRect();
        const originX = (rect.left + rect.width / 2) / Math.max(1, window.innerWidth);
        const originY = (rect.top + rect.height / 2) / Math.max(1, window.innerHeight);

        setOpeningBoxNum(boxNumber);
        const ticker = soundEnabled ? createSpinTicker('box', 25) : null;
        ticker?.tick();

        openTimerRef.current = window.setTimeout(() => {
            const openedBox: GiftBoxInstance = {
                ...target,
                isOpened: true,
                openedAt: new Date().toISOString()
            };
            const nextBoxes = config.boxes.map(b => (b.boxNumber === boxNumber ? openedBox : b));
            const nextCfg: GiftBoxConfig = { ...config, boxes: nextBoxes };

            setOpeningBoxNum(null);
            setLastOpened(openedBox);
            setShowModal(true);
            if (soundEnabled) playFeedbackTone('win');
            triggerConfettiBurst({ originX, originY, particleCount: 75 });

            onChangeConfig(nextCfg);
            onSaveConfig(nextCfg);
            onRecordResult(`Bốc thăm Hộp #${boxNumber}: ${openedBox.rewardName}`, {
                boxNumber,
                rewardName: openedBox.rewardName,
                openedCount: nextBoxes.filter(b => b.isOpened).length,
                totalBoxes: nextBoxes.length
            });
        }, 320);
    };

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement && boardCardRef.current) {
                await boardCardRef.current.requestFullscreen();
            } else if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
        } catch {
            // Trình duyệt không hỗ trợ fullscreen
        }
    };

    return (
        <>
            <div className={`grid grid-cols-1 ${config.hideSettingsDuringDraw ? '' : 'lg:grid-cols-[minmax(0,1fr)_330px]'} gap-4 items-start`}>
                <div
                    ref={boardCardRef}
                    className={`bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4 ${
                        isFullscreen ? 'overflow-y-auto max-w-none w-full h-full bg-[#f4f9fd]' : ''
                    }`}
                >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                            <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                                Bốc Thăm Trúng Thưởng
                            </h2>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 tabular-nums">
                                    {config.boxes.length} hộp quà
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-[#0066ab] border border-sky-200 tabular-nums">
                                    Còn lại: {remainingCount}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 tabular-nums">
                                    Đã mở: {openedBoxes.length}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setHideOpenedBoxes(v => !v)}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 cursor-pointer"
                            >
                                {hideOpenedBoxes ? 'Hiện hộp đã mở' : 'Ẩn hộp đã mở'}
                            </button>

                            <button
                                type="button"
                                onClick={() => handleRegenerateBoxes(config.rewards)}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center gap-1 transition cursor-pointer"
                                title="Đóng toàn bộ hộp và xáo trộn ngẫu nhiên lại"
                            >
                                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Trộn lại</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    const next = { ...config, hideSettingsDuringDraw: !config.hideSettingsDuringDraw };
                                    onChangeConfig(next);
                                    onSaveConfig(next);
                                }}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 inline-flex items-center gap-1 transition cursor-pointer"
                            >
                                {config.hideSettingsDuringDraw ? <Eye className="w-3.5 h-3.5" aria-hidden="true" /> : <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />}
                                <span>{config.hideSettingsDuringDraw ? 'Hiện quà' : 'Ẩn cài đặt'}</span>
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

                    {errorMsg && (
                        <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {displayedBoxes.length === 0 ? (
                        <div className="py-12 text-center rounded-2xl border border-dashed border-slate-300 bg-[#f4f9fd] text-xs text-slate-600">
                            {config.boxes.length === 0
                                ? <>Chưa có hộp quà nào. Hãy thêm phần thưởng và bấm <strong>Tạo &amp; Trộn Hộp Quà</strong>.</>
                                : 'Tất cả các hộp quà đã được mở hết! Bấm "Trộn lại" để bắt đầu lượt mới.'}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {displayedBoxes.map(box => (
                                box.isOpened ? (
                                    <div
                                        key={box.boxNumber}
                                        className="aspect-square rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 flex flex-col items-center justify-center text-center gap-1"
                                    >
                                        <span className="text-[10px] font-bold uppercase text-emerald-800 tabular-nums">
                                            Hộp #{box.boxNumber} • Đã mở
                                        </span>
                                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug break-words">
                                            {box.rewardName}
                                        </span>
                                    </div>
                                ) : (
                                    <button
                                        key={box.boxNumber}
                                        type="button"
                                        disabled={openingBoxNum !== null}
                                        onClick={e => handleOpenBox(box.boxNumber, e.currentTarget)}
                                        aria-label={`Mở hộp quà số ${box.boxNumber}`}
                                        className={`group aspect-square rounded-2xl bg-gradient-to-br from-[#0066ab] to-[#0284c7] hover:from-[#005591] hover:to-[#0369a1] text-white p-3 flex flex-col items-center justify-center gap-1.5 shadow-md hover:-translate-y-1 active:scale-[0.97] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#12c3f4] ${
                                            openingBoxNum === box.boxNumber ? 'gift-opening' : ''
                                        }`}
                                    >
                                        <Gift
                                            className="w-10 h-10 text-white/95 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
                                            aria-hidden="true"
                                        />
                                        <span className="text-sm font-black tracking-wide tabular-nums">#{box.boxNumber}</span>
                                        <span className="text-[10.5px] font-bold text-sky-100">
                                            {openingBoxNum === box.boxNumber ? 'Đang mở...' : 'Chạm mở quà'}
                                        </span>
                                    </button>
                                )
                            ))}
                        </div>
                    )}
                </div>

                {!config.hideSettingsDuringDraw && (
                    <GiftBoxRewardsPanel
                        rewards={config.rewards}
                        totalConfiguredCount={totalConfiguredCount}
                        newRewardName={newRewardName}
                        newRewardQty={newRewardQty}
                        onChangeNewName={setNewRewardName}
                        onChangeNewQty={setNewRewardQty}
                        onAddReward={handleAddReward}
                        onUpdateReward={handleUpdateReward}
                        onDeleteReward={handleDeleteReward}
                        onRegenerate={() => handleRegenerateBoxes(config.rewards)}
                    />
                )}
            </div>

            <LuckyResultModal
                isOpen={showModal && Boolean(lastOpened)}
                badgeLabel={lastOpened ? `Hộp #${lastOpened.boxNumber}` : 'Bốc thăm'}
                titleLabel="Phần quà bên trong hộp bạn vừa chọn:"
                resultText={lastOpened?.rewardName || ''}
                onClose={() => setShowModal(false)}
            />
        </>
    );
}
