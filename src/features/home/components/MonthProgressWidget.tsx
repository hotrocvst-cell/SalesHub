import { Target, Flame, Calendar, Clock, Award } from 'lucide-react';

export default function MonthProgressWidget() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-11
    const currentDay = today.getDate();

    // Tổng số ngày trong tháng hiện tại
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysPassed = currentDay;
    const daysRemaining = Math.max(0, totalDaysInMonth - currentDay);
    const progressPercent = Math.min(100, Math.round((daysPassed / totalDaysInMonth) * 100));

    // Tính tuần trong tháng
    const currentWeekInMonth = Math.ceil(currentDay / 7);

    return (
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 rounded-3xl p-5 sm:p-6 text-white border border-white/10 shadow-sm relative overflow-hidden flex flex-col justify-between h-full">
            {/* Hiệu ứng vệt sáng nền */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
                {/* Header: Đếm ngược chốt số */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-black border border-blue-400/20 shadow-inner shrink-0">
                            <Target className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm sm:text-base text-white tracking-tight flex items-center gap-1.5">
                                <span>Tiến Độ & Đếm Ngược Tháng {currentMonth + 1}</span>
                            </h3>
                            <p className="text-[11px] text-slate-300">
                                Chu kỳ 01/{currentMonth + 1} đến {totalDaysInMonth}/{currentMonth + 1}/{currentYear} • Tuần {currentWeekInMonth}
                            </p>
                        </div>
                    </div>

                    <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-mono font-black flex items-center gap-1.5 shadow-2xs">
                        <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                        <span>Còn {daysRemaining} ngày chốt số</span>
                    </span>
                </div>

                {/* Thanh tiến độ ngày trong tháng */}
                <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-400" />
                            Đã qua: <b className="text-white font-mono">{daysPassed}</b> / {totalDaysInMonth} ngày
                        </span>
                        <span className="text-emerald-400 font-mono font-extrabold">
                            {progressPercent}% thời gian
                        </span>
                    </div>

                    <div className="w-full h-3.5 rounded-full bg-slate-800/90 p-0.5 border border-white/10 overflow-hidden shadow-inner">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 transition-all duration-500 shadow-xs"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* 3 Giai đoạn kinh doanh trong tháng */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center">
                    <div className={`p-2.5 rounded-2xl border transition ${currentDay >= 1 && currentDay <= 10 ? 'bg-blue-500/25 border-blue-400/50 text-blue-100 shadow-xs' : 'bg-black/20 border-white/5 text-slate-400'}`}>
                        <div className="text-[10px] uppercase font-bold tracking-wider">Giai đoạn 1</div>
                        <div className="font-mono font-black text-xs sm:text-sm text-white">01 - 10</div>
                        <div className="text-[10px] font-medium opacity-80 text-blue-200">🚀 Khởi động</div>
                    </div>

                    <div className={`p-2.5 rounded-2xl border transition ${currentDay >= 11 && currentDay <= 20 ? 'bg-amber-500/25 border-amber-400/50 text-amber-100 shadow-xs' : 'bg-black/20 border-white/5 text-slate-400'}`}>
                        <div className="text-[10px] uppercase font-bold tracking-wider">Giai đoạn 2</div>
                        <div className="font-mono font-black text-xs sm:text-sm text-white">11 - 20</div>
                        <div className="text-[10px] font-medium opacity-80 text-amber-200">⚡ Tăng tốc</div>
                    </div>

                    <div className={`p-2.5 rounded-2xl border transition ${currentDay >= 21 ? 'bg-rose-500/25 border-rose-400/50 text-rose-100 shadow-xs animate-pulse' : 'bg-black/20 border-white/5 text-slate-400'}`}>
                        <div className="text-[10px] uppercase font-bold tracking-wider">Giai đoạn 3</div>
                        <div className="font-mono font-black text-xs sm:text-sm text-white">21 - {totalDaysInMonth}</div>
                        <div className="text-[10px] font-medium opacity-80 text-rose-200">🎯 Về đích</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
