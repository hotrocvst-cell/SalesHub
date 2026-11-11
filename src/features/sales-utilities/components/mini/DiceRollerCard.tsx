import React, { useState, useEffect, useRef } from 'react';
import { Dices } from 'lucide-react';
import {
    secureRandomInt,
    playFeedbackTone,
    createSpinTicker,
    unlockSoundEngine
} from '../../utils/randomUtils';

interface Props {
    soundEnabled: boolean;
}

const DIE_DOT_POSITIONS: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
};

function DieFaceTile({
    value,
    isRolling,
    landKey,
    index
}: {
    value: number;
    isRolling: boolean;
    landKey: number;
    index: number;
}) {
    const activeDots = DIE_DOT_POSITIONS[value] || [4];
    return (
        <div
            key={`${landKey}-${index}`}
            aria-label={`Xí ngầu viên ${index + 1}: mặt ${value}`}
            style={{ animationDelay: isRolling ? `${(index % 4) * 35}ms` : '0ms' }}
            className={`w-[68px] h-[68px] rounded-[14px] bg-white border-2 border-[#0066ab] shadow-md p-2.5 grid grid-cols-3 grid-rows-3 gap-1 place-items-center select-none ${
                isRolling ? 'dice-tumbling' : landKey > 0 ? 'dice-landed' : ''
            }`}
        >
            {Array.from({ length: 9 }, (_, i) => (
                <span
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full transition-colors duration-75 ${
                        activeDots.includes(i)
                            ? value === 1
                                ? 'bg-rose-600'
                                : 'bg-[#0066ab]'
                            : 'bg-transparent'
                    }`}
                />
            ))}
        </div>
    );
}

export default function DiceRollerCard({ soundEnabled }: Props) {
    const [diceCount, setDiceCount] = useState<number>(2);
    const [diceValues, setDiceValues] = useState<number[]>([6, 6]);
    const [isRolling, setIsRolling] = useState(false);
    const [rollGeneration, setRollGeneration] = useState(0);

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

    const handleChangeCount = (nextVal: number) => {
        if (isRolling) return;
        const clamped = Math.max(1, Math.min(12, Math.floor(nextVal || 1)));
        setDiceCount(clamped);
        setDiceValues(Array.from({ length: clamped }, (_, idx) => diceValues[idx] ?? 6));
    };

    const handleRoll = () => {
        if (isRolling) return;
        if (soundEnabled) unlockSoundEngine();
        clearTimers();

        const count = Math.max(1, Math.min(12, Math.floor(diceCount || 1)));
        setDiceCount(count);
        setIsRolling(true);

        const ticker = soundEnabled ? createSpinTicker('dice', 70) : null;
        ticker?.tick();

        intervalRef.current = window.setInterval(() => {
            setDiceValues(Array.from({ length: count }, () => secureRandomInt(1, 6)));
            ticker?.tick();
        }, 80);

        timeoutRef.current = window.setTimeout(() => {
            clearTimers();
            const finalRoll = Array.from({ length: count }, () => secureRandomInt(1, 6));
            setDiceValues(finalRoll);
            setIsRolling(false);
            setRollGeneration(g => g + 1);
            if (soundEnabled) playFeedbackTone('win');
        }, 900);
    };

    const totalPoints = diceValues.reduce((s, v) => s + v, 0);

    return (
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#0066ab] flex items-center justify-center shrink-0">
                        <Dices className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                        <h3 className="text-sm font-extrabold text-slate-900">Đổ Xí Ngầu</h3>
                        <p className="text-[11px] text-slate-600 tabular-nums">
                            {isRolling ? 'Đang lắc cốc...' : <>Tổng: <strong className="text-[#0066ab]">{totalPoints}</strong> ({diceValues.length} viên)</>}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {[1, 2, 3, 5, 6].map(n => (
                        <button
                            key={n}
                            type="button"
                            disabled={isRolling}
                            onClick={() => handleChangeCount(n)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer disabled:opacity-50 ${
                                diceCount === n
                                    ? 'bg-[#0066ab] text-white border-[#0066ab]'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            {n}
                        </button>
                    ))}
                    <input
                        id="mini-dice-count"
                        aria-label="Số lượng viên xí ngầu"
                        type="number"
                        min={1}
                        max={12}
                        disabled={isRolling}
                        value={diceCount}
                        onChange={e => handleChangeCount(parseInt(e.target.value || '1', 10))}
                        className="w-12 bg-slate-50 border border-slate-300 rounded-lg px-1.5 py-1 text-xs font-mono font-bold text-slate-900 text-right tabular-nums outline-none focus:ring-1 focus:ring-[#0066ab]"
                    />
                </div>
            </div>

            <div className="min-h-[154px] rounded-2xl bg-[#f4f9fd] border border-sky-100 p-4 flex flex-col items-center justify-center gap-3">
                <div className="flex flex-wrap items-center justify-center gap-3">
                    {diceValues.map((val, idx) => (
                        <DieFaceTile
                            key={idx}
                            value={val}
                            isRolling={isRolling}
                            landKey={rollGeneration}
                            index={idx}
                        />
                    ))}
                </div>
                <span className="text-xs font-bold text-slate-700 tabular-nums">
                    {isRolling ? (
                        <span className="text-[#0066ab]">Đang đổ xí ngầu...</span>
                    ) : (
                        <>Tổng điểm: <strong className="text-[#0066ab]">{totalPoints}</strong> ({diceValues.join(' + ')})</>
                    )}
                </span>
            </div>

            <button
                type="button"
                onClick={handleRoll}
                disabled={isRolling}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-[#0066ab] to-[#0369a1] hover:from-[#005591] hover:to-[#0284c7] disabled:opacity-60 text-white rounded-xl text-xs font-black shadow-sm transition cursor-pointer active:scale-[0.99]"
            >
                {isRolling ? 'Đang đổ...' : `ĐỔ ${diceCount} VIÊN XÍ NGẦU`}
            </button>
        </section>
    );
}
