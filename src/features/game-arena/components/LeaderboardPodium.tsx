import React from 'react';
import { Crown, Trophy, Medal } from 'lucide-react';
import { getShortenedEmployeeName, cleanEmployeeName } from '../../../core/lib/formatters';
import type { GameScoreRecord } from '../types';

interface LeaderboardPodiumProps {
    topScores: GameScoreRecord[];
}

export default function LeaderboardPodium({ topScores }: LeaderboardPodiumProps) {
    if (!topScores || topScores.length === 0) return null;

    const first = topScores[0];
    const second = topScores[1];
    const third = topScores[2];

    return (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 my-4 items-end max-w-md mx-auto">
            {/* Top 2 - Bạc */}
            {second ? (
                <div className="bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-300 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center shadow-sm order-1 h-44 justify-between">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-slate-400 flex items-center justify-center font-black text-slate-700 text-sm shadow">
                            🥈
                        </div>
                    </div>
                    <div className="w-full">
                        <div className="text-[10px] font-mono font-bold text-slate-500 truncate">
                            {second.employee_id}
                        </div>
                        <div
                            title={`Mã NV: ${second.employee_id} - ${cleanEmployeeName(second.employee_name)}`}
                            className="text-xs font-black text-slate-800 truncate"
                        >
                            {getShortenedEmployeeName(second.employee_name)}
                        </div>
                        <div className="text-[9.5px] text-slate-500 truncate">{second.store_name}</div>
                    </div>
                    <div className="w-full bg-slate-200/80 rounded-xl py-1 text-center">
                        <div className="text-[9px] font-bold text-slate-500 uppercase leading-none">Điểm</div>
                        <div className="text-xs font-black font-mono text-slate-800">{second.score}</div>
                    </div>
                </div>
            ) : <div className="order-1" />}

            {/* Top 1 - Vàng (Cao nhất ở giữa) */}
            {first ? (
                <div className="bg-gradient-to-b from-amber-50 to-amber-100 border-2 border-amber-400 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center shadow-md order-2 h-52 justify-between relative -top-2">
                    <div className="relative">
                        <Crown className="w-6 h-6 text-amber-500 absolute -top-4 left-1/2 -translate-x-1/2 animate-bounce" />
                        <div className="w-12 h-12 rounded-full bg-amber-200 border-2 border-amber-500 flex items-center justify-center font-black text-amber-900 text-lg shadow-md">
                            🥇
                        </div>
                    </div>
                    <div className="w-full">
                        <div className="text-[10px] font-mono font-bold text-amber-700 truncate">
                            {first.employee_id}
                        </div>
                        <div
                            title={`Mã NV: ${first.employee_id} - ${cleanEmployeeName(first.employee_name)}`}
                            className="text-sm font-black text-amber-950 truncate"
                        >
                            {getShortenedEmployeeName(first.employee_name)}
                        </div>
                        <div className="text-[10px] text-amber-800/80 font-medium truncate">{first.store_name}</div>
                    </div>
                    <div className="w-full bg-amber-300/80 rounded-xl py-1 text-center shadow-inner">
                        <div className="text-[9px] font-bold text-amber-900 uppercase leading-none">Vô Địch</div>
                        <div className="text-sm font-black font-mono text-amber-950">{first.score}</div>
                    </div>
                </div>
            ) : <div className="order-2" />}

            {/* Top 3 - Đồng */}
            {third ? (
                <div className="bg-gradient-to-b from-amber-50/50 to-orange-50 border border-orange-200 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center shadow-sm order-3 h-40 justify-between">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-orange-100 border-2 border-orange-300 flex items-center justify-center font-black text-orange-800 text-sm shadow">
                            🥉
                        </div>
                    </div>
                    <div className="w-full">
                        <div className="text-[10px] font-mono font-bold text-orange-700/80 truncate">
                            {third.employee_id}
                        </div>
                        <div
                            title={`Mã NV: ${third.employee_id} - ${cleanEmployeeName(third.employee_name)}`}
                            className="text-xs font-black text-slate-800 truncate"
                        >
                            {getShortenedEmployeeName(third.employee_name)}
                        </div>
                        <div className="text-[9.5px] text-slate-500 truncate">{third.store_name}</div>
                    </div>
                    <div className="w-full bg-orange-100 rounded-xl py-1 text-center">
                        <div className="text-[9px] font-bold text-orange-800 uppercase leading-none">Điểm</div>
                        <div className="text-xs font-black font-mono text-orange-950">{third.score}</div>
                    </div>
                </div>
            ) : <div className="order-3" />}
        </div>
    );
}

