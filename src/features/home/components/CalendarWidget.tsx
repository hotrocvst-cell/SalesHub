import { useState, useMemo, useEffect } from 'react';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    Sparkles,
    Star,
    CheckCircle2,
    CalendarDays,
    Clock,
    Tag,
    Bookmark,
    Check
} from 'lucide-react';
import { getLunarDate } from '../utils/lunarCalendar';

interface DayNote {
    dateKey: string; // YYYY-MM-DD
    text: string;
}

const LOCAL_NOTES_KEY = 'saleshub_homepage_calendar_notes_v1';

export default function CalendarWidget() {
    const today = useMemo(() => new Date(), []);
    const [viewDate, setViewDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
    const [selectedDate, setSelectedDate] = useState<Date>(today);
    const [notes, setNotes] = useState<Record<string, string>>(() => {
        try {
            const raw = localStorage.getItem(LOCAL_NOTES_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    });
    const [currentNoteText, setCurrentNoteText] = useState<string>('');
    const [isSavedNoteToast, setIsSavedNoteToast] = useState<boolean>(false);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth(); // 0 - 11

    // Khi chọn ngày mới, nạp note tương ứng
    useEffect(() => {
        const key = formatDateKey(selectedDate);
        setCurrentNoteText(notes[key] || '');
    }, [selectedDate, notes]);

    function formatDateKey(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // Chuyển sang tháng trước
    const handlePrevMonth = () => {
        setViewDate(new Date(year, month - 1, 1));
    };

    // Chuyển sang tháng kế
    const handleNextMonth = () => {
        setViewDate(new Date(year, month + 1, 1));
    };

    // Quay về tháng hiện tại & ngày hôm nay
    const handleJumpToday = () => {
        const now = new Date();
        setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
        setSelectedDate(now);
    };

    // Lưu ghi chú cho ngày đang chọn
    const handleSaveNote = () => {
        const key = formatDateKey(selectedDate);
        const newNotes = { ...notes };
        if (currentNoteText.trim()) {
            newNotes[key] = currentNoteText.trim();
        } else {
            delete newNotes[key];
        }
        setNotes(newNotes);
        try {
            localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(newNotes));
        } catch (e) {
            console.warn('Lỗi lưu ghi chú lịch:', e);
        }
        setIsSavedNoteToast(true);
        setTimeout(() => setIsSavedNoteToast(false), 2000);
    };

    // Tính toán các ngày trong bảng lịch
    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const totalDaysInMonth = lastDayOfMonth.getDate();

        // Thứ của ngày mùng 1 (0: CN, 1: T2, ..., 6: T7)
        // Chuyển sang hệ: Thứ Hai là cột 0, Chủ Nhật là cột 6
        let firstDayIndex = firstDayOfMonth.getDay() - 1;
        if (firstDayIndex === -1) firstDayIndex = 6;

        const days = [];

        // 1. Ngày của tháng trước để đệm đủ tuần
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const d = prevMonthLastDay - i;
            const fullDate = new Date(year, month - 1, d);
            const lunar = getLunarDate(d, month === 0 ? 12 : month, month === 0 ? year - 1 : year);
            days.push({
                date: fullDate,
                dayNumber: d,
                isCurrentMonth: false,
                lunar
            });
        }

        // 2. Ngày của tháng hiện tại
        for (let d = 1; d <= totalDaysInMonth; d++) {
            const fullDate = new Date(year, month, d);
            const lunar = getLunarDate(d, month + 1, year);
            days.push({
                date: fullDate,
                dayNumber: d,
                isCurrentMonth: true,
                lunar
            });
        }

        // 3. Ngày của tháng sau để làm đầy ô lưới (bội số của 7)
        const remainingSlots = 7 - (days.length % 7);
        if (remainingSlots < 7) {
            for (let d = 1; d <= remainingSlots; d++) {
                const fullDate = new Date(year, month + 1, d);
                const lunar = getLunarDate(d, month === 11 ? 1 : month + 2, month === 11 ? year + 1 : year);
                days.push({
                    date: fullDate,
                    dayNumber: d,
                    isCurrentMonth: false,
                    lunar
                });
            }
        }

        return days;
    }, [year, month]);

    // Thông tin ngày đang chọn
    const selectedLunar = useMemo(() => {
        return getLunarDate(selectedDate.getDate(), selectedDate.getMonth() + 1, selectedDate.getFullYear());
    }, [selectedDate]);

    const isTodaySelected = useMemo(() => {
        return (
            selectedDate.getDate() === today.getDate() &&
            selectedDate.getMonth() === today.getMonth() &&
            selectedDate.getFullYear() === today.getFullYear()
        );
    }, [selectedDate, today]);

    const diffDaysFromToday = useMemo(() => {
        const t1 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const t2 = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime();
        return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
    }, [selectedDate, today]);

    const WEEKDAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    // Mốc kinh doanh đặc biệt trong tháng
    const getSpecialDayBadge = (d: number, isCurMonth: boolean, lastDay: number) => {
        if (!isCurMonth) return null;
        if (d === lastDay) return { text: 'Chốt Số Tháng', color: 'bg-rose-100 text-rose-800 border-rose-200' };
        if (d === 1) return { text: 'Khởi Động', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        if (d === 10) return { text: 'Kỳ Lương', color: 'bg-amber-100 text-amber-800 border-amber-200' };
        if (d === 15) return { text: 'Đánh Giá Giữa Kỳ', color: 'bg-blue-100 text-blue-800 border-blue-200' };
        return null;
    };

    const lastDayInMonth = new Date(year, month + 1, 0).getDate();

    // Số lượng ghi chú trong tháng hiện tại
    const notesCountInMonth = useMemo(() => {
        let count = 0;
        const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        for (const k of Object.keys(notes)) {
            if (k.startsWith(prefix) && notes[k]?.trim()) count++;
        }
        return count;
    }, [notes, year, month]);

    return (
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-sm space-y-6">
            {/* Header: Tiêu đề, chọn tháng/năm, điều hướng */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20">
                        <CalendarIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                Lịch Làm Việc & Kinh Doanh
                            </h2>
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider border border-blue-200/70">
                                Tháng {month + 1} / {year}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">
                            Theo dõi lịch dương & âm lịch song hành, mốc kỳ chốt doanh số và ghi chú ngày làm việc
                        </p>
                    </div>
                </div>

                {/* Bộ điều hướng Tháng / Năm & Nút Về Hôm Nay */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Chọn tháng nhanh */}
                    <select
                        value={month}
                        onChange={(e) => setViewDate(new Date(year, parseInt(e.target.value), 1))}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i}>Tháng {i + 1}</option>
                        ))}
                    </select>

                    {/* Chọn năm */}
                    <select
                        value={year}
                        onChange={(e) => setViewDate(new Date(parseInt(e.target.value), month, 1))}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                    >
                        {[2024, 2025, 2026, 2027, 2028].map(y => (
                            <option key={y} value={y}>Năm {y}</option>
                        ))}
                    </select>

                    <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                            title="Tháng trước"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <button
                            type="button"
                            onClick={handleJumpToday}
                            className="px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                            title="Quay về ngày hôm nay"
                        >
                            <RotateCcw className="w-3 h-3" />
                            <span>Hôm nay</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                            title="Tháng sau"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Thống kê nhanh tháng & Đếm ngược */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold">
                        <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-semibold">Tổng ngày tháng {month + 1}</div>
                        <div className="font-mono font-black text-slate-900 text-sm">{lastDayInMonth} ngày</div>
                    </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-bold">
                        <Star className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-semibold">Chốt số tháng</div>
                        <div className="font-mono font-black text-rose-700 text-sm">Ngày {lastDayInMonth}/{month + 1}</div>
                    </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold">
                        <Clock className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-semibold">Năm Âm Lịch</div>
                        <div className="font-black text-emerald-800 text-xs truncate max-w-[120px]">{selectedLunar.canChiYear}</div>
                    </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold">
                        <Bookmark className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-semibold">Ghi chú đã tạo</div>
                        <div className="font-mono font-black text-amber-800 text-sm">{notesCountInMonth} ngày</div>
                    </div>
                </div>
            </div>

            {/* Bảng lưới hiển thị lịch các ngày trong tháng */}
            <div className="space-y-2">
                {/* Hàng tiêu đề 7 thứ trong tuần (T2 -> CN) */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-black select-none">
                    {WEEKDAY_NAMES.map((name, idx) => {
                        const isWeekend = idx >= 5;
                        const isSunday = idx === 6;
                        return (
                            <div
                                key={name}
                                className={`py-2 rounded-xl text-xs uppercase tracking-wider ${
                                    isSunday
                                        ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                        : isWeekend
                                        ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                        : 'bg-slate-50 text-slate-600 border border-slate-100'
                                }`}
                            >
                                {name}
                            </div>
                        );
                    })}
                </div>

                {/* Lưới các ô ngày */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {calendarDays.map((item, index) => {
                        const isToday = (
                            item.date.getDate() === today.getDate() &&
                            item.date.getMonth() === today.getMonth() &&
                            item.date.getFullYear() === today.getFullYear()
                        );
                        const isSelected = (
                            item.date.getDate() === selectedDate.getDate() &&
                            item.date.getMonth() === selectedDate.getMonth() &&
                            item.date.getFullYear() === selectedDate.getFullYear()
                        );
                        const dayOfWeek = item.date.getDay(); // 0 is Sunday, 6 is Saturday
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                        const dateKey = formatDateKey(item.date);
                        const hasNote = Boolean(notes[dateKey]?.trim());
                        const specialBadge = getSpecialDayBadge(item.dayNumber, item.isCurrentMonth, lastDayInMonth);

                        return (
                            <div
                                key={index}
                                onClick={() => setSelectedDate(item.date)}
                                className={`min-h-[72px] sm:min-h-[88px] p-1.5 sm:p-2.5 rounded-2xl border transition flex flex-col justify-between cursor-pointer relative select-none group ${
                                    !item.isCurrentMonth
                                        ? 'bg-slate-50/50 border-slate-100 text-slate-300 opacity-60 hover:opacity-100'
                                        : isSelected
                                        ? 'bg-blue-50/80 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                                        : isToday
                                        ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                                        : isWeekend
                                        ? 'bg-slate-50/60 hover:bg-slate-100/80 border-slate-200/80'
                                        : 'bg-white hover:bg-slate-50 border-slate-200/70 shadow-2xs'
                                }`}
                            >
                                {/* Dòng trên: Số ngày dương & Huy hiệu hôm nay / nốt */}
                                <div className="flex items-start justify-between">
                                    <span className={`font-mono text-sm sm:text-base font-black ${
                                        !item.isCurrentMonth
                                            ? 'text-slate-400'
                                            : isToday
                                            ? 'text-amber-700'
                                            : isSelected
                                            ? 'text-blue-900'
                                            : dayOfWeek === 0
                                            ? 'text-rose-600'
                                            : 'text-slate-800'
                                    }`}>
                                        {item.dayNumber}
                                    </span>

                                    <div className="flex items-center gap-1">
                                        {hasNote && (
                                            <span className="w-2 h-2 rounded-full bg-blue-600" title="Có ghi chú công việc" />
                                        )}
                                        {isToday && (
                                            <span className="px-1.5 py-0.2 rounded-md bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider shadow-2xs">
                                                Nay
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Dòng giữa: Huy hiệu sự kiện kinh doanh nếu có */}
                                {specialBadge && (
                                    <div className="hidden sm:block my-0.5">
                                        <span className={`px-1 py-0.2 rounded text-[9px] font-bold border truncate block max-w-full text-center ${specialBadge.color}`}>
                                            {specialBadge.text}
                                        </span>
                                    </div>
                                )}

                                {/* Dòng dưới: Ngày âm lịch */}
                                <div className="flex items-center justify-between text-[10px] mt-1 pt-1 border-t border-slate-100/60">
                                    <span className={`font-medium truncate ${
                                        item.lunar.day === 1 || item.lunar.day === 15
                                            ? 'text-rose-600 font-black'
                                            : 'text-slate-400 font-mono'
                                    }`}>
                                        {item.lunar.lunarLabel}
                                    </span>

                                    {item.lunar.day === 1 && (
                                        <span className="text-[8px] font-black px-1 rounded bg-rose-100 text-rose-700 hidden sm:inline">
                                            Mùng 1
                                        </span>
                                    )}
                                    {item.lunar.day === 15 && (
                                        <span className="text-[8px] font-black px-1 rounded bg-amber-100 text-amber-700 hidden sm:inline">
                                            Rằm
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Chi tiết ngày đang được chọn & Ghi chú mục tiêu ngày */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shadow-xs">
                            <span className="text-base font-mono">{selectedDate.getDate()}</span>
                        </div>
                        <div>
                            <div className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                                <span>{['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][selectedDate.getDay()]}, {selectedDate.toLocaleDateString('vi-VN')}</span>
                                {isTodaySelected && (
                                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase">
                                        Hôm nay
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap items-center gap-2">
                                <span>Âm lịch: <b>Ngày {selectedLunar.day} tháng {selectedLunar.month}{selectedLunar.isLeap ? ' (Nhuận)' : ''}</b> ({selectedLunar.canChiDay})</span>
                                <span>•</span>
                                <span>Năm {selectedLunar.canChiYear}</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-xs font-semibold text-slate-500 self-start sm:self-center">
                        {diffDaysFromToday === 0 ? (
                            <span className="text-amber-700 font-bold">🎯 Đang là ngày hiện tại</span>
                        ) : diffDaysFromToday > 0 ? (
                            <span>Còn <b className="text-blue-700 font-mono text-sm">{diffDaysFromToday}</b> ngày nữa</span>
                        ) : (
                            <span>Đã qua <b className="text-slate-700 font-mono text-sm">{Math.abs(diffDaysFromToday)}</b> ngày trước</span>
                        )}
                    </div>
                </div>

                {/* Ô nhập ghi chú cá nhân / mục tiêu cho ngày này */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-blue-600" />
                            <span>Ghi chú công việc / Mục tiêu ngày {selectedDate.getDate()}/{selectedDate.getMonth() + 1}:</span>
                        </span>
                        {isSavedNoteToast && (
                            <span className="text-emerald-700 font-bold flex items-center gap-1 animate-in fade-in">
                                <Check className="w-3.5 h-3.5" />
                                <span>Đã lưu ghi chú!</span>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={currentNoteText}
                            onChange={(e) => setCurrentNoteText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveNote()}
                            placeholder="Ví dụ: Họp giao ban đầu ca; Đẩy mạnh thi đua iPhone; Chốt chỉ tiêu sim thẻ..."
                            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                        />
                        <button
                            type="button"
                            onClick={handleSaveNote}
                            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                            <Bookmark className="w-3.5 h-3.5" />
                            <span>Lưu</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
