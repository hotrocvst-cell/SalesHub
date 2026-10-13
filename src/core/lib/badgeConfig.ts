export type BadgeColorTheme = 'rose' | 'amber' | 'emerald' | 'blue' | 'purple' | 'indigo' | 'slate';

export interface BadgeColorDefinition {
    id: BadgeColorTheme;
    name: string;
    description: string;
    pillClass: string;
    activePillClass: string;
    dotClass: string;
    borderClass: string;
    previewBg: string;
}

export const BADGE_COLORS: Record<BadgeColorTheme, BadgeColorDefinition> = {
    rose: {
        id: 'rose',
        name: 'Đỏ Lửa (Rose)',
        description: 'Nổi bật, cấp bách, khuyến mãi nóng',
        pillClass: 'bg-rose-100 text-rose-700 border border-rose-200/80',
        activePillClass: 'bg-rose-500/25 text-rose-100 border border-rose-300/40 backdrop-blur-xs',
        dotClass: 'bg-rose-500',
        borderClass: 'border-rose-400',
        previewBg: 'bg-rose-500'
    },
    amber: {
        id: 'amber',
        name: 'Vàng Cam (Amber)',
        description: 'Vinh danh, Top, Boss, thi đua',
        pillClass: 'bg-amber-100 text-amber-800 border border-amber-200/80',
        activePillClass: 'bg-amber-500/25 text-amber-100 border border-amber-300/40 backdrop-blur-xs',
        dotClass: 'bg-amber-400',
        borderClass: 'border-amber-400',
        previewBg: 'bg-amber-500'
    },
    emerald: {
        id: 'emerald',
        name: 'Xanh Lục (Emerald)',
        description: 'Mới, hoạt động tốt, đạt chuẩn',
        pillClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200/80',
        activePillClass: 'bg-emerald-500/25 text-emerald-100 border border-emerald-300/40 backdrop-blur-xs',
        dotClass: 'bg-emerald-400',
        borderClass: 'border-emerald-400',
        previewBg: 'bg-emerald-500'
    },
    blue: {
        id: 'blue',
        name: 'Xanh Dương (Blue)',
        description: 'Chuẩn giao diện, hiện đại, realtime',
        pillClass: 'bg-blue-100 text-blue-700 border border-blue-200/80',
        activePillClass: 'bg-white/20 text-white border border-white/30 backdrop-blur-xs',
        dotClass: 'bg-sky-400',
        borderClass: 'border-blue-400',
        previewBg: 'bg-blue-500'
    },
    purple: {
        id: 'purple',
        name: 'Tím Quản Trị (Purple)',
        description: 'Admin, quyền hạn, bảo mật cao',
        pillClass: 'bg-purple-100 text-purple-800 border border-purple-200/80',
        activePillClass: 'bg-purple-500/25 text-purple-100 border border-purple-300/40 backdrop-blur-xs',
        dotClass: 'bg-purple-400',
        borderClass: 'border-purple-400',
        previewBg: 'bg-purple-500'
    },
    indigo: {
        id: 'indigo',
        name: 'Chàm Chuyên Sâu (Indigo)',
        description: 'Pro, chuyên gia, báo cáo đa chiều',
        pillClass: 'bg-indigo-100 text-indigo-800 border border-indigo-200/80',
        activePillClass: 'bg-indigo-500/25 text-indigo-100 border border-indigo-300/40 backdrop-blur-xs',
        dotClass: 'bg-indigo-400',
        borderClass: 'border-indigo-400',
        previewBg: 'bg-indigo-500'
    },
    slate: {
        id: 'slate',
        name: 'Xám Tối Giản (Slate)',
        description: 'Nhã nhặn, phụ trợ, thông tin nhẹ nhàng',
        pillClass: 'bg-slate-100 text-slate-700 border border-slate-200/80',
        activePillClass: 'bg-white/20 text-white border border-white/30 backdrop-blur-xs',
        dotClass: 'bg-slate-400',
        borderClass: 'border-slate-400',
        previewBg: 'bg-slate-500'
    }
};

export interface BadgePreset {
    id: string;
    label: string;
    icon: string;
    text: string;
    color: BadgeColorTheme;
    description: string;
}

export const BADGE_PRESETS: BadgePreset[] = [
    {
        id: 'hot',
        label: 'HOT',
        icon: '🔥',
        text: 'HOT',
        color: 'rose',
        description: 'Nổi bật, quan tâm cao'
    },
    {
        id: 'new',
        label: 'NEW',
        icon: '⚡',
        text: 'NEW',
        color: 'blue',
        description: 'Tính năng mới phát hành'
    },
    {
        id: 'top',
        label: 'TOP',
        icon: '🏆',
        text: 'TOP',
        color: 'amber',
        description: 'Xếp hạng, vinh danh'
    },
    {
        id: 'admin',
        label: 'Admin',
        icon: '🛡️',
        text: 'Admin',
        color: 'purple',
        description: 'Đặc quyền ban quản trị'
    },
    {
        id: 'moi',
        label: 'Mới',
        icon: '✨',
        text: 'Mới',
        color: 'emerald',
        description: 'Tiện ích mới bổ sung'
    },
    {
        id: 'pro',
        label: 'PRO',
        icon: '💎',
        text: 'PRO',
        color: 'indigo',
        description: 'Chuyên sâu & nâng cao'
    },
    {
        id: 'boss',
        label: 'Boss',
        icon: '👑',
        text: 'Boss',
        color: 'amber',
        description: 'Dành riêng cho Quản lý'
    },
    {
        id: 'uudai',
        label: 'Ưu Đãi',
        icon: '🎁',
        text: 'Ưu Đãi',
        color: 'rose',
        description: 'Voucher & khuyến mãi'
    },
    {
        id: 'realtime',
        label: 'Realtime',
        icon: '🚀',
        text: 'Realtime',
        color: 'blue',
        description: 'Số liệu trực tiếp'
    },
    {
        id: 'rt',
        label: 'RT',
        icon: '⚡',
        text: 'RT',
        color: 'blue',
        description: 'Báo cáo ngày Realtime'
    },
    {
        id: 'ql',
        label: 'QL',
        icon: '🔑',
        text: 'QL',
        color: 'purple',
        description: 'Quản lý kho & điều hành'
    },
    {
        id: 'dacsac',
        label: 'Đặc Sắc',
        icon: '⭐',
        text: 'Đặc Sắc',
        color: 'amber',
        description: 'Tiện ích nổi trội'
    }
];

export const POPULAR_BADGE_ICONS: string[] = [
    '🔥', '⚡', '✨', '🏆', '⭐', '💎', '👑', '🛡️',
    '🎁', '🚀', '🔑', '🎯', '📊', '💡', '🏷️', '🏢',
    '⚙️', '❤️', '🌟', '📈', '📌', '🔔', '💼', '🎉'
];

/**
 * Trả về class style cho badge dựa trên màu sắc và trạng thái Active
 */
export function getBadgeStyles(colorTheme?: string, isActive?: boolean): string {
    const validKey = (colorTheme && colorTheme in BADGE_COLORS)
        ? (colorTheme as BadgeColorTheme)
        : 'blue';
    const def = BADGE_COLORS[validKey];

    return isActive ? def.activePillClass : def.pillClass;
}

/**
 * Trả về class màu sắc cho dấu chấm hiển thị khi sidebar thu gọn
 */
export function getBadgeDotColor(colorTheme?: string): string {
    const validKey = (colorTheme && colorTheme in BADGE_COLORS)
        ? (colorTheme as BadgeColorTheme)
        : 'blue';

    return BADGE_COLORS[validKey].dotClass;
}

/**
 * Ghép icon và text thành chuỗi badge hoàn chỉnh
 */
export function formatBadgeString(icon?: string, text?: string): string {
    const cleanIcon = icon?.trim() || '';
    const cleanText = text?.trim() || '';
    return [cleanIcon, cleanText].filter(Boolean).join(' ');
}
