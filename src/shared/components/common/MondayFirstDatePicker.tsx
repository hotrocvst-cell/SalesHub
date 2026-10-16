import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import { formatDate } from '../../../core/lib/formatters';

interface MondayFirstDatePickerProps {
    value: string; // YYYY-MM-DD
    onChange: (dateStr: string) => void;
    label?: string; // 'Từ:' or 'Đến:'
    minDate?: string;
    maxDate?: string;
    disabled?: boolean;
    className?: string;
    placeholder?: string;
}

const WEEKDAYS = [
    { label: 'T2', title: 'Thứ Hai (Đầu tuần)' },
    { label: 'T3', title: 'Thứ Ba' },
    { label: 'T4', title: 'Thứ Tư' },
    { label: 'T5', title: 'Thứ Năm' },
    { label: 'T6', title: 'Thứ Sáu' },
    { label: 'T7', title: 'Thứ Bảy' },
    { label: 'CN', title: 'Chủ Nhật (Cuối tuần)', isWeekend: true },
];

export default function MondayFirstDatePicker({
    value,
    onChange,
    label,
    minDate,
    maxDate,
    disabled = false,
    className = '',
    placeholder = 'Chọn ngày...'
}: MondayFirstDatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse value to Date or fallback to today
    const parsedDate = useMemo(() => {
        if (!value) return new Date();
        const parts = value.split('-');
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            return new Date(y, m, d);
        }
        return new Date();
    }, [value]);

    const [viewYear, setViewYear] = useState<number>(parsedDate.getFullYear());
    const [viewMonth, setViewMonth] = useState<number>(parsedDate.getMonth()); // 0-11

    // Khi value đổi từ ngoài và lịch mở, cập nhật view
    useEffect(() => {
        if (value) {
            const parts = value.split('-');
            if (parts.length === 3) {
                setViewYear(parseInt(parts[0], 10));
                setViewMonth(parseInt(parts[1], 10) - 1);
            }
        }
    }, [value]);

    // Đóng dropdown khi click ra ngoài
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Các tính toán ngày trong tháng (Quy chuẩn Thứ Hai là ngày đầu tuần)
    const { calendarCells, currentMonthLabel } = useMemo(() => {
        const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
        const dayOfWeek = firstDayOfMonth.getDay(); // 0: CN, 1: T2, ..., 6: T7
        // Monday-first offset: T2 = 0, T3 = 1, ..., CN = 6
        const startOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

        const cells: Array<{
            day: number;
            dateStr: string;
            isCurrentMonth: boolean;
            isSelected: boolean;
            isToday: boolean;
            isDisabled: boolean;
        }> = [];

        const todayObj = new Date();
        const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

        // 1. Padding tháng trước
        for (let i = startOffset - 1; i >= 0; i--) {
            const prevDay = daysInPrevMonth - i;
            const prevMonthDate = new Date(viewYear, viewMonth - 1, prevDay);
            const y = prevMonthDate.getFullYear();
            const m = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
            const d = String(prevDay).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;
            cells.push({
                day: prevDay,
                dateStr,
                isCurrentMonth: false,
                isSelected: dateStr === value,
                isToday: dateStr === todayStr,
                isDisabled: (minDate && dateStr < minDate) || (maxDate && dateStr > maxDate) || false
            });
        }

        // 2. Ngày trong tháng hiện tại
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            cells.push({
                day: d,
                dateStr,
                isCurrentMonth: true,
                isSelected: dateStr === value,
                isToday: dateStr === todayStr,
                isDisabled: (minDate && dateStr < minDate) || (maxDate && dateStr > maxDate) || false
            });
        }

        // 3. Padding tháng kế tiếp (cho tròn bội số 7)
        const totalRemainder = (startOffset + daysInMonth) % 7;
        const nextMonthPadding = totalRemainder === 0 ? 0 : 7 - totalRemainder;
        for (let nextDay = 1; nextDay <= nextMonthPadding; nextDay++) {
            const nextMonthDate = new Date(viewYear, viewMonth + 1, nextDay);
            const y = nextMonthDate.getFullYear();
            const m = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
            const d = String(nextDay).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;
            cells.push({
                day: nextDay,
                dateStr,
                isCurrentMonth: false,
                isSelected: dateStr === value,
                isToday: dateStr === todayStr,
                isDisabled: (minDate && dateStr < minDate) || (maxDate && dateStr > maxDate) || false
            });
        }

        return {
            calendarCells: cells,
            currentMonthLabel: `Tháng ${viewMonth + 1} / ${viewYear}`
        };
    }, [viewYear, viewMonth, value, minDate, maxDate]);

    // Chuyển tháng
    const handlePrevMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear(v => v - 1);
        } else {
            setViewMonth(v => v - 1);
        }
    };

    const handleNextMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear(v => v + 1);
        } else {
            setViewMonth(v => v + 1);
        }
    };

    const handleSelectDate = (dateStr: string, isDisabled: boolean) => {
        if (isDisabled) return;
        onChange(dateStr);
        setIsOpen(false);
    };

    const handleJumpToday = (e: React.MouseEvent) => {
        e.stopPropagation();
        const t = new Date();
        const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        setViewYear(t.getFullYear());
        setViewMonth(t.getMonth());
        onChange(todayStr);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className={`relative inline-block ${className}`}>
            {/* INPUT CONTAINER TRIGGER */}
            <div
                onClick={() => {
                    if (!disabled) setIsOpen(!isOpen);
                }}
                className={`flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:border-indigo-400 px-2.5 py-1.5 rounded-xl text-xs cursor-pointer select-none transition-all ${
                    isOpen ? 'border-indigo-500 ring-2 ring-indigo-100 bg-white' : ''
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Nhấp để mở bảng chọn ngày (Lịch bắt đầu từ Thứ Hai)"
            >
                <CalendarIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                {label && <span className="text-[11px] font-bold text-slate-500">{label}</span>}
                <span className="font-semibold text-slate-800 text-xs tracking-tight">
                    {value ? formatDate(value) : placeholder}
                </span>
            </div>

            {/* BẢNG CALENDAR POPOVER (MONDAY-FIRST) */}
            {isOpen && (
                <div className="absolute left-0 top-full mt-1.5 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 w-[275px] sm:w-[290px] animate-fade-in backdrop-blur-md">
                    {/* HEADER: THÁNG / NĂM & ĐIỀU HƯỚNG */}
                    <div className="flex items-center justify-between gap-1 pb-2 mb-2 border-b border-slate-100">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
                            title="Tháng trước"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="text-center font-black text-xs text-slate-800">
                            {currentMonthLabel}
                        </div>

                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
                            title="Tháng sau"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* HÀNG TIÊU ĐỀ THỨ (THỨ HAI ĐẦU TIÊN) */}
                    <div className="grid grid-cols-7 gap-1 mb-1 text-center">
                        {WEEKDAYS.map((w, idx) => (
                            <div
                                key={idx}
                                title={w.title}
                                className={`text-[10px] font-black py-0.5 rounded-sm ${
                                    w.isWeekend ? 'text-rose-500' : 'text-slate-500'
                                }`}
                            >
                                {w.label}
                            </div>
                        ))}
                    </div>

                    {/* LƯỚI NGÀY TRONG THÁNG */}
                    <div className="grid grid-cols-7 gap-1">
                        {calendarCells.map((cell, idx) => {
                            const isSunday = idx % 7 === 6;
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    disabled={cell.isDisabled}
                                    onClick={() => handleSelectDate(cell.dateStr, cell.isDisabled)}
                                    className={`h-7 w-full rounded-lg text-[11px] font-bold flex items-center justify-center transition-all cursor-pointer relative ${
                                        cell.isSelected
                                            ? 'bg-indigo-600 text-white font-black shadow-xs scale-102'
                                            : cell.isToday
                                            ? 'border border-indigo-400 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100'
                                            : cell.isCurrentMonth
                                            ? isSunday
                                                ? 'text-rose-600 hover:bg-rose-50'
                                                : 'text-slate-700 hover:bg-slate-100'
                                            : 'text-slate-300 hover:bg-slate-50'
                                    } ${cell.isDisabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : ''}`}
                                    title={cell.dateStr}
                                >
                                    <span>{cell.day}</span>
                                    {cell.isToday && !cell.isSelected && (
                                        <span className="w-1 h-1 bg-indigo-500 rounded-full absolute bottom-0.5"></span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* FOOTER: NÚT HÔM NAY & ĐÓNG */}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-[11px]">
                        <button
                            type="button"
                            onClick={handleJumpToday}
                            className="text-indigo-600 hover:text-indigo-800 font-bold px-1.5 py-0.5 rounded-md hover:bg-indigo-50 transition cursor-pointer"
                        >
                            Hôm nay
                        </button>
                        <span className="text-[10px] text-slate-400 font-medium">
                            Lịch tuần từ T2
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="text-slate-500 hover:text-slate-700 font-bold px-1.5 py-0.5 rounded-md hover:bg-slate-100 transition cursor-pointer"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
