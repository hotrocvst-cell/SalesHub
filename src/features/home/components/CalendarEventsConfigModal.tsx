import { useState, useEffect } from 'react';
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

    useEffect(() => {
        if (isOpen) {
            setEvents(getCalendarSystemEvents());
            setEditingId(null);
            resetForm();
        }
    }, [isOpen]);

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

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* Toast thông báo */}
                {toastMessage && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-60 bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-white/20 animate-in fade-in slide-in-from-top-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{toastMessage}</span>
                    </div>
                )}

                {/* Header Modal */}
                <div className="px-5 py-4 bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-800 text-white flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center font-black text-amber-300 shrink-0 border border-white/20">
                            <Settings className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="font-black text-sm sm:text-base flex items-center gap-2">
                                <span>Cấu Hình Sự Kiện Định Kỳ Trên Lịch</span>
                                <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[10px] font-black uppercase">Admin</span>
                            </div>
                            <p className="text-xs text-blue-100">
                                Quản lý các mốc kinh doanh, kỳ lương, giữa kỳ, chốt số & ngày cúng âm lịch
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body cuộn */}
                <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
                    {/* Danh sách sự kiện hiện hành */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="font-extrabold text-slate-800 text-xs">
                                📋 Danh Sách Sự Kiện Hiện Hành ({events.length}):
                            </span>
                            <button
                                type="button"
                                onClick={handleResetDefaults}
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                            >
                                <RotateCcw className="w-3 h-3" />
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
                                            <span className="text-xl shrink-0 select-none">{ev.icon}</span>
                                            <div className="min-w-0">
                                                <div className="font-extrabold text-slate-900 text-xs truncate flex items-center gap-1.5">
                                                    <span>{ev.title}</span>
                                                    {!ev.is_enabled && (
                                                        <span className="text-[9px] px-1 rounded bg-slate-200 text-slate-600 font-bold">Đã tắt</span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-indigo-600 font-bold mt-0.5">
                                                    {ev.rule_type === 'SOLAR_DAY' && `Ngày ${ev.day_value} Dương lịch hàng tháng`}
                                                    {ev.rule_type === 'SOLAR_LAST_DAY' && 'Ngày cuối cùng Dương lịch mỗi tháng'}
                                                    {ev.rule_type === 'LUNAR_DAY' && `Ngày ${ev.day_value} Âm lịch hàng tháng`}
                                                </div>
                                                {ev.description && (
                                                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
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
                                                className={`w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center transition cursor-pointer ${
                                                    ev.is_enabled
                                                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                                        : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                                }`}
                                                title={ev.is_enabled ? 'Bấm để tắt hiển thị' : 'Bấm để bật hiển thị'}
                                            >
                                                {ev.is_enabled ? '✓' : '✕'}
                                            </button>

                                            {/* Sửa */}
                                            <button
                                                type="button"
                                                onClick={() => handleStartEdit(ev)}
                                                className="w-6 h-6 rounded-lg bg-white hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 border border-slate-200 flex items-center justify-center transition cursor-pointer"
                                                title="Sửa sự kiện"
                                            >
                                                <Edit2 className="w-3 h-3" />
                                            </button>

                                            {/* Xóa */}
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteEvent(ev.id)}
                                                className="w-6 h-6 rounded-lg bg-white hover:bg-rose-100 text-slate-400 hover:text-rose-600 border border-slate-200 flex items-center justify-center transition cursor-pointer"
                                                title="Xóa sự kiện"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* FORM THÊM / CHỈNH SỬA SỰ KIỆN */}
                    <form onSubmit={handleSaveEvent} className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <span className="font-black text-slate-800 flex items-center gap-1.5">
                                {editingId ? <Edit2 className="w-3.5 h-3.5 text-indigo-600" /> : <Plus className="w-3.5 h-3.5 text-indigo-600" />}
                                <span>{editingId ? 'Chỉnh sửa sự kiện:' : 'Thêm sự kiện sẵn có mới:'}</span>
                            </span>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="text-[11px] text-slate-500 hover:text-slate-800 font-bold hover:underline"
                                >
                                    Hủy sửa
                                </button>
                            )}
                        </div>

                        {/* Tên sự kiện */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Tên sự kiện <span className="text-rose-500">*</span>:
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ví dụ: Khởi Động; Kỳ Lương; Chốt Số; Cúng Mùng 2 ÂL..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>

                        {/* Quy tắc ngày & Giá trị ngày */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Quy tắc lặp lại:
                                </label>
                                <select
                                    value={ruleType}
                                    onChange={(e) => setRuleType(e.target.value as any)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 text-xs outline-none cursor-pointer"
                                >
                                    <option value="SOLAR_DAY">📅 Ngày Dương Lịch hàng tháng</option>
                                    <option value="SOLAR_LAST_DAY">🎯 Ngày Cuối Tháng Dương Lịch</option>
                                    <option value="LUNAR_DAY">🌙 Ngày Âm Lịch hàng tháng (Ví dụ: 2, 16)</option>
                                </select>
                            </div>

                            {ruleType !== 'SOLAR_LAST_DAY' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Ngày trong tháng ({ruleType === 'LUNAR_DAY' ? 'Âm lịch: 1..30' : 'Dương lịch: 1..31'}):
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={ruleType === 'LUNAR_DAY' ? 30 : 31}
                                        value={dayValue}
                                        onChange={(e) => setDayValue(parseInt(e.target.value) || 1)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 text-xs outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Emoji & Tông màu */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Biểu tượng Emoji:
                                </label>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {EMOJI_OPTIONS.map((em) => (
                                        <button
                                            key={em}
                                            type="button"
                                            onClick={() => setIcon(em)}
                                            className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition cursor-pointer ${
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
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Tông màu huy hiệu:
                                </label>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {COLOR_OPTIONS.map((col) => (
                                        <button
                                            key={col.key}
                                            type="button"
                                            onClick={() => setColorTheme(col.key)}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1 transition cursor-pointer ${col.classBg} ${
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
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Mô tả ý nghĩa sự kiện (Tùy chọn):
                            </label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Ghi chú nội dung triển khai cho sự kiện này..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 outline-none"
                            />
                        </div>

                        {/* Nút submit */}
                        <div className="pt-2 flex items-center justify-end gap-2 border-t border-indigo-100">
                            <button
                                type="submit"
                                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                            >
                                <Check className="w-4 h-4" />
                                <span>{editingId ? 'Cập Nhật Sự Kiện' : 'Lưu Sự Kiện Mới'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
