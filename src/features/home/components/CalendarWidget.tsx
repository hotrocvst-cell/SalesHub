import { useState, useMemo, useEffect, useCallback } from 'react';
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
    Target,
    Trophy,
    Flame,
    Store,
    Bookmark
} from 'lucide-react';
import { getLunarDate } from '../utils/lunarCalendar';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { fetchStores, type StoreItem } from '../../../core/lib/storage';
import {
    type DailyWorkTarget,
    ALL_ASSIGNED_STORE_KEY,
    getLocalDailyTargets,
    syncDailyTargets,
    getMonthTargetStatsMap
} from '../services/dailyNotesService';
import DailyNotesTargetSection from './DailyNotesTargetSection';

export default function CalendarWidget() {
    const { currentUser, isAuthenticated, isAdmin } = useAuth();
    const today = useMemo(() => new Date(), []);
    const [viewDate, setViewDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
    const [selectedDate, setSelectedDate] = useState<Date>(today);

    // 1. Quản lý danh sách Siêu thị
    const [stores, setStores] = useState<StoreItem[]>([]);
    useEffect(() => {
        let isMounted = true;
        fetchStores().then(res => {
            if (isMounted && res.success && res.data) {
                setStores(res.data);
            }
        });
        return () => { isMounted = false; };
    }, []);

    // Danh sách siêu thị người dùng được phân quyền phụ trách
    const userAccessibleStores = useMemo<string[]>(() => {
        if (isAdmin) {
            return stores.map(s => s.name);
        }
        if (currentUser.accessible_stores && currentUser.accessible_stores.length > 0) {
            return currentUser.accessible_stores;
        }
        return currentUser.store_name ? [currentUser.store_name] : [];
    }, [isAdmin, currentUser, stores]);

    // 2. Siêu thị đang được chọn lọc dữ liệu
    const [selectedStore, setSelectedStore] = useState<string>(() => {
        if (currentUser.role === 'NHAN_VIEN' && currentUser.store_name) {
            return currentUser.store_name;
        }
        return ALL_ASSIGNED_STORE_KEY;
    });

    // Đồng bộ lại selectedStore nếu tài khoản là Nhân Viên
    useEffect(() => {
        if (currentUser.role === 'NHAN_VIEN' && currentUser.store_name) {
            setSelectedStore(currentUser.store_name);
        }
    }, [currentUser]);

    // 3. Dữ liệu mục tiêu ngày (Targets)
    const [targets, setTargets] = useState<DailyWorkTarget[]>(() => getLocalDailyTargets());

    const refreshTargets = useCallback(async () => {
        const synced = await syncDailyTargets();
        setTargets(synced);
    }, []);

    useEffect(() => {
        refreshTargets();
    }, [refreshTargets]);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth(); // 0 - 11

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

    // Bản đồ thống kê số lượng mục tiêu từng ngày theo Nhóm siêu thị đang chọn
    const monthTargetStatsMap = useMemo(() => {
        return getMonthTargetStatsMap(
            targets,
            year,
            month,
            selectedStore,
            userAccessibleStores,
            currentUser.role || 'NHAN_VIEN',
            currentUser.store_name
        );
    }, [targets, year, month, selectedStore, userAccessibleStores, currentUser]);

    // Thống kê tổng hợp toàn bộ tháng theo Nhóm siêu thị đang chọn
    const monthSummary = useMemo(() => {
        let total = 0;
        let completed = 0;
        for (const stats of Object.values(monthTargetStatsMap)) {
            total += stats.total;
            completed += stats.completed;
        }
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, pct };
    }, [monthTargetStatsMap]);

    // Thông tin ngày đang chọn
    const selectedLunar = useMemo(() => {
        return getLunarDate(selectedDate.getDate(), selectedDate.getMonth() + 1, selectedDate.getFullYear());
    }, [selectedDate]);

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

    return (
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-sm space-y-6">
            {/* Header: Tiêu đề, chọn tháng/năm, điều hướng */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20 shrink-0">
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
                            Theo dõi mục tiêu kinh doanh theo nhóm siêu thị, mốc chốt số và ghi chú công việc ngày
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
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold">
                        <Target className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-semibold">Mục tiêu tháng này</div>
                        <div className="font-mono font-black text-amber-800 text-sm">{monthSummary.total} mục tiêu</div>
                    </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-semibold">Tiến độ hoàn thành</div>
                        <div className="font-mono font-black text-emerald-800 text-sm">
                            {monthSummary.completed}/{monthSummary.total} ({monthSummary.pct}%)
                        </div>
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
                        const dayStats = monthTargetStatsMap[dateKey];
                        const hasTargets = dayStats && dayStats.total > 0;
                        const isAllDone = hasTargets && dayStats.completed === dayStats.total;
                        const hasUrgent = hasTargets && dayStats.hasUrgent && !isAllDone;
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
                                        {/* Huy hiệu mục tiêu công việc */}
                                        {hasTargets && (
                                            <span
                                                className={`px-1.5 py-0.2 rounded-md text-[9px] font-black font-mono flex items-center gap-0.5 shadow-2xs ${
                                                    isAllDone
                                                        ? 'bg-emerald-500 text-white'
                                                        : hasUrgent
                                                        ? 'bg-rose-500 text-white animate-pulse'
                                                        : 'bg-blue-600 text-white'
                                                }`}
                                                title={`Ngày có ${dayStats.total} mục tiêu (${dayStats.completed} đã xong)`}
                                            >
                                                <span>{dayStats.completed}/{dayStats.total}</span>
                                            </span>
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

            {/* Chi tiết ngày đang được chọn & Ghi chú mục tiêu công việc ngày */}
            <DailyNotesTargetSection
                selectedDate={selectedDate}
                selectedLunar={selectedLunar}
                selectedStore={selectedStore}
                setSelectedStore={setSelectedStore}
                availableStores={stores}
                userAccessibleStores={userAccessibleStores}
                currentUser={currentUser}
                isAuthenticated={isAuthenticated}
                targets={targets}
                onTargetsChanged={refreshTargets}
            />
        </div>
    );
}
