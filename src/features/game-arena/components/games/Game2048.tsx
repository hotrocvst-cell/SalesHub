import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Trophy, Award, ArrowLeft, Send } from 'lucide-react';
import { TILE_RANKS } from '../../constants';

interface Game2048Props {
    onFinishGame: (score: number, metadata: Record<string, any>) => void;
    onBack: () => void;
    personalBest?: number;
}

type Board = number[][];

export default function Game2048({ onFinishGame, onBack, personalBest = 0 }: Game2048Props) {
    const [board, setBoard] = useState<Board>(() => initBoard());
    const [score, setScore] = useState(0);
    const [bestScore, setBestScore] = useState(personalBest);
    const [isGameOver, setIsGameOver] = useState(false);
    const [hasWon, setHasWon] = useState(false);
    const [maxTile, setMaxTile] = useState(2);
    const [startTime] = useState<number>(() => Date.now());

    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    // Khởi tạo bàn cờ với 2 ô số
    function initBoard(): Board {
        const b: Board = Array(4).fill(0).map(() => Array(4).fill(0));
        addRandomTile(b);
        addRandomTile(b);
        return b;
    }

    function addRandomTile(b: Board): boolean {
        const emptyCells: { r: number; c: number }[] = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (b[r][c] === 0) emptyCells.push({ r, c });
            }
        }
        if (emptyCells.length === 0) return false;
        const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        b[randomCell.r][randomCell.c] = Math.random() < 0.9 ? 2 : 4;
        return true;
    }

    // Logic trượt và gộp 1 hàng/cột sang trái
    const slideAndMergeRow = useCallback((row: number[]) => {
        let arr = row.filter(val => val !== 0);
        let gainedScore = 0;
        let mergedMax = 0;

        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] === arr[i + 1]) {
                arr[i] *= 2;
                gainedScore += arr[i];
                if (arr[i] > mergedMax) mergedMax = arr[i];
                arr.splice(i + 1, 1);
            }
        }
        while (arr.length < 4) {
            arr.push(0);
        }
        return { newRow: arr, gainedScore, mergedMax };
    }, []);

    // Di chuyển 4 hướng
    const move = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
        if (isGameOver) return;

        setBoard(prevBoard => {
            let rotated: Board = prevBoard.map(r => [...r]);
            let totalGained = 0;
            let currentMax = maxTile;

            // Xoay ma trận để tái sử dụng logic trượt sang trái
            if (direction === 'right') {
                rotated = rotated.map(r => r.reverse());
            } else if (direction === 'up') {
                rotated = transpose(rotated);
            } else if (direction === 'down') {
                rotated = transpose(rotated).map(r => r.reverse());
            }

            let hasChanged = false;
            for (let r = 0; r < 4; r++) {
                const { newRow, gainedScore, mergedMax } = slideAndMergeRow(rotated[r]);
                if (gainedScore > 0) totalGained += gainedScore;
                if (mergedMax > currentMax) currentMax = mergedMax;
                if (newRow.some((val, idx) => val !== rotated[r][idx])) {
                    hasChanged = true;
                }
                rotated[r] = newRow;
            }

            // Xoay ngược lại vị trí ban đầu
            if (direction === 'right') {
                rotated = rotated.map(r => r.reverse());
            } else if (direction === 'up') {
                rotated = transpose(rotated);
            } else if (direction === 'down') {
                rotated = transpose(rotated.map(r => r.reverse()));
            }

            if (!hasChanged) return prevBoard;

            // Thêm 1 ô mới ngẫu nhiên
            addRandomTile(rotated);

            // Cập nhật điểm
            const nextScore = score + totalGained;
            setScore(nextScore);
            setMaxTile(currentMax);
            if (nextScore > bestScore) setBestScore(nextScore);
            if (currentMax >= 2048 && !hasWon) setHasWon(true);

            // Kiểm tra Game Over
            if (!canMove(rotated)) {
                setIsGameOver(true);
            }

            return rotated;
        });
    }, [isGameOver, maxTile, score, bestScore, hasWon, slideAndMergeRow]);

    function transpose(b: Board): Board {
        return b[0].map((_, colIndex) => b.map(row => row[colIndex]));
    }

    function canMove(b: Board): boolean {
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (b[r][c] === 0) return true;
                if (r < 3 && b[r][c] === b[r + 1][c]) return true;
                if (c < 3 && b[r][c] === b[r][c + 1]) return true;
            }
        }
        return false;
    }

    // Xử lý phím máy tính
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['ArrowUp', 'KeyW'].includes(e.code)) {
                e.preventDefault();
                move('up');
            } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
                e.preventDefault();
                move('down');
            } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
                e.preventDefault();
                move('left');
            } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
                e.preventDefault();
                move('right');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [move]);

    // Xử lý vuốt cảm ứng trên Smartphone
    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;
        touchStartRef.current = null;

        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // Ngưỡng tối thiểu để tính là vuốt (30px)
        if (Math.max(absDx, absDy) < 30) return;

        if (absDx > absDy) {
            move(dx > 0 ? 'right' : 'left');
        } else {
            move(dy > 0 ? 'down' : 'up');
        }
    };

    const handleRestart = () => {
        setBoard(initBoard());
        setScore(0);
        setMaxTile(2);
        setIsGameOver(false);
        setHasWon(false);
    };

    const handleFinishAndSave = () => {
        const duration = Math.round((Date.now() - startTime) / 1000);
        onFinishGame(score, { max_tile: maxTile, duration_seconds: duration });
    };

    const currentRank = TILE_RANKS[maxTile] || { title: 'Tân Binh', color: 'text-slate-700', bg: 'bg-slate-100' };

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
                    {/* Điểm hiện tại */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 text-center min-w-[70px]">
                        <div className="text-[10px] uppercase font-bold text-amber-700 leading-none">Điểm</div>
                        <div className="text-base font-black font-mono text-amber-900 leading-tight">{score}</div>
                    </div>

                    {/* Điểm cao nhất */}
                    <div className="bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-center min-w-[70px]">
                        <div className="text-[10px] uppercase font-bold text-slate-500 leading-none flex items-center justify-center gap-0.5">
                            <Trophy className="w-2.5 h-2.5 text-amber-500" /> Kỷ lục
                        </div>
                        <div className="text-base font-black font-mono text-slate-800 leading-tight">{bestScore}</div>
                    </div>

                    <button
                        onClick={handleRestart}
                        title="Chơi lại từ đầu"
                        className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Huy hiệu danh hiệu đạt được */}
            <div className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-1.5 mb-3 shadow-sm">
                <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-600" />
                    <span className="text-xs text-slate-600">Bậc danh hiệu:</span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${currentRank.bg} ${currentRank.color}`}>
                        {currentRank.title} ({maxTile})
                    </span>
                </div>
                <div className="text-[11px] text-slate-400 italic">Vuốt để gộp ô</div>
            </div>

            {/* Bàn cờ 2048 */}
            <div
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="relative bg-slate-800 p-2.5 sm:p-3 rounded-2xl shadow-xl w-full aspect-square touch-none select-none max-w-[360px]"
            >
                <div className="grid grid-cols-4 grid-rows-4 gap-2 h-full w-full">
                    {board.map((row, r) =>
                        row.map((val, c) => {
                            const rank = TILE_RANKS[val];
                            return (
                                <div
                                    key={`${r}-${c}`}
                                    className={`rounded-xl flex flex-col items-center justify-center transition-all duration-100 font-mono font-black ${
                                        val === 0
                                            ? 'bg-slate-700/50'
                                            : rank
                                            ? `${rank.bg} ${rank.color} shadow-md`
                                            : 'bg-purple-700 text-white shadow-md'
                                    }`}
                                >
                                    {val > 0 && (
                                        <>
                                            <span className={`${val >= 1024 ? 'text-sm sm:text-base' : val >= 128 ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'}`}>
                                                {val}
                                            </span>
                                            {rank && (
                                                <span className="text-[8.5px] font-sans font-bold opacity-80 leading-none mt-0.5 scale-90">
                                                    {rank.title}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Overlay Game Over hoặc Hoàn thành */}
                {(isGameOver || hasWon) && (
                    <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-4 text-center text-white z-10 animate-in fade-in">
                        <Trophy className="w-12 h-12 text-amber-400 mb-2 animate-bounce" />
                        <h3 className="text-xl font-black text-amber-300">
                            {hasWon ? '🎉 CHÚC MỪNG CHIẾN THẦN 2048!' : '🎮 HẾT NƯỚC ĐI!'}
                        </h3>
                        <p className="text-xs text-slate-300 mt-1 mb-4">
                            Điểm số đạt được: <span className="font-mono font-bold text-amber-400 text-sm">{score}</span>
                            <br />Danh hiệu: <span className="font-bold text-white">{currentRank.title} ({maxTile})</span>
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleRestart}
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

            {/* Nút lưu điểm chủ động khi muốn dừng */}
            {!isGameOver && score > 0 && (
                <button
                    onClick={handleFinishAndSave}
                    className="mt-3 flex items-center gap-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-4 py-2 rounded-xl transition-colors shadow-sm"
                >
                    <Send className="w-3.5 h-3.5" /> Lưu điểm hiện tại ({score}đ) & Xếp hạng
                </button>
            )}
        </div>
    );
}

