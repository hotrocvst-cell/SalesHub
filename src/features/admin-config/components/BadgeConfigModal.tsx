import { useState, useEffect } from 'react';
import { type SystemPagePermission, DEFAULT_PAGE_PERMISSIONS } from '../../../core/lib/permissions';
import {
    BADGE_PRESETS,
    BADGE_COLORS,
    POPULAR_BADGE_ICONS,
    type BadgeColorTheme,
    type BadgePreset,
    getBadgeStyles,
    getBadgeDotColor
} from '../../../core/lib/badgeConfig';
import {
    Tag,
    X,
    Sparkles,
    Check,
    Eye,
    EyeOff,
    RotateCcw,
    LayoutGrid,
    Palette,
    Layers,
    FileText
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    page: SystemPagePermission | null;
    onSave: (
        path: string,
        badgeConfig: {
            badge_enabled: boolean;
            badge_text: string;
            badge_icon: string;
            badge_color: string;
        }
    ) => void;
}

export default function BadgeConfigModal({
    isOpen,
    onClose,
    page,
    onSave
}: Props) {
    const [badgeEnabled, setBadgeEnabled] = useState<boolean>(true);
    const [badgeText, setBadgeText] = useState<string>('');
    const [badgeIcon, setBadgeIcon] = useState<string>('');
    const [badgeColor, setBadgeColor] = useState<BadgeColorTheme>('blue');

    // Khởi tạo state khi mở modal với trang cụ thể
    useEffect(() => {
        if (!page) return;

        const defaultDef = DEFAULT_PAGE_PERMISSIONS.find(d => d.path === page.path);

        setBadgeEnabled(
            page.badge_enabled !== undefined
                ? Boolean(page.badge_enabled)
                : (defaultDef?.badge_enabled ?? true)
        );
        setBadgeText(page.badge_text !== undefined ? page.badge_text : (defaultDef?.badge_text || ''));
        setBadgeIcon(page.badge_icon !== undefined ? page.badge_icon : (defaultDef?.badge_icon || ''));
        setBadgeColor(
            (page.badge_color as BadgeColorTheme) ||
            (defaultDef?.badge_color as BadgeColorTheme) ||
            'blue'
        );
    }, [page, isOpen]);

    if (!isOpen || !page) return null;

    // Áp dụng mẫu gợi ý 1 chạm
    const handleApplyPreset = (preset: BadgePreset) => {
        setBadgeEnabled(true);
        setBadgeIcon(preset.icon);
        setBadgeText(preset.text);
        setBadgeColor(preset.color);
    };

    // Khôi phục mặc định ban đầu của trang này
    const handleResetDefault = () => {
        const defaultDef = DEFAULT_PAGE_PERMISSIONS.find(d => d.path === page.path);
        setBadgeEnabled(defaultDef?.badge_enabled ?? true);
        setBadgeText(defaultDef?.badge_text || '');
        setBadgeIcon(defaultDef?.badge_icon || '');
        setBadgeColor((defaultDef?.badge_color as BadgeColorTheme) || 'blue');
    };

    // Lưu cấu hình
    const handleSave = () => {
        onSave(page.path, {
            badge_enabled: badgeEnabled,
            badge_text: badgeText.trim(),
            badge_icon: badgeIcon.trim(),
            badge_color: badgeColor
        });
        onClose();
    };

    const fullBadgePreview = [badgeIcon.trim(), badgeText.trim()].filter(Boolean).join(' ');

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-xl w-full p-4 sm:p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs">
                            <Tag className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm sm:text-base text-slate-800 flex items-center gap-2">
                                <span>Cấu Hình Badge Sidebar</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold border border-indigo-200">
                                    {page.group_title}
                                </span>
                            </h3>
                            <p className="text-[11px] text-slate-500 font-medium">
                                Trang: <b className="text-slate-700">{page.page_name}</b> <span className="font-mono text-indigo-600">({page.path})</span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
                        title="Đóng modal"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Vùng cuộn nội dung */}
                <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                    {/* KHUNG XEM TRƯỚC TRỰC QUAN (LIVE PREVIEW) */}
                    <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200/90 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                Xem Trước Thực Tế Trên Sidebar
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                                {badgeEnabled ? '🟢 Đang hiển thị' : '⚪ Đang ẩn'}
                            </span>
                        </div>

                        {/* Mô phỏng các trạng thái sidebar */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* Trạng thái 1: Mục thường (Inactive) */}
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                                    Khi chưa chọn (Thường):
                                </div>
                                <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200/60 text-slate-700 text-xs font-bold">
                                    <div className="flex items-center gap-2 truncate">
                                        <LayoutGrid className="w-4 h-4 text-slate-400 shrink-0" />
                                        <span className="truncate">{page.page_name}</span>
                                    </div>
                                    {badgeEnabled && fullBadgePreview ? (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black tracking-tight shrink-0 shadow-2xs ${getBadgeStyles(badgeColor, false)}`}>
                                            {fullBadgePreview}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-slate-300 italic">Không có badge</span>
                                    )}
                                </div>
                            </div>

                            {/* Trạng thái 2: Mục đang chọn (Active) */}
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                                    Khi đang chọn (Active):
                                </div>
                                <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-xs">
                                    <div className="flex items-center gap-2 truncate">
                                        <LayoutGrid className="w-4 h-4 text-white shrink-0" />
                                        <span className="truncate">{page.page_name}</span>
                                    </div>
                                    {badgeEnabled && fullBadgePreview ? (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black tracking-tight shrink-0 shadow-2xs ${getBadgeStyles(badgeColor, true)}`}>
                                            {fullBadgePreview}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-blue-200 italic">Không có badge</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Trạng thái 3: Chế độ thu gọn (Collapsed Dot) */}
                        <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600">
                            <span className="text-[11px] text-slate-500">Mô phỏng khi thu gọn sidebar:</span>
                            <div className="relative p-2 bg-slate-100 rounded-lg">
                                <LayoutGrid className="w-4 h-4 text-slate-600" />
                                {badgeEnabled && fullBadgePreview && (
                                    <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ring-2 ring-white ${getBadgeDotColor(badgeColor)}`} />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* MẪU GỢI Ý LÀM SẴN (PRESETS) */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                                Mẫu Gợi Ý Sẵn Có (1 Chạm Áp Dụng)
                            </label>
                            <span className="text-[11px] text-indigo-600 font-semibold">
                                {BADGE_PRESETS.length} mẫu chuẩn
                            </span>
                        </div>

                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                            {BADGE_PRESETS.map((preset) => {
                                const isCurrent = badgeIcon === preset.icon && badgeText === preset.text && badgeColor === preset.color;
                                return (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => handleApplyPreset(preset)}
                                        className={`p-2 rounded-xl border text-left transition cursor-pointer relative group flex flex-col justify-between ${
                                            isCurrent
                                                ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-300/40 shadow-xs'
                                                : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-black tracking-tight ${getBadgeStyles(preset.color, false)}`}>
                                                {preset.icon} {preset.text}
                                            </span>
                                            {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-medium truncate mt-1">
                                            {preset.description}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* TÙY CHỈNH CHI TIẾT */}
                    <div className="space-y-3 pt-2 border-t border-slate-200">
                        {/* 1. Bật / Tắt Badge */}
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                            <div>
                                <div className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                                    {badgeEnabled ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                                    <span>Trạng Thái Hiển Thị Badge</span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    {badgeEnabled ? 'Badge đang được hiển thị trên Sidebar' : 'Badge đang tạm ẩn trên Sidebar'}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setBadgeEnabled(!badgeEnabled)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                                    badgeEnabled
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                }`}
                            >
                                {badgeEnabled ? 'Đang Bật' : 'Đang Ẩn'}
                            </button>
                        </div>

                        {/* 2. Text Badge & Icon Input */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Nội dung Text */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                                    Nội Dung Chữ (Text)
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={badgeText}
                                        onChange={(e) => setBadgeText(e.target.value)}
                                        placeholder="Ví dụ: HOT, NEW, TOP, Admin..."
                                        maxLength={15}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                                    />
                                    {badgeText && (
                                        <button
                                            type="button"
                                            onClick={() => setBadgeText('')}
                                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                                            title="Xóa nội dung chữ"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                    <span>Khuyến nghị: 1 - 8 ký tự</span>
                                    <span className="font-mono">{badgeText.length}/15</span>
                                </div>
                            </div>

                            {/* Icon / Emoji Input */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    Icon / Emoji
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={badgeIcon}
                                        onChange={(e) => setBadgeIcon(e.target.value)}
                                        placeholder="Nhập hoặc dán emoji..."
                                        maxLength={6}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                                    />
                                    {badgeIcon && (
                                        <button
                                            type="button"
                                            onClick={() => setBadgeIcon('')}
                                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                                            title="Xóa icon"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    Có thể để trống nếu chỉ muốn hiển thị chữ
                                </div>
                            </div>
                        </div>

                        {/* 3. Bảng Icon Thông Dụng */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-600">
                                    Bảng icon nhanh:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setBadgeIcon('')}
                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                                >
                                    ✕ Không dùng icon
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-1 p-2 bg-slate-50 rounded-xl border border-slate-200">
                                {POPULAR_BADGE_ICONS.map((icon, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setBadgeIcon(icon)}
                                        className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition cursor-pointer ${
                                            badgeIcon === icon
                                                ? 'bg-indigo-600 text-white shadow-xs scale-110'
                                                : 'hover:bg-slate-200 bg-white border border-slate-200/60'
                                        }`}
                                        title={`Chọn icon ${icon}`}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 4. Chọn Màu Sắc / Theme */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                                <Palette className="w-3.5 h-3.5 text-purple-600" />
                                Chủ Đề Màu Sắc Badge
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {(Object.keys(BADGE_COLORS) as BadgeColorTheme[]).map((themeKey) => {
                                    const colorDef = BADGE_COLORS[themeKey];
                                    const isSelected = badgeColor === themeKey;
                                    return (
                                        <button
                                            key={themeKey}
                                            type="button"
                                            onClick={() => setBadgeColor(themeKey)}
                                            className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center gap-2 ${
                                                isSelected
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                                            }`}
                                        >
                                            <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${colorDef.previewBg}`} />
                                            <div className="truncate">
                                                <div className="text-[11px] font-black truncate">{colorDef.name.split(' ')[0]}</div>
                                                <div className={`text-[9px] truncate ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                                                    {themeKey}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-200 shrink-0">
                    <button
                        type="button"
                        onClick={handleResetDefault}
                        className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Khôi phục badge mặc định ban đầu"
                    >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                        <span>Mặc định ban đầu</span>
                    </button>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm hover:shadow flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <Check className="w-4 h-4" />
                            <span>Áp Dụng Badge</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
