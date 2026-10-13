import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    Settings,
    Star,
    Sparkles,
    MousePointerClick,
    Plus
} from 'lucide-react';
import { getLunarDate } from '../utils/lunarCalendar';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { fetchStores, type StoreItem } from '../../../core/lib/storage';
import {
    type DailyWorkNote,
    type CalendarSystemEvent,
    ALL_ASSIGNED_STORE_KEY,
    getLocalDailyNotes,
    syncDailyNotes,
    getMonthNotesMap,
    filterNotesForView,
    getCalendarSystemEvents,
    getMatchingSystemEventsForDate
} from '../services/dailyNotesService';
import WorkNoteModal from './WorkNoteModal';
import CalendarEventsConfigModal from './CalendarEventsConfigModal';
import WorkTaskListWidget from './WorkTaskListWidget';

export default function CalendarWidget() {
    const { currentUser, isAuthenticated, isAdmin } = useAuth();
    const today = useMemo(() => new Date(), []);
    const [viewDate, setViewDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
    const [selectedDate, setSelectedDate] = useState<Date>(today);

    // Ref tham chiếu đến vùng hiển thị bảng công việc cần làm để scroll mượt
    const taskSectionRef = useRef<HTMLDivElement | null>(null);

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
        if (currentUser?.accessible_stores && currentUser.accessible_stores.length > 0) {
            return currentUser.accessible_stores;
        }
        return currentUser?.store_name ? [currentUser.store_name] : [];
    }, [isAdmin, currentUser, stores]);

    // 2. Siêu thị đang được chọn lọc dữ liệu
    const [selectedStore, setSelectedStore] = useState<string>(() => {
        if (currentUser?.role === 'NHAN_VIEN' && currentUser?.store_name) {
            return currentUser.store_name;
        }
        return ALL_ASSIGNED_STORE_KEY;
    });

    useEffect(() => {
        if (currentUser?.role === 'NHAN_VIEN' && currentUser?.store_name) {
            setSelectedStore(currentUser.store_name);
        }
    }, [currentUser]);

    // 3. Dữ liệu Công việc / Ghi chú
    const [notes, setNotes] = useState<DailyWorkNote[]>(() => getLocalDailyNotes());

    const refreshNotes = useCallback(async () => {
        const synced = await syncDailyNotes();
        setNotes(synced);
    }, []);

    useEffect(() => {
        refreshNotes();
    }, [refreshNotes]);

    // 4. Dữ liệu Sự kiện hệ thống định kỳ trên lịch (Admin cấu hình)
    const [systemEvents, setSystemEvents] = useState<CalendarSystemEvent[]>(() => getCalendarSystemEvents());
    const [isEventsModalOpen, setIsEventsModalOpen] = useState(false);

    // 5. Modal Cập nhật / Xem công việc
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<DailyWorkNote | null>(null);

    const handleOpenAddModal = (date?: Date) => {
        const target = date || selectedDate;
        setSelectedDate(target);
        setEditingNote(null);
        setIsNoteModalOpen(true);
    };

    const handleOpenEditModal = (note: DailyWorkNote) => {
        const target = new Date(`${note.date_key}T00:00:00`);
        setSelectedDate(target);
        setEditingNote(note);
        setIsNoteModalOpen(true);
    };

    const handleCloseNoteModal = () => {
        setIsNoteModalOpen(false);
        setEditingNote(null);
    };

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth(); // 0 - 11

    function formatDateKey(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // Điều hướng tháng
    const handlePrevMonth = () => {
        setViewDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(year, month + 1, 1));
    };

    const handleJumpToday = () => {
        const now = new Date();
        setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
        setSelectedDate(now);
        // Scroll nhẹ về bảng công việc
        setTimeout(() => {
            taskSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
    };

    // Khi người dùng click chọn 1 ngày trên bảng lịch
    const handleSelectDate = (date: Date) => {
        setSelectedDate(date);

        // Yêu cầu 5: Tự động di chuyển đến vùng hiển thị bảng công việc cần làm
        setTimeout(() => {
            if (taskSectionRef.current) {
                taskSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 50);
    };

    // Tính toán các ngày trong bảng lịch thu gọn
    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const totalDaysInMonth = lastDayOfMonth.getDate();

        let firstDayIndex = firstDayOfMonth.getDay() - 1;
        if (firstDayIndex === -1) firstDayIndex = 6;

        const days = [];

        // 1. Ngày của tháng trước
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

        // 3. Ngày của tháng sau
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

    // Bản đồ công việc theo từng ngày trong tháng
    const monthNotesMap = useMemo(() => {
        return getMonthNotesMap(
            notes,
            year,
            month,
            selectedStore,
            userAccessibleStores,
            currentUser?.role || 'NHAN_VIEN',
            currentUser?.store_name
        );
    }, [notes, year, month, selectedStore, userAccessibleStores, currentUser]);

    // Thông tin ngày đang chọn
    const selectedDateKey = formatDateKey(selectedDate);
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

    // Danh sách công việc của ngày đang chọn
    const currentDayNotes = useMemo(() => {
        return filterNotesForView(
            notes,
            selectedDateKey,
            selectedStore,
            userAccessibleStores,
            currentUser?.role || 'NHAN_VIEN',
            currentUser?.store_name,
            selectedDate,
            selectedLunar
        );
    }, [notes, selectedDateKey, selectedStore, userAccessibleStores, currentUser, selectedDate, selectedLunar]);

    // Sự kiện hệ thống trùng khớp với ngày đang chọn
    const currentDaySystemEvents = useMemo(() => {
        return getMatchingSystemEventsForDate(systemEvents, selectedDate, selectedLunar);
    }, [systemEvents, selectedDate, selectedLunar]);

    const userRole = currentUser?.role || 'NHAN_VIEN';
    const canManage = isAuthenticated && (userRole === 'ADMIN' || userRole === 'QUAN_LY' || userRole === 'TRUONG_CA');
    const WEEKDAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    return (
        <div className="space-y-4">
            {/* BỐ CỤC CHÍNH: 2 CỘT TRÊN PC (CÔNG VIỆC VS CALENDAR THU GỌN), XẾP DỌC TRÊN MOBILE */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* 1. CỘT TRÁI: BẢNG CÔNG VIỆC CẦN LÀM & SỰ KIỆN (ƯU TIÊN TRÊN MOBILE & PC) */}
                <div className="lg:col-span-5 flex flex-col">
                    <WorkTaskListWidget
                        containerRef={taskSectionRef}
                        selectedDate={selectedDate}
                        selectedLunar={selectedLunar}
                        isTodaySelected={isTodaySelected}
                        diffDaysFromToday={diffDaysFromToday}
                        currentDayNotes={currentDayNotes}
                        systemEvents={currentDaySystemEvents}
                        selectedStore={selectedStore}
                        onSelectStore={setSelectedStore}
                        userAccessibleStores={userAccessibleStores}
                        availableStores={stores}
                        currentUser={currentUser}
                        canManage={canManage}
                        onOpenAddModal={() => handleOpenAddModal(selectedDate)}
                        onOpenEditModal={handleOpenEditModal}
                        onNotesChanged={refreshNotes}
                        onJumpToday={handleJumpToday}
                    />
                </div>

                {/* 2. CỘT PHẢI: BẢNG CALENDAR THU GỌN (COMPACT CALENDAR) */}
                <div className="lg:col-span-7 flex flex-col">
                    <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-sm flex flex-col justify-between h-full space-y-4">
                        {/* Header Calendar: Điều hướng Tháng / Năm & Nút Cấu hình Admin */}
                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 flex-wrap">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black border border-blue-100 shrink-0">
                                    <CalendarIcon className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm sm:text-base text-slate-900 tracking-tight flex items-center gap-2">
                                        <span>Lịch Tháng {month + 1} / {year}</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-400">
                                        Nhấp chọn ngày để xem việc • Nhấp đúp để tạo việc
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Nút Cấu hình sự kiện (chỉ dành cho Admin) */}
                                {isAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => setIsEventsModalOpen(true)}
                                        className="px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-700 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                        title="Cấu hình sự kiện định kỳ trên lịch (Khởi động, kỳ lương, giữa kỳ, chốt số, cúng mùng 2/16)"
                                    >
                                        <Settings className="w-3 h-3 text-indigo-600" />
                                        <span className="hidden sm:inline">Sự Kiện Lịch</span>
                                    </button>
                                )}

                                {/* Bộ chọn tháng & điều hướng */}
                                <select
                                    value={month}
                                    onChange={(e) => setViewDate(new Date(year, parseInt(e.target.value), 1))}
                                    className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                                >
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i} value={i}>Tháng {i + 1}</option>
                                    ))}
                                </select>

                                <select
                                    value={year}
                                    onChange={(e) => setViewDate(new Date(parseInt(e.target.value), month, 1))}
                                    className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                                >
                                    {[2024, 2025, 2026, 2027, 2028].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>

                                <div className="flex items-center border-l border-slate-200 pl-1">
                                    <button
                                        type="button"
                                        onClick={handlePrevMonth}
                                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                                        title="Tháng trước"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleNextMonth}
                                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                                        title="Tháng sau"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* BẢNG LƯỚI LỊCH THU GỌN (COMPACT GRID) */}
                        <div className="space-y-1">
                            {/* Thứ trong tuần */}
                            <div className="grid grid-cols-7 gap-1 text-center font-black text-[11px] text-slate-500 pb-1">
                                {WEEKDAY_NAMES.map((name, idx) => (
                                    <div
                                        key={name}
                                        className={`py-1 rounded-lg ${
                                            idx >= 5 ? 'text-rose-500 bg-rose-50/50' : 'text-slate-600 bg-slate-50/60'
                                        }`}
                                    >
                                        {name}
                                    </div>
                                ))}
                            </div>

                            {/* Các ô ngày */}
                            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                                {calendarDays.map((item, idx) => {
                                    const dateKey = formatDateKey(item.date);
                                    const isSelected = dateKey === selectedDateKey;
                                    const isToday =
                                        item.date.getDate() === today.getDate() &&
                                        item.date.getMonth() === today.getMonth() &&
                                        item.date.getFullYear() === today.getFullYear();

                                    const dayNotes = monthNotesMap[dateKey] || [];
                                    const daySystemEvents = getMatchingSystemEventsForDate(systemEvents, item.date, item.lunar);
                                    const hasItems = dayNotes.length > 0 || daySystemEvents.length > 0;

                                    // Nhận diện ngày cúng mùng 2 và 16 ÂL
                                    const isCungMung2 = item.lunar.day === 2;
                                    const isCung16 = item.lunar.day === 16;
                                    const isMung1 = item.lunar.day === 1;
                                    const isRam15 = item.lunar.day === 15;

                                    return (
                                        <div
                                            key={`${dateKey}_${idx}`}
                                            onClick={() => handleSelectDate(item.date)}
                                            onDoubleClick={() => canManage && handleOpenAddModal(item.date)}
                                            className={`min-h-[50px] sm:min-h-[62px] p-1 sm:p-1.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative group select-none ${
                                                isSelected
                                                    ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-300 shadow-xs z-10'
                                                    : isToday
                                                        ? 'bg-amber-50/60 border-amber-300 shadow-2xs'
                                                        : item.isCurrentMonth
                                                            ? 'bg-white hover:bg-slate-50 border-slate-200/80 shadow-2xs'
                                                            : 'bg-slate-50/40 border-slate-100 opacity-40'
                                            }`}
                                        >
                                            {/* Dòng trên: Số ngày dương + Badge chấm / Sự kiện */}
                                            <div className="flex items-center justify-between">
                                                <span
                                                    className={`font-black text-xs sm:text-sm font-mono ${
                                                        isSelected
                                                            ? 'text-blue-700 font-extrabold'
                                                            : isToday
                                                                ? 'text-amber-700'
                                                                : item.date.getDay() === 0
                                                                    ? 'text-rose-600'
                                                                    : 'text-slate-800'
                                                    }`}
                                                >
                                                    {item.dayNumber}
                                                </span>

                                                {/* Mini Icons / Dots chỉ thị */}
                                                <div className="flex items-center gap-0.5">
                                                    {daySystemEvents.length > 0 && (
                                                        <span className="text-[10px] leading-none" title={daySystemEvents[0].title}>
                                                            {daySystemEvents[0].icon}
                                                        </span>
                                                    )}
                                                    {dayNotes.length > 0 && (
                                                        <span
                                                            className="w-1.5 h-1.5 rounded-full bg-blue-600 shadow-xs shrink-0"
                                                            title={`${dayNotes.length} công việc`}
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Dòng giữa: Nhãn sự kiện nổi bật nếu có */}
                                            <div className="my-auto py-0.5 min-h-[14px]">
                                                {isCungMung2 && item.isCurrentMonth && (
                                                    <span className="text-[8px] font-black px-1 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200 truncate block leading-tight">
                                                        🎋 Cúng M2
                                                    </span>
                                                )}
                                                {isCung16 && item.isCurrentMonth && (
                                                    <span className="text-[8px] font-black px-1 py-0.2 rounded bg-orange-100 text-orange-900 border border-orange-200 truncate block leading-tight">
                                                        🎋 Cúng 16
                                                    </span>
                                                )}
                                                {!isCungMung2 && !isCung16 && daySystemEvents.length > 0 && item.isCurrentMonth && (
                                                    <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-indigo-100 text-indigo-800 truncate block leading-tight">
                                                        {daySystemEvents[0].title}
                                                    </span>
                                                )}
                                                {!isCungMung2 && !isCung16 && daySystemEvents.length === 0 && dayNotes.length > 0 && (
                                                    <span className="text-[8px] font-bold text-blue-700 truncate block leading-tight">
                                                        📌 {dayNotes[0].title}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Dòng dưới: Ngày âm lịch */}
                                            <div className="flex items-center justify-between text-[9px] pt-0.5 border-t border-slate-100/70">
                                                <span
                                                    className={`truncate font-mono ${
                                                        isMung1 || isRam15
                                                            ? 'text-rose-600 font-black'
                                                            : isCungMung2 || isCung16
                                                                ? 'text-amber-700 font-bold'
                                                                : 'text-slate-400'
                                                    }`}
                                                >
                                                    {item.lunar.lunarLabel}
                                                </span>

                                                {isMung1 && (
                                                    <span className="text-[7.5px] font-black px-0.5 rounded bg-rose-100 text-rose-700">
                                                        M1
                                                    </span>
                                                )}
                                                {isRam15 && (
                                                    <span className="text-[7.5px] font-black px-0.5 rounded bg-amber-100 text-amber-800">
                                                        Rằm
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Chú thích nhanh ở đáy Calendar */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                    <span>Việc cần làm</span>
                                </span>
                                <span className="flex items-center gap-1">
                                    <span>🎋</span>
                                    <span>Cúng mùng 2 & 16 ÂL</span>
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                    <span>Mùng 1 & Rằm</span>
                                </span>
                            </div>

                            <span className="text-slate-400 text-[10px]">
                                SalesHub Smart Calendar
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL CẤU HÌNH SỰ KIỆN HỆ THỐNG TRÊN LỊCH (CHO ADMIN) */}
            <CalendarEventsConfigModal
                isOpen={isEventsModalOpen}
                onClose={() => setIsEventsModalOpen(false)}
                onEventsChanged={(newEvents) => setSystemEvents(newEvents)}
            />

            {/* MODAL THÊM / SỬA CÔNG VIỆC CẦN LÀM */}
            <WorkNoteModal
                isOpen={isNoteModalOpen}
                onClose={handleCloseNoteModal}
                targetDate={selectedDate}
                selectedLunar={selectedLunar}
                selectedStore={selectedStore}
                userAccessibleStores={userAccessibleStores}
                availableStores={stores}
                currentUser={currentUser}
                dayNotes={currentDayNotes}
                onNotesChanged={refreshNotes}
                canManage={canManage}
                editingNote={editingNote}
            />
        </div>
    );
}
