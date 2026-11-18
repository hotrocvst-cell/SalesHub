import type { OcrToolCategory, SampleDataGroup } from '../types';

export interface OcrCategoryMeta {
    category: OcrToolCategory;
    shortLabel: string;
    scopeBadge: 'Lũy kế' | 'Realtime' | 'Khác';
    targetBadge: 'ST' | 'NV' | 'Chung';
    defaultPath: string;
    pillActiveClass: string;
    accentBadgeClass: string;
}

export const OCR_CATEGORY_META: Record<OcrToolCategory, OcrCategoryMeta> = {
    cumulative_store: {
        category: 'cumulative_store',
        shortLabel: 'Lũy kế ST',
        scopeBadge: 'Lũy kế',
        targetBadge: 'ST',
        defaultPath: '/cap-nhat-ocr',
        pillActiveClass: 'bg-blue-700 text-white border-blue-700',
        accentBadgeClass: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    cumulative_employee: {
        category: 'cumulative_employee',
        shortLabel: 'Lũy kế NV',
        scopeBadge: 'Lũy kế',
        targetBadge: 'NV',
        defaultPath: '/cap-nhat-nhan-vien-ocr',
        pillActiveClass: 'bg-indigo-700 text-white border-indigo-700',
        accentBadgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200'
    },
    realtime_store: {
        category: 'realtime_store',
        shortLabel: 'Realtime ST',
        scopeBadge: 'Realtime',
        targetBadge: 'ST',
        defaultPath: '/bc-ngay/tong-quan',
        pillActiveClass: 'bg-emerald-700 text-white border-emerald-700',
        accentBadgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    },
    realtime_employee: {
        category: 'realtime_employee',
        shortLabel: 'Realtime NV',
        scopeBadge: 'Realtime',
        targetBadge: 'NV',
        defaultPath: '/bc-ngay-nhan-vien',
        pillActiveClass: 'bg-teal-700 text-white border-teal-700',
        accentBadgeClass: 'bg-teal-100 text-teal-800 border-teal-200'
    },
    other: {
        category: 'other',
        shortLabel: 'Công cụ khác',
        scopeBadge: 'Khác',
        targetBadge: 'Chung',
        defaultPath: '',
        pillActiveClass: 'bg-slate-800 text-white border-slate-800',
        accentBadgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
    }
};

export function inferOcrToolCategory(groupKey: string, title: string = ''): OcrToolCategory {
    const k = `${groupKey} ${title}`.toLowerCase();
    if (k.includes('cumulative_store') || (k.includes('lũy kế') && k.includes('st'))) return 'cumulative_store';
    if (k.includes('cumulative_employee') || (k.includes('lũy kế') && (k.includes('nv') || k.includes('nhân viên')))) return 'cumulative_employee';
    if (k.includes('realtime_store') || (k.includes('realtime') && k.includes('st'))) return 'realtime_store';
    if (k.includes('realtime_employee') || (k.includes('realtime') && (k.includes('nv') || k.includes('nhân viên')))) return 'realtime_employee';
    return 'other';
}

export function inferOcrToolPath(category: OcrToolCategory): string {
    return OCR_CATEGORY_META[category]?.defaultPath || '';
}

export const LEGACY_TEXT_GROUP_KEYS = new Set<string>([
    'realtime_report',
    'cumulative_month',
    'work_hours_shifts',
    'inventory_balancing'
]);

const nowIso = () => new Date().toISOString();

export function createDefaultOcrSampleGroups(): SampleDataGroup[] {
    const ts = nowIso();
    return [
        {
            id: 'seed-ocr-cum-store',
            group_key: 'ocr_cumulative_store',
            group_title: 'OCR Lũy Kế — ST',
            tool_category: 'cumulative_store',
            tool_path: '/cap-nhat-ocr',
            description: 'Hình ảnh chụp màn hình BI dùng cho công cụ Cập nhật số liệu lũy kế ST qua OCR (/cap-nhat-ocr).',
            order_index: 1,
            items: [
                {
                    id: 'slot-cum-st-qd',
                    label: '1. Ảnh Doanh Thu Quy Đổi (DTQĐ) Lũy Kế ST',
                    note: 'Chụp rõ bảng DTQĐ lũy kế toàn cụm gồm Tên ST, DTQĐ, Target, %HT, % Dự kiến.',
                    images: [],
                    updated_at: ts
                },
                {
                    id: 'slot-cum-st-tg',
                    label: '2. Ảnh % Tỷ Trọng Trả Góp (TG) Lũy Kế ST',
                    note: 'Chụp rõ bảng % tỷ trọng trả góp / doanh thu trả góp lũy kế của các ST.',
                    images: [],
                    updated_at: ts
                },
                {
                    id: 'slot-cum-st-emu',
                    label: '3. Ảnh Thi Đua Lũy Kế (Toàn Cụm / Riêng Từng ST)',
                    note: 'Chụp bảng thi đua ngành hàng lũy kế (có thể nạp nhiều ảnh nếu danh sách dài).',
                    images: [],
                    updated_at: ts
                }
            ]
        },
        {
            id: 'seed-ocr-cum-emp',
            group_key: 'ocr_cumulative_employee',
            group_title: 'OCR Lũy Kế — Nhân Viên (NV)',
            tool_category: 'cumulative_employee',
            tool_path: '/cap-nhat-nhan-vien-ocr',
            description: 'Hình ảnh chụp màn hình BI dùng cho công cụ Cập nhật lũy kế NV qua OCR (/cap-nhat-nhan-vien-ocr).',
            order_index: 2,
            items: [
                {
                    id: 'slot-cum-nv-qd',
                    label: '1. Ảnh Doanh Thu Quy Đổi (DTQĐ) Lũy Kế NV',
                    note: 'Chụp danh sách nhân viên ST gồm Mã NV, Tên NV, DTQĐ, DT Thực.',
                    images: [],
                    updated_at: ts
                },
                {
                    id: 'slot-cum-nv-tg',
                    label: '2. Ảnh % Tỷ Trọng Trả Góp (TG) Lũy Kế NV',
                    note: 'Chụp bảng tỷ trọng trả góp hoặc doanh thu trả góp lũy kế từng nhân viên.',
                    images: [],
                    updated_at: ts
                },
                {
                    id: 'slot-cum-nv-hours',
                    label: '3. Ảnh Giờ Công Lũy Kế NV',
                    note: 'Chụp bảng tổng hợp giờ công thực tế của nhân sự ST trong tháng.',
                    images: [],
                    updated_at: ts
                },
                {
                    id: 'slot-cum-nv-emu',
                    label: '4. Ảnh Thi Đua Ngành Hàng Lũy Kế NV',
                    note: 'Chụp bảng kết quả thi đua từng ngành hàng theo nhân viên (hỗ trợ nhiều ảnh).',
                    images: [],
                    updated_at: ts
                }
            ]
        },
        {
            id: 'seed-ocr-rt-store',
            group_key: 'ocr_realtime_store',
            group_title: 'OCR Realtime — ST',
            tool_category: 'realtime_store',
            tool_path: '/bc-ngay/tong-quan',
            description: 'Hình ảnh chụp màn hình BI trong ngày dùng cho Báo cáo Realtime ST (/bc-ngay/tong-quan).',
            order_index: 3,
            items: [
                {
                    id: 'slot-rt-st-qd',
                    label: '1. Ảnh Doanh Thu Quy Đổi (DTQĐ) Realtime ST',
                    note: 'Chụp bảng doanh thu quy đổi phát sinh trong ngày của các ST.',
                    images: [],
                    updated_at: ts
                },
                {
                    id: 'slot-rt-st-tg',
                    label: '2. Ảnh % Tỷ Trọng Trả Góp (TG) Realtime ST',
                    note: 'Chụp tỷ trọng trả góp / doanh số trả góp phát sinh trong ngày theo ST.',
                    images: [],
                    updated_at: ts
                },
                {
                    id: 'slot-rt-st-emu',
                    label: '3. Ảnh Thi Đua Ngành Hàng Realtime ST',
                    note: 'Chụp bảng thi đua ngành hàng trong ngày (toàn cụm hoặc riêng từng ST).',
                    images: [],
                    updated_at: ts
                }
            ]
        },
        {
            id: 'seed-ocr-rt-emp',
            group_key: 'ocr_realtime_employee',
            group_title: 'OCR Realtime — Nhân Viên (NV)',
            tool_category: 'realtime_employee',
            tool_path: '/bc-ngay-nhan-vien',
            description: 'Hình ảnh chụp màn hình BI trong ngày dùng cho Báo cáo Doanh thu Ngày NV (/bc-ngay-nhan-vien).',
            order_index: 4,
            items: [
                {
                    id: 'slot-rt-nv-qd',
                    label: '1. Ảnh Doanh Thu Quy Đổi (DTQĐ) Realtime NV',
                    note: 'Chụp bảng doanh thu quy đổi trong ngày của từng nhân viên trong ST.',
                    images: [],
                    updated_at: ts
                },
                {
                    id: 'slot-rt-nv-tg',
                    label: '2. Ảnh % Tỷ Trọng Trả Góp (TG) Realtime NV',
                    note: 'Chụp bảng tỷ trọng trả góp trong ngày theo từng nhân viên.',
                    images: [],
                    updated_at: ts
                }
            ]
        }
    ];
}
