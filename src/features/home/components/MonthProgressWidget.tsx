import { useMemo } from 'react';
import { Target, TrendingUp, Flame, Award, Quote, Sparkles, CheckCircle2 } from 'lucide-react';

const MOTIVATIONAL_QUOTES = [
    {
        quote: 'Thành công trong bán hàng không đến từ may mắn, mà đến từ sự thấu hiểu sâu sắc nhu cầu khách hàng và kiên trì phục vụ.',
        author: 'Nguyên lý bán lẻ hiện đại'
    },
    {
        quote: 'Mỗi lời từ chối của khách hàng là một bước đệm giúp bạn tiến gần hơn đến một giao dịch thành công rực rỡ.',
        author: 'Kỹ năng kinh doanh thực chiến'
    },
    {
        quote: 'Chất lượng phục vụ tận tâm chính là vũ khí cạnh tranh mạnh mẽ nhất của một người làm kinh doanh xuất sắc.',
        author: 'Văn hóa phục vụ khách hàng'
    },
    {
        quote: 'Mục tiêu tháng không tự nhiên hoàn thành; nó được tạo nên từ sự bứt phá và kỷ luật trong từng ca làm việc mỗi ngày.',
        author: 'Động lực bứt phá doanh số'
    },
    {
        quote: 'Hãy làm việc hôm nay với sự đam mê để ngày mai tự hào về những cột mốc doanh thu đã chinh phục!',
        author: 'Tinh thần chiến binh SalesHub'
    }
];

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

    // Chọn câu trích dẫn theo ngày
    const quote = useMemo(() => {
        const idx = currentDay % MOTIVATIONAL_QUOTES.length;
        return MOTIVATIONAL_QUOTES[idx];
    }, [currentDay]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Card 1: Tiến độ tháng & Đếm ngược chốt số */}
            <div className="bg-gradient-to-br from-indigo-900 via-blue-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white border border-white/10 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-black border border-blue-400/20">
                                <Target className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="font-extrabold text-sm text-white">
                                    Đếm Ngược Chốt Doanh Số Tháng {currentMonth + 1}
                                </h3>
                                <p className="text-[11px] text-slate-300">
                                    Chu kỳ kinh doanh từ 01/{currentMonth + 1} đến {totalDaysInMonth}/{currentMonth + 1}/{currentYear}
                                </p>
                            </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-mono font-black flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5 text-amber-400" />
                            <span>Còn {daysRemaining} ngày</span>
                        </span>
                    </div>

                    {/* Thanh tiến độ ngày trong tháng */}
                    <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-300">
                                Đã qua: <b className="text-white font-mono">{daysPassed}</b> / {totalDaysInMonth} ngày
                            </span>
                            <span className="text-emerald-400 font-mono font-extrabold">
                                {progressPercent}% thời gian
                            </span>
                        </div>

                        <div className="w-full h-3 rounded-full bg-slate-800/80 p-0.5 border border-white/10 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 transition-all duration-500 shadow-xs"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* Mốc thời gian quan trọng */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center">
                        <div className={`p-2 rounded-xl border ${currentDay >= 1 && currentDay <= 10 ? 'bg-blue-500/20 border-blue-400/40 text-blue-200' : 'bg-black/20 border-white/5 text-slate-400'}`}>
                            <div className="text-[10px] uppercase font-bold">Giai đoạn 1</div>
                            <div className="font-mono font-black text-xs text-white">01 - 10</div>
                            <div className="text-[9px] opacity-75">Khởi động KPI</div>
                        </div>

                        <div className={`p-2 rounded-xl border ${currentDay >= 11 && currentDay <= 20 ? 'bg-amber-500/20 border-amber-400/40 text-amber-200' : 'bg-black/20 border-white/5 text-slate-400'}`}>
                            <div className="text-[10px] uppercase font-bold">Giai đoạn 2</div>
                            <div className="font-mono font-black text-xs text-white">11 - 20</div>
                            <div className="text-[9px] opacity-75">Tăng tốc bứt phá</div>
                        </div>

                        <div className={`p-2 rounded-xl border ${currentDay >= 21 ? 'bg-rose-500/20 border-rose-400/40 text-rose-200 animate-pulse' : 'bg-black/20 border-white/5 text-slate-400'}`}>
                            <div className="text-[10px] uppercase font-bold">Giai đoạn 3</div>
                            <div className="font-mono font-black text-xs text-white">21 - {totalDaysInMonth}</div>
                            <div className="text-[9px] opacity-75">Về đích chốt số</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Card 2: Góc truyền cảm hứng bán hàng mỗi ngày */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between bg-gradient-to-br from-amber-50/40 via-white to-orange-50/20">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-xs font-black uppercase tracking-wider">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            <span>Động Lực Mỗi Ngày</span>
                        </span>

                        <span className="text-xs font-mono font-bold text-slate-400">
                            Ngày {currentDay}/{currentMonth + 1}
                        </span>
                    </div>

                    <div className="relative pl-6 py-2">
                        <Quote className="w-8 h-8 text-amber-300/60 absolute left-0 top-0 rotate-180 -scale-x-100" />
                        <p className="text-slate-800 text-xs sm:text-sm font-semibold leading-relaxed italic">
                            "{quote.quote}"
                        </p>
                    </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-bold text-slate-700">📌 {quote.author}</span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Sẵn sàng bứt phá</span>
                    </span>
                </div>
            </div>
        </div>
    );
}
