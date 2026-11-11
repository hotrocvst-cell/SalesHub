import React from 'react';

interface Props {
    results: number[];
    lockedCount: number;
    isSpinning: boolean;
}

export default function NumberRangeStage({ results, lockedCount, isSpinning }: Props) {
    return (
        <div className="min-h-[148px] rounded-2xl bg-[#f4f9fd] border border-sky-100 p-4 sm:p-6 flex flex-col items-center justify-center gap-3">
            {results.length === 0 ? (
                <div className="text-center space-y-1">
                    <p className="text-sm font-extrabold text-slate-800">
                        Sẵn sàng quay số công bằng
                    </p>
                    <p className="text-xs text-slate-600">
                        Chọn khoảng số và số lượng bên dưới rồi nhấn <strong>QUAY NGAY</strong>
                    </p>
                </div>
            ) : results.length === 1 ? (
                <div className="text-center space-y-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0066ab] block">
                        {isSpinning ? 'Đang quay số...' : 'Kết quả vừa quay'}
                    </span>
                    <div
                        key={isSpinning ? 'single-spin' : `single-locked-${results[0]}`}
                        className={`inline-flex items-center justify-center min-w-[104px] h-[104px] px-6 rounded-[20px] font-mono font-black text-4xl sm:text-5xl tabular-nums shadow-lg ${
                            isSpinning
                                ? 'vt-shake bg-white text-[#0066ab] border-2 border-[#12c3f4]'
                                : 'vt-pop bg-gradient-to-br from-[#0066ab] to-[#0369a1] text-white border-2 border-white/80'
                        }`}
                    >
                        {results[0]}
                    </div>
                </div>
            ) : (
                <div className="w-full space-y-3 text-center">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0066ab] block">
                        {isSpinning ? `Đang chốt số (${lockedCount}/${results.length})...` : `${results.length} số kết quả`}
                    </span>
                    <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                        {results.map((num, idx) => {
                            const isLocked = !isSpinning || idx < lockedCount;
                            const isTileMode = results.length <= 15;
                            return (
                                <span
                                    key={isLocked ? `locked-${idx}-${num}` : `spin-${idx}`}
                                    style={isSpinning && !isLocked ? { animationDelay: `${(idx % 5) * 35}ms` } : undefined}
                                    className={`inline-flex items-center justify-center font-mono font-black tabular-nums ${
                                        isTileMode
                                            ? 'min-w-[72px] h-[78px] px-3.5 rounded-[16px] text-2xl sm:text-3xl shadow-md'
                                            : 'px-3.5 py-2 rounded-xl text-base sm:text-lg shadow-xs'
                                    } ${
                                        isLocked
                                            ? 'vt-pop bg-gradient-to-br from-[#0066ab] to-[#0369a1] text-white border border-sky-700/20'
                                            : 'vt-shake bg-white text-[#0066ab] border-2 border-[#12c3f4]'
                                    }`}
                                >
                                    {num}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

