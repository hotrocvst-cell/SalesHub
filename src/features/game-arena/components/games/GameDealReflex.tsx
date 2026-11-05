import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Trophy, Zap, ArrowLeft, Send, Flame, Bomb } from 'lucide-react';

interface GameDealReflexProps {
    onFinishGame: (score: number, metadata: Record<string, any>) => void;
    onBack: () => void;
    personalBest?: number;
}

interface TargetItem {
    id: string;
    type: 'order' | 'voucher' | 'kpi' | 'accessory' | 'bomb' | 'complaint';
    label: string;
    points: number;
    icon: string;
    bgClass: string;
    borderClass: string;
    textClass: string;
}

const TARGET_TYPES: TargetItem[] = [
    { id: 'kpi', type: 'kpi', label: 'KPI Ngôi Sao', points: 30, icon: '⭐', bgClass: 'bg-amber-100', borderClass: 'border-amber-400', textClass: 'text-amber-700' },
    { id: 'order', type: 'order', label: 'Đơn Hàng VIP', points: 20, icon: '🎯', bgClass: 'bg-emerald-100', borderClass: 'border-emerald-400', textClass: 'text-emerald-700' },
    { id: 'voucher', type: 'voucher', label: 'Voucher 100k', points: 15, icon: '🎁', bgClass: 'bg-purple-100', borderClass: 'border-purple-400', textClass: 'text-purple-700' },
    { id: 'acc', type: 'accessory', label: 'Combo Phụ Kiện', points: 10, icon: '💎', bgClass: 'bg-blue-100', borderClass: 'border-blue-400', textClass: 'text-blue-700' },
    { id: 'bomb', type: 'bomb', label: 'Hủy Đơn', points: -25, icon: '💣', bgClass: 'bg-red-100', borderClass: 'border-red-400', textClass: 'text-red-700' },
    { id: 'complaint', type: 'complaint', label: 'Khách Khó Tính', points: -15, icon: '⚠️', bgClass: 'bg-orange-100', borderClass: 'border-orange-400', textClass: 'text-orange-700' },
];

export default function GameDealReflex({ onFinishGame, onBack, personalBest = 0 }: GameDealReflexProps) {
    const [timeLeft, setTimeLeft] = useState(60);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [maxCombo, setMaxCombo] = useState(0);
    const [hits, setHits] = useState(0);
    const [misses, setMisses] = useState(0);
    const [grid, setGrid] = useState<(TargetItem | null)[]>(Array(9).fill(null));
    const [floatingPoints, setFloatingPoints] = useState<{ [cellIndex: number]: { text: string; color: string } }>({});
    const [isGameOver, setIsGameOver] = useState(false);
    const [isStarted, setIsStarted] = useState(false);

    const timerRef = useRef<any>(null);
    const spawnTimerRef = useRef<any>(null);

    // Bắt đầu game
    const handleStart = () => {
        setTimeLeft(60);
        setScore(0);
        setCombo(0);
        setMaxCombo(0);
        setHits(0);
        setMisses(0);
        setGrid(Array(9).fill(null));
        setIsGameOver(false);
        setIsStarted(true);
    };

    // Vòng lặp đếm ngược 60 giây
    useEffect(() => {
        if (!isStarted || isGameOver) return;
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    setIsGameOver(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [isStarted, isGameOver]);

    // Vòng lặp xuất hiện item ngẫu nhiên
    const spawnItem = useCallback(() => {
        if (!isStarted || isGameOver) return;

        setGrid(prevGrid => {
            const nextGrid = [...prevGrid];
            // Tìm ô trống
            const emptyIndices = nextGrid.map((item, idx) => (item === null ? idx : -1)).filter(idx => idx !== -1);
            if (emptyIndices.length === 0) return prevGrid;

            const randomCell = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
            // Tỷ lệ xuất hiện: 75% tích cực, 25% bẫy
            const isTrap = Math.random() < 0.25;
            const pool = isTrap ? TARGET_TYPES.filter(t => t.points < 0) : TARGET_TYPES.filter(t => t.points > 0);
            const target = pool[Math.floor(Math.random() * pool.length)];

            nextGrid[randomCell] = target;
            return nextGrid;
        });
    }, [isStarted, isGameOver]);

    useEffect(() => {
        if (!isStarted || isGameOver) return;
        spawnTimerRef.current = setInterval(spawnItem, 750);
        return () => clearInterval(spawnTimerRef.current);
    }, [isStarted, isGameOver, spawnItem]);

    // Xử lý khi chạm vào ô
    const handleCellClick = (index: number) => {
        if (!isStarted || isGameOver) return;

        const target = grid[index];
        if (!target) return;

        let gained = target.points;
        let isPositive = gained > 0;

        // Tính thưởng combo
        if (isPositive) {
            const nextCombo = combo + 1;
            setCombo(nextCombo);
            if (nextCombo > maxCombo) setMaxCombo(nextCombo);
            setHits(prev => prev + 1);

            if (nextCombo >= 10) gained = Math.round(gained * 2);
            else if (nextCombo >= 5) gained = Math.round(gained * 1.5);
        } else {
            setCombo(0);
            setMisses(prev => prev + 1);
        }

        // Cập nhật điểm
        setScore(prev => Math.max(0, prev + gained));

        // Hiệu ứng số nổi
        setFloatingPoints(prev => ({
            ...prev,
            [index]: {
                text: `${gained > 0 ? '+' : ''}${gained}`,
                color: isPositive ? 'text-emerald-500' : 'text-red-500'
            }
        }));

        setTimeout(() => {
            setFloatingPoints(prev => {
                const next = { ...prev };
                delete next[index];
                return next;
            });
        }, 500);

        // Xóa item khỏi ô
        setGrid(prev => {
            const next = [...prev];
            next[index] = null;
            return next;
        });
    };

    const handleFinishAndSave = () => {
        onFinishGame(score, {
            hits,
            misses,
            max_combo: maxCombo,
            accuracy: hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0
        });
    };

    return (
        <div className="max-w-md mx-auto flex flex-col items-center">
            {/* Thanh điều khiển trên cùng */}
            <div className="w-full flex items-center justify-between mb-3 px-1">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Rời game</span>
                </button>

                <div className="flex items-center gap-2">
                    {/* Thời gian */}
                    <div className="bg-red-50 border border-red-200 rounded-lg px-2.5 py-1 text-center min-w-[65px]">
                        <div className="text-[10px] uppercase font-bold text-red-700 leading-none">Thời gian</div>
                        <div className="text-base font-black font-mono text-red-900 leading-tight">{timeLeft}s</div>
                    </div>

                    {/* Điểm số */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 text-center min-w-[70px]">
                        <div className="text-[10px] uppercase font-bold text-amber-700 leading-none">Điểm</div>
                        <div className="text-base font-black font-mono text-amber-900 leading-tight">{score}</div>
                    </div>

                    {/* Kỷ lục */}
                    <div className="bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-center min-w-[65px]">
                        <div className="text-[10px] uppercase font-bold text-slate-500 leading-none flex items-center justify-center gap-0.5">
                            <Trophy className="w-2.5 h-2.5 text-amber-500" /> Kỷ lục
                        </div>
                        <div className="text-base font-black font-mono text-slate-800 leading-tight">{personalBest}</div>
                    </div>
                </div>
            </div>

            {/* Thông số Combo */}
            <div className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-1.5 mb-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                    <Flame className={`w-4 h-4 ${combo >= 5 ? 'text-orange-500 animate-pulse' : 'text-slate-400'}`} />
                    <span className="text-xs text-slate-600">Chuỗi Combo:</span>
                    <span className={`text-xs font-black ${combo >= 10 ? 'text-orange-600' : combo >= 5 ? 'text-amber-600' : 'text-slate-700'}`}>
                        x{combo} {combo >= 10 ? '🔥 x2 Điểm' : combo >= 5 ? '⚡ x1.5 Điểm' : ''}
                    </span>
                </div>
                <div className="text-[11px] text-slate-400">Bắt đúng: <span className="font-bold text-emerald-600">{hits}</span></div>
            </div>

            {/* Lưới 3x3 Chơi Game */}
            <div className="relative bg-slate-800 p-3 rounded-2xl shadow-xl w-full aspect-square max-w-[360px] select-none">
                <div className="grid grid-cols-3 grid-rows-3 gap-2.5 h-full w-full">
                    {grid.map((target, idx) => {
                        const float = floatingPoints[idx];
                        return (
                            <button
                                key={idx}
                                onClick={() => handleCellClick(idx)}
                                disabled={!isStarted || isGameOver}
                                className={`relative rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-150 active:scale-95 ${
                                    target
                                        ? `${target.bgClass} ${target.borderClass} shadow-md`
                                        : 'bg-slate-700/40 border-slate-600/40'
                                }`}
                            >
                                {target && (
                                    <>
                                        <span className="text-2xl sm:text-3xl filter drop-shadow">{target.icon}</span>
                                        <span className={`text-[9.5px] font-black leading-none mt-1 ${target.textClass}`}>
                                            {target.label}
                                        </span>
                                    </>
                                )}
                                {float && (
                                    <span className={`absolute text-lg font-black font-mono animate-bounce ${float.color}`}>
                                        {float.text}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Màn hình trước khi bắt đầu */}
                {!isStarted && !isGameOver && (
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-4 text-center text-white z-10">
                        <Zap className="w-12 h-12 text-emerald-400 mb-2 animate-bounce" />
                        <h3 className="text-lg font-black text-emerald-300">BẮT DEAL CẤP TỐC</h3>
                        <p className="text-xs text-slate-300 mt-1 mb-4 max-w-[240px]">
                            Chạm thật nhanh vào Đơn Hàng & KPI trong 60 giây. Cẩn thận né ngay Bom Hủy Đơn!
                        </p>
                        <button
                            onClick={handleStart}
                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-sm font-black rounded-xl shadow-lg transition-transform active:scale-95"
                        >
                            Bắt đầu ngay (60s)
                        </button>
                    </div>
                )}

                {/* Màn hình kết thúc */}
                {isGameOver && (
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-4 text-center text-white z-10 animate-in fade-in">
                        <Trophy className="w-12 h-12 text-amber-400 mb-2 animate-bounce" />
                        <h3 className="text-xl font-black text-amber-300">HẾT GIỜ!</h3>
                        <p className="text-xs text-slate-300 mt-1 mb-3">
                            Điểm số: <span className="font-mono font-bold text-amber-400 text-base">{score}</span>
                            <br />Bắt trúng: <span className="font-bold text-emerald-400">{hits}</span> | Combo max: <span className="font-bold text-orange-400">x{maxCombo}</span>
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleStart}
                                className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-xs font-bold rounded-xl transition-colors"
                            >
                                Chơi lại
                            </button>
                            <button
                                onClick={handleFinishAndSave}
                                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-xs font-black rounded-xl shadow-lg transition-transform active:scale-95"
                            >
                                <Send className="w-3.5 h-3.5" /> Lưu điểm & Xếp hạng
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

