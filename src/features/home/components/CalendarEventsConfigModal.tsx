import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    Calendar,
    Plus,
    Trash2,
    Edit2,
    Check,
    RotateCcw,
    Sparkles,
    Settings,
    Shield,
    CheckCircle2
} from 'lucide-react';
import {
    type CalendarSystemEvent,
    getCalendarSystemEvents,
    saveCalendarSystemEvents,
    resetCalendarSystemEvents,
    DEFAULT_SYSTEM_EVENTS
} from '../services/dailyNotesService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onEventsChanged: (events: CalendarSystemEvent[]) => void;
}

const EMOJI_OPTIONS = ['🚀', '💰', '📊', '🎯', '🎋', '⭐', '🏆', '🔥', '🎁', '🛡️', '📦', '🎉', '🔔'];
const COLOR_OPTIONS: Array<{ key: CalendarSystemEvent['color_theme']; label: string; classBg: string }> = [
    { key: 'emerald', label: 'Xanh Lá', classBg: 'bg-emerald-500' },
    { key: 'amber', label: 'Vàng Hổ Phách', classBg: 'bg-amber-500' },
    { key: 'blue', label: 'Xanh Dương', classBg: 'bg-blue-500' },
    { key: 'rose', label: 'Đỏ Hoa Hồng', classBg: 'bg-rose-500' },
    { key: 'purple', label: 'Tím', classBg: 'bg-purple-500' },
    { key: 'orange', label: 'Cam', classBg: 'bg-orange-500' },
    { key: 'cyan', label: 'Xanh Ngọc', classBg: 'bg-cyan-500' }
];

export default function CalendarEventsConfigModal({
    isOpen,
    onClose,
    onEventsChanged
}: Props) {
    const [events, setEvents] = useState<CalendarSystemEvent[]>(() => getCalendarSystemEvents());
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form inputs
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [ruleType, setRuleType] = useState<CalendarSystemEvent['rule_type']>('SOLAR_DAY');
    const [dayValue, setDayValue] = useState<number>(1);
    const [colorTheme, setColorTheme] = useState<CalendarSystemEvent['color_theme']>('blue');
    const [icon, setIcon] = useState<string>('⭐');
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const closeBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        setEvents(getCalendarSystemEvents());
        setEditingId(null);
        resetForm();
        const prevFocused = document.activeElement as HTMLElement | null;
        closeBtnRef.current?.focus();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            prevFocused?.focus?.();
        };
    }, [isOpen, onClose]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2500);
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setRuleType('SOLAR_DAY');
        setDayValue(1);
        setColorTheme('blue');
        setIcon('⭐');
        setEditingId(null);
    };

    const handleStartEdit = (ev: CalendarSystemEvent) => {
        setEditingId(ev.id);
        setTitle(ev.title);
        setDescription(ev.description || '');
        setRuleType(ev.rule_type);
        setDayValue(ev.day_value);
        setColorTheme(ev.color_theme);
        setIcon(ev.icon);
    };

    const handleSaveEvent = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            showToast('⚠️ Vui lòng nhập tên sự kiện!');
            return;
        }

        let updatedList: CalendarSystemEvent[];

        if (editingId) {
            updatedList = events.map(ev => {
                if (ev.id === editingId) {
                    return {
                        ...ev,
                        title: trimmedTitle,
                        description: description.trim() || undefined,
                        rule_type: ruleType,
                        day_value: ruleType === 'SOLAR_LAST_DAY' ? 0 : Number(dayValue) || 1,
                        color_theme: colorTheme,
                        icon,
                        is_enabled: true
                    };
                }
                return ev;
            });
            showToast('✅ Đã cập nhật sự kiện thành công!');
        } else {
            const newEv: CalendarSystemEvent = {
                id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                title: trimmedTitle,
                description: description.trim() || undefined,
                rule_type: ruleType,
                day_value: ruleType === 'SOLAR_LAST_DAY' ? 0 : Number(dayValue) || 1,
                color_theme: colorTheme,
                icon,
                is_enabled: true,
                notify_roles: 'ALL'
            };
            updatedList = [...events, newEv];
            showToast('🎉 Đã thêm sự kiện mới vào lịch!');
        }

        setEvents(updatedList);
        saveCalendarSystemEvents(updatedList);
        onEventsChanged(updatedList);
        resetForm();
    };

    const handleToggleEvent = (id: string) => {
        const updated = events.map(ev => {
            if (ev.id === id) {
                return { ...ev, is_enabled: !ev.is_enabled };
            }
            return ev;
        });
        setEvents(updated);
        saveCalendarSystemEvents(updated);
        onEventsChanged(updated);
    };

    const handleDeleteEvent = (id: string) => {
        const updated = events.filter(ev => ev.id !== id);
        setEvents(updated);
        saveCalendarSystemEvents(updated);
        onEventsChanged(updated);
        if (editingId === id) resetForm();
        showToast('🗑️ Đã xóa sự kiện khỏi lịch!');
    };

    const handleResetDefaults = () => {
        const defaults = resetCalendarSystemEvents();
        setEvents(defaults);
        onEventsChanged(defaults);
        resetForm();
        showToast('🔄 Đã khôi phục các sự kiện mặc định của hệ thống!');
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 !mt-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="calendar-events-modal-title"
                className="relative bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Toast thông báo */}
                {toastMessage && (
                    <div role="status" aria-live="polite" className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-white/20">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                        <span>{toastMessage}</span>
                    </div>
                )}

                {/* Header Modal */}
                <div className="px-4 sm:px-5 py-3.5 sm:py-4 bg-blue-700 text-white flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center font-black text-amber-300 shrink-0 border border-white/20" aria-hidden="true">
                            <Settings className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 id="calendar-events-modal-title" className="font-black text-sm sm:text-base flex items-center gap-2 flex-wrap">
                                <span>Cấu Hình Sự Kiện Định Kỳ Trên Lịch</span>
                                <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black uppercase">Admin</span>
                            </h2>
                            <p className="text-xs text-blue-100">
                                Quản lý các mốc kinh doanh, kỳ lương, giữa kỳ, chốt số &amp; ngày cúng âm lịch
                            </p>
                        </div>
                    </div>

                    <button
                        ref={closeBtnRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng cấu hình sự kiện lịch"
                        className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>

                {/* Body cuộn */}
                <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-5 flex-1 text-xs">
                    {/* Danh sách sự kiện hiện hành */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-slate-800 text-xs tabular-nums">
                                📋 Danh Sách Sự Kiện Hiện Hành ({events.length}):
                            </span>
                            <button
                                type="button"
                                onClick={handleResetDefaults}
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                            >
                                <RotateCcw className="w-3 h-3 shrink-0" aria-hidden="true" />
                                <span>Khôi phục mặc định</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {events.map((ev) => {
                                const isEditing = editingId === ev.id;
                                return (
                                    <div
                                        key={ev.id}
                                        className={`p-3 rounded-2xl border transition flex items-start justify-between gap-2.5 ${
                                            isEditing
                                                ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-200'
                                                : ev.is_enabled
                                                    ? 'bg-slate-50/80 hover:bg-white border-slate-200'
                                                    : 'bg-slate-100/60 border-slate-200 opacity-60'
                                        }`}
                                    >
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            <span className="text-xl shrink-0 select-none" aria-hidden="true">{ev.icon}</span>
                                            <div className="min-w-0">
                                                <div className="font-extrabold text-slate-900 text-xs truncate flex items-center gap-1.5">
                                                    <span>{ev.title}</span>
                                                    {!ev.is_enabled && (
                                                        <span className="text-[9px] px-1 rounded bg-slate-200 text-slate-600 font-bold">Đã tắt</span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-indigo-700 font-bold mt-0.5">
                                                    {ev.rule_type === 'SOLAR_DAY' && `Ngày ${ev.day_value} Dương lịch hàng tháng`}
                                                    {ev.rule_type === 'SOLAR_LAST_DAY' && 'Ngày cuối cùng Dương lịch mỗi tháng'}
                                                    {ev.rule_type === 'LUNAR_DAY' && `Ngày ${ev.day_value} Âm lịch hàng tháng`}
                                                </div>
                                                {ev.description && (
                                                    <p className="text-[10px] text-slate-600 line-clamp-1 mt-0.5">
                                                        {ev.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            {/* Bật / Tắt */}
                                            <button
                                                type="button"
                                                onClick={() => handleToggleEvent(ev.id)}
                                                aria-label={ev.is_enabled ? `Tắt sự kiện ${ev.title}` : `Bật sự kiện ${ev.title}`}
                                                className={`w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                                    ev.is_enabled
                                                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                                }`}
                                                title={ev.is_enabled ? 'Bấm để tắt hiển thị' : 'Bấm để bật hiển thị'}
                                            >
                                                {ev.is_enabled ? <Check className="w-3 h-3" aria-hidden="true" /> : <X className="w-3 h-3" aria-hidden="true" />}
                                            </button>

                                            {/* Sửa */}
                                            <button
                                                type="button"
                                                onClick={() => handleStartEdit(ev)}
                                                aria-label={`Sửa sự kiện ${ev.title}`}
                                                className="w-6 h-6 rounded-lg bg-white hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 border border-slate-200 flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                                title="Sửa sự kiện"
                                            >
                                                <Edit2 className="w-3 h-3" aria-hidden="true" />
                                            </button>

                                            {/* Xóa */}
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteEvent(ev.id)}
                                                aria-label={`Xóa sự kiện ${ev.title}`}
                                                className="w-6 h-6 rounded-lg bg-white hover:bg-rose-100 text-slate-500 hover:text-rose-600 border border-slate-200 flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                                                title="Xóa sự kiện"
                                            >
                                                <Trash2 className="w-3 h-3" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* FORM THÊM / CHỈNH SỬA SỰ KIỆN */}
                    <form onSubmit={handleSaveEvent} className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3.5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="font-black text-slate-800 flex items-center gap-1.5">
                                {editingId ? <Edit2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5 text-indigo-600 shrink-0" aria-hidden="true" />}
                                <span>{editingId ? 'Chỉnh sửa sự kiện:' : 'Thêm sự kiện sẵn có mới:'}</span>
                            </span>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="text-[11px] text-slate-600 hover:text-slate-900 font-bold hover:underline cursor-pointer"
                                >
                                    Hủy sửa
                                </button>
                            )}
                        </div>

                        {/* Tên sự kiện */}
                        <div>
                            <label htmlFor="cal-event-title" className="block text-xs font-bold text-slate-700 mb-1">
                                Tên sự kiện <span className="text-rose-500">*</span>:
                            </label>
                            <input
                                id="cal-event-title"
                                name="eventTitle"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ví dụ: Khởi Động; Kỳ Lương; Chốt Số; Cúng Mùng 2 ÂL..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                            />
                        </div>

                        {/* Quy tắc ngày & Giá trị ngày */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="cal-event-rule" className="block text-xs font-bold text-slate-700 mb-1">
                                    Quy tắc lặp lại:
                                </label>
                                <select
                                    id="cal-event-rule"
                                    name="eventRule"
                                    value={ruleType}
                                    onChange={(e) => setRuleType(e.target.value as CalendarSystemEvent['rule_type'])}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                >
                                    <option value="SOLAR_DAY">📅 Ngày Dương Lịch hàng tháng</option>
                                    <option value="SOLAR_LAST_DAY">🎯 Ngày Cuối Tháng Dương Lịch</option>
                                    <option value="LUNAR_DAY">🌙 Ngày Âm Lịch hàng tháng (Ví dụ: 2, 16)</option>
                                </select>
                            </div>

                            {ruleType !== 'SOLAR_LAST_DAY' && (
                                <div>
                                    <label htmlFor="cal-event-day" className="block text-xs font-bold text-slate-700 mb-1">
                                        Ngày trong tháng ({ruleType === 'LUNAR_DAY' ? 'Âm lịch: 1..30' : 'Dương lịch: 1..31'}):
                                    </label>
                                    <input
                                        id="cal-event-day"
                                        name="eventDay"
                                        type="number"
                                        min={1}
                                        max={ruleType === 'LUNAR_DAY' ? 30 : 31}
                                        value={dayValue}
                                        onChange={(e) => setDayValue(parseInt(e.target.value) || 1)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold tabular-nums text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Emoji & Tông màu */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <div className="block text-xs font-bold text-slate-700 mb-1">
                                    Biểu tượng Emoji:
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {EMOJI_OPTIONS.map((em) => (
                                        <button
                                            key={em}
                                            type="button"
                                            aria-pressed={icon === em}
                                            onClick={() => setIcon(em)}
                                            className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                                icon === em
                                                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-300 scale-110'
                                                    : 'bg-white hover:bg-slate-100 border border-slate-200'
                                            }`}
                                        >
                                            {em}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div className="block text-xs font-bold text-slate-700 mb-1">
                                    Tông màu huy hiệu:
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {COLOR_OPTIONS.map((col) => (
                                        <button
                                            key={col.key}
                                            type="button"
                                            aria-pressed={colorTheme === col.key}
                                            onClick={() => setColorTheme(col.key)}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${col.classBg} ${
                                                colorTheme === col.key ? 'ring-2 ring-slate-900 ring-offset-1 scale-105' : 'opacity-85'
                                            }`}
                                        >
                                            <span>{col.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Mô tả */}
                        <div>
                            <label htmlFor="cal-event-desc" className="block text-xs font-bold text-slate-700 mb-1">
                                Mô tả ý nghĩa sự kiện (Tùy chọn):
                            </label>
                            <input
                                id="cal-event-desc"
                                name="eventDesc"
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Ghi chú nội dung triển khai cho sự kiện này..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        {/* Nút submit */}
                        <div className="pt-2 flex items-center justify-end gap-2 border-t border-indigo-100">
                            <button
                                type="submit"
                                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-sm transition flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            >
                                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                                <span>{editingId ? 'Cập Nhật Sự Kiện' : 'Lưu Sự Kiện Mới'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
}
