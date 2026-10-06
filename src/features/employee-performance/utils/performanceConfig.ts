import type { EmployeePerformanceRow } from '../types';
import { supabase } from '../../../core/lib/supabase';

export interface StoreOperatingConfig {
    openTime: string;   // e.g. "08:00"
    closeTime: string;  // e.g. "22:00"
    operatingHours: number; // e.g. 14
    monthlyDays: Record<string, number>; // key: "YYYY-MM" -> e.g. "2026-09": 30
    updated_at?: string;
    updated_by?: string;
}

export interface TopBotConfig {
    mode: 'PERCENT' | 'COUNT'; // PERCENT hoặc COUNT
    topValue: number;          // e.g. 20 (%) hoặc 3 (NV)
    botValue: number;          // e.g. 20 (%) hoặc 3 (NV)
    rankBy: 'FORECAST_COMPLETION_RATE' | 'REVENUE_QD' | 'REVENUE_ACTUAL' | 'COMPLETION_RATE';
    updated_at?: string;
    updated_by?: string;
}

export const STORE_CONFIG_KEY = 'saleshub_store_operating_config_v1';
export const TOP_BOT_CONFIG_KEY = 'saleshub_top_bot_config_v1';

/**
 * Câu lệnh SQL tạo bảng trên Supabase để lưu trữ cấu hình hoạt động & TOP/BOT
 */
export const PERFORMANCE_CONFIGS_SQL = `-- 1. Bảng lưu cấu hình hoạt động siêu thị (Giờ mở/đóng cửa, số ngày hoạt động trong tháng)
CREATE TABLE IF NOT EXISTS public.store_operating_configs (
    store_name TEXT PRIMARY KEY,
    open_time TEXT DEFAULT '08:00',
    close_time TEXT DEFAULT '22:00',
    operating_hours NUMERIC DEFAULT 14,
    monthly_days JSONB DEFAULT '{}'::jsonb,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kích hoạt RLS & chính sách truy cập toàn quyền cho bảng store_operating_configs
ALTER TABLE public.store_operating_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store_operating_configs_all_policy" ON public.store_operating_configs;
CREATE POLICY "store_operating_configs_all_policy" 
ON public.store_operating_configs FOR ALL USING (true) WITH CHECK (true);

-- 2. Bảng lưu cấu hình chung hiệu quả / TOP BOT
CREATE TABLE IF NOT EXISTS public.system_performance_configs (
    config_key TEXT PRIMARY KEY,
    config_data JSONB NOT NULL,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kích hoạt RLS & chính sách truy cập toàn quyền cho bảng system_performance_configs
ALTER TABLE public.system_performance_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_performance_configs_all_policy" ON public.system_performance_configs;
CREATE POLICY "system_performance_configs_all_policy" 
ON public.system_performance_configs FOR ALL USING (true) WITH CHECK (true);
`;

/**
 * Lấy số ngày trong tháng chuẩn theo lịch thiên văn
 */
export function getDaysInMonth(month: number, year: number): number {
    return new Date(year, month, 0).getDate();
}

/**
 * Tính số giờ mở cửa mỗi ngày từ chuỗi giờ mở/đóng (vd 08:00 -> 22:00 = 14 giờ)
 */
export function calculateOperatingHours(openTime: string, closeTime: string): number {
    try {
        const [openH, openM] = openTime.split(':').map(Number);
        const [closeH, closeM] = closeTime.split(':').map(Number);
        const openTotal = openH + (openM || 0) / 60;
        const closeTotal = closeH + (closeM || 0) / 60;
        const diff = closeTotal - openTotal;
        return diff > 0 ? Number(diff.toFixed(1)) : 14;
    } catch {
        return 14;
    }
}

/**
 * Tính số ngày đã trôi qua trong tháng hoạt động
 */
export function getPassedDaysInMonth(month: number, year: number, operatingDays: number): number {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (year === currentYear && month === currentMonth) {
        // Tháng hiện tại: tính tới ngày hôm nay
        const dayOfMonth = now.getDate();
        return Math.min(dayOfMonth, operatingDays);
    } else if (year < currentYear || (year === currentYear && month < currentMonth)) {
        // Tháng trong quá khứ: đã chạy trọn vẹn số ngày hoạt động
        return operatingDays;
    } else {
        // Tháng tương lai: chưa bắt đầu
        return 0;
    }
}

/**
 * Lấy cấu hình hoạt động của siêu thị (giờ mở/đóng và số ngày hoạt động trong tháng)
 */
export function getStoreOperatingConfig(
    storeName: string,
    month: number,
    year: number
): {
    openTime: string;
    closeTime: string;
    operatingHours: number;
    operatingDays: number;
    defaultDays: number;
    passedDays: number;
} {
    const defaultDays = getDaysInMonth(month, year);
    let openTime = '08:00';
    let closeTime = '22:00';
    let operatingDays = defaultDays;

    try {
        const raw = localStorage.getItem(STORE_CONFIG_KEY);
        if (raw) {
            const allConfigs: Record<string, StoreOperatingConfig> = JSON.parse(raw);
            // Tìm cấu hình riêng cho store hoặc cấu hình chung 'ALL'
            const storeCfg = allConfigs[storeName] || allConfigs['ALL'];
            if (storeCfg) {
                if (storeCfg.openTime) openTime = storeCfg.openTime;
                if (storeCfg.closeTime) closeTime = storeCfg.closeTime;
                const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                if (storeCfg.monthlyDays && storeCfg.monthlyDays[monthKey] !== undefined) {
                    operatingDays = storeCfg.monthlyDays[monthKey];
                }
            }
        }
    } catch (e) {
        console.warn('Lỗi đọc store operating config:', e);
    }

    const operatingHours = calculateOperatingHours(openTime, closeTime);
    const passedDays = getPassedDaysInMonth(month, year, operatingDays);

    return {
        openTime,
        closeTime,
        operatingHours,
        operatingDays,
        defaultDays,
        passedDays
    };
}

/**
 * Lưu cấu hình hoạt động của siêu thị (Offline-First: Lưu LocalStorage và đồng bộ Supabase Cloud)
 */
export async function saveStoreOperatingConfig(
    storeName: string,
    month: number,
    year: number,
    config: {
        openTime: string;
        closeTime: string;
        operatingDays: number;
        applyToAll?: boolean;
    },
    allStoreNames: string[] = [],
    updatedBy?: string
): Promise<{ success: boolean; cloudSynced?: boolean; error?: string }> {
    try {
        const raw = localStorage.getItem(STORE_CONFIG_KEY);
        const allConfigs: Record<string, StoreOperatingConfig> = raw ? JSON.parse(raw) : {};
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const operatingHours = calculateOperatingHours(config.openTime, config.closeTime);
        const nowIso = new Date().toISOString();

        const targets = config.applyToAll
            ? ['ALL', ...allStoreNames]
            : [storeName];

        targets.forEach(sName => {
            if (!allConfigs[sName]) {
                allConfigs[sName] = {
                    openTime: config.openTime,
                    closeTime: config.closeTime,
                    operatingHours,
                    monthlyDays: {}
                };
            }
            allConfigs[sName].openTime = config.openTime;
            allConfigs[sName].closeTime = config.closeTime;
            allConfigs[sName].operatingHours = operatingHours;
            allConfigs[sName].updated_at = nowIso;
            allConfigs[sName].updated_by = updatedBy;
            if (!allConfigs[sName].monthlyDays) {
                allConfigs[sName].monthlyDays = {};
            }
            allConfigs[sName].monthlyDays[monthKey] = config.operatingDays;
        });

        // 1. Lưu tức thì LocalStorage (đảm bảo độ trễ 0ms)
        localStorage.setItem(STORE_CONFIG_KEY, JSON.stringify(allConfigs));

        // 2. Đồng bộ lên Cloud Supabase (bảng store_operating_configs)
        try {
            const upsertRows = targets.map(sName => ({
                store_name: sName,
                open_time: config.openTime,
                close_time: config.closeTime,
                operating_hours: operatingHours,
                monthly_days: allConfigs[sName]?.monthlyDays || {},
                updated_by: updatedBy || 'Quản lý',
                updated_at: nowIso
            }));

            const { error } = await supabase
                .from('store_operating_configs')
                .upsert(upsertRows, { onConflict: 'store_name' });

            if (error) {
                console.warn('Đồng bộ Cloud store_operating_configs không thành công (đã lưu Local):', error.message);
                return { success: true, cloudSynced: false, error: error.message };
            }
            return { success: true, cloudSynced: true };
        } catch (cloudErr: any) {
            console.warn('Lỗi kết nối Supabase store_operating_configs:', cloudErr);
            return { success: true, cloudSynced: false, error: cloudErr?.message };
        }
    } catch (e: any) {
        console.error('Lỗi lưu store operating config:', e);
        return { success: false, cloudSynced: false, error: e?.message };
    }
}

/**
 * Lấy cấu hình phân loại TOP/BOT theo đích danh siêu thị (nếu không có thì lấy cấu hình chung 'ALL')
 */
export function getTopBotConfig(storeName: string = 'ALL'): TopBotConfig {
    const defaultCfg: TopBotConfig = {
        mode: 'PERCENT',
        topValue: 20,
        botValue: 20,
        rankBy: 'FORECAST_COMPLETION_RATE' // Mặc định xếp theo % Dự kiến hoàn thành (%DKHT)
    };

    try {
        const raw = localStorage.getItem(TOP_BOT_CONFIG_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            let allConfigs: Record<string, TopBotConfig> = {};
            if (parsed && parsed.mode) {
                // Định dạng cũ đơn lẻ -> gán cho ALL
                allConfigs['ALL'] = parsed;
            } else if (typeof parsed === 'object') {
                allConfigs = parsed;
            }

            const targetKey = (!storeName || storeName === 'all') ? 'ALL' : storeName;
            const cfg = allConfigs[targetKey] || allConfigs['ALL'];
            if (cfg) {
                return {
                    mode: cfg.mode === 'COUNT' ? 'COUNT' : 'PERCENT',
                    topValue: Number(cfg.topValue) || 20,
                    botValue: Number(cfg.botValue) || 20,
                    rankBy: cfg.rankBy || 'FORECAST_COMPLETION_RATE',
                    updated_at: cfg.updated_at,
                    updated_by: cfg.updated_by
                };
            }
        }
    } catch (e) {
        console.warn('Lỗi đọc top bot config:', e);
    }

    return defaultCfg;
}

/**
 * Lưu cấu hình phân loại TOP/BOT theo đích danh siêu thị (Offline-First: Lưu LocalStorage và đồng bộ Supabase Cloud)
 */
export async function saveTopBotConfig(
    storeName: string = 'ALL',
    config: TopBotConfig,
    options?: {
        applyToAll?: boolean;
        allStoreNames?: string[];
        userName?: string;
    }
): Promise<{ success: boolean; cloudSynced?: boolean; error?: string }> {
    try {
        const raw = localStorage.getItem(TOP_BOT_CONFIG_KEY);
        let allConfigs: Record<string, TopBotConfig> = {};
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.mode) {
                    allConfigs['ALL'] = parsed;
                } else if (typeof parsed === 'object') {
                    allConfigs = parsed;
                }
            } catch {}
        }

        const nowIso = new Date().toISOString();
        const updatedBy = options?.userName || 'Quản lý';
        const targetStore = (!storeName || storeName === 'all') ? 'ALL' : storeName;

        const targets = options?.applyToAll
            ? ['ALL', ...(options?.allStoreNames || [])]
            : [targetStore];

        targets.forEach(sName => {
            allConfigs[sName] = {
                ...config,
                updated_at: nowIso,
                updated_by: updatedBy
            };
        });

        // 1. Lưu tức thì LocalStorage
        localStorage.setItem(TOP_BOT_CONFIG_KEY, JSON.stringify(allConfigs));

        // 2. Đồng bộ lên Cloud Supabase (bảng system_performance_configs)
        try {
            // Lưu row tổng hợp 'top_bot' chứa toàn bộ map cấu hình các shop
            const { error: err1 } = await supabase
                .from('system_performance_configs')
                .upsert({
                    config_key: 'top_bot',
                    config_data: allConfigs,
                    updated_by: updatedBy,
                    updated_at: nowIso
                }, { onConflict: 'config_key' });

            // Đồng thời lưu các row riêng lẻ 'top_bot:' + sName để query/quản lý độc lập theo từng shop
            const individualRows = targets.map(sName => ({
                config_key: `top_bot:${sName}`,
                config_data: allConfigs[sName],
                updated_by: updatedBy,
                updated_at: nowIso
            }));

            try {
                await supabase
                    .from('system_performance_configs')
                    .upsert(individualRows, { onConflict: 'config_key' });
            } catch {}

            if (err1) {
                console.warn('Đồng bộ Cloud system_performance_configs không thành công (đã lưu Local):', err1.message);
                return { success: true, cloudSynced: false, error: err1.message };
            }
            return { success: true, cloudSynced: true };
        } catch (cloudErr: any) {
            console.warn('Lỗi kết nối Supabase system_performance_configs:', cloudErr);
            return { success: true, cloudSynced: false, error: cloudErr?.message };
        }
    } catch (e: any) {
        console.error('Lỗi lưu top bot config:', e);
        return { success: false, cloudSynced: false, error: e?.message };
    }
}

/**
 * Tải và hợp nhất cấu hình hoạt động & TOP/BOT từ Supabase Cloud về LocalStorage
 */
export async function syncPerformanceConfigsFromCloud(): Promise<{
    success: boolean;
    storeConfigsCount: number;
    hasTopBotConfig: boolean;
    error?: string;
}> {
    try {
        const [storeRes, topBotRes] = await Promise.all([
            supabase.from('store_operating_configs').select('*'),
            supabase.from('system_performance_configs').select('*').eq('config_key', 'top_bot').maybeSingle()
        ]);

        let storeCount = 0;
        let hasTopBot = false;

        // Cập nhật cấu hình hoạt động cửa hàng từ Cloud
        if (!storeRes.error && Array.isArray(storeRes.data) && storeRes.data.length > 0) {
            const raw = localStorage.getItem(STORE_CONFIG_KEY);
            const allConfigs: Record<string, StoreOperatingConfig> = raw ? JSON.parse(raw) : {};

            storeRes.data.forEach((row: any) => {
                if (row && row.store_name) {
                    const sName = row.store_name;
                    allConfigs[sName] = {
                        openTime: row.open_time || '08:00',
                        closeTime: row.close_time || '22:00',
                        operatingHours: Number(row.operating_hours) || 14,
                        monthlyDays: row.monthly_days || {},
                        updated_at: row.updated_at,
                        updated_by: row.updated_by
                    };
                }
            });

            localStorage.setItem(STORE_CONFIG_KEY, JSON.stringify(allConfigs));
            storeCount = storeRes.data.length;
        }

        // Cập nhật cấu hình TOP/BOT từ Cloud
        if (!topBotRes.error && topBotRes.data && topBotRes.data.config_data) {
            const raw = localStorage.getItem(TOP_BOT_CONFIG_KEY);
            let localConfigs: Record<string, TopBotConfig> = {};
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    localConfigs = (parsed && parsed.mode) ? { ALL: parsed } : (parsed || {});
                } catch {}
            }

            const cloudData = topBotRes.data.config_data;
            if (cloudData && cloudData.mode) {
                localConfigs['ALL'] = cloudData as TopBotConfig;
            } else if (typeof cloudData === 'object') {
                Object.assign(localConfigs, cloudData);
            }
            localStorage.setItem(TOP_BOT_CONFIG_KEY, JSON.stringify(localConfigs));
            hasTopBot = true;
        }

        // Tải thêm các row cấu hình TOP/BOT riêng lẻ (nếu có lưu dạng top_bot:store_name)
        try {
            const { data: specificRows } = await supabase
                .from('system_performance_configs')
                .select('*')
                .like('config_key', 'top_bot:%');

            if (specificRows && specificRows.length > 0) {
                const raw = localStorage.getItem(TOP_BOT_CONFIG_KEY);
                const allConfigs: Record<string, TopBotConfig> = raw ? JSON.parse(raw) : {};
                specificRows.forEach((r: any) => {
                    const sName = r.config_key.replace('top_bot:', '');
                    if (sName && r.config_data) {
                        allConfigs[sName] = r.config_data;
                    }
                });
                localStorage.setItem(TOP_BOT_CONFIG_KEY, JSON.stringify(allConfigs));
                hasTopBot = true;
            }
        } catch {}

        return {
            success: true,
            storeConfigsCount: storeCount,
            hasTopBotConfig: hasTopBot
        };
    } catch (e: any) {
        console.warn('Lỗi syncPerformanceConfigsFromCloud:', e);
        return {
            success: false,
            storeConfigsCount: 0,
            hasTopBotConfig: false,
            error: e?.message
        };
    }
}

/**
 * Kiểm tra trạng thái kết nối trực tiếp với 2 bảng cấu hình hiệu quả trên Supabase Cloud
 */
export async function checkSupabasePerformanceConnection(): Promise<{
    isConnected: boolean;
    storeOperatingReady: boolean;
    storeOperatingCount: number;
    systemPerfReady: boolean;
    error?: string;
    checkedAt: string;
}> {
    const checkedAt = new Date().toLocaleTimeString('vi-VN');
    try {
        const [storeRes, perfRes] = await Promise.all([
            supabase.from('store_operating_configs').select('*', { count: 'exact', head: true }),
            supabase.from('system_performance_configs').select('*', { count: 'exact', head: true })
        ]);

        const storeOperatingReady = !storeRes.error;
        const systemPerfReady = !perfRes.error;
        const isConnected = storeOperatingReady && systemPerfReady;

        return {
            isConnected,
            storeOperatingReady,
            storeOperatingCount: storeRes.count || 0,
            systemPerfReady,
            error: storeRes.error?.message || perfRes.error?.message,
            checkedAt
        };
    } catch (e: any) {
        return {
            isConnected: false,
            storeOperatingReady: false,
            storeOperatingCount: 0,
            systemPerfReady: false,
            error: e?.message,
            checkedAt
        };
    }
}

/**
 * Thuật toán tính toán và gán nhãn TOP / BOT cho danh sách nhân sự
 */
export function applyTopBotEvaluation(
    rows: Omit<EmployeePerformanceRow, 'rank' | 'top_bot_status' | 'top_bot_label'>[],
    config: TopBotConfig
): EmployeePerformanceRow[] {
    if (!rows || rows.length === 0) return [];

    // 1. Sắp xếp theo tiêu chí đã chọn (Mặc định: % Dự kiến hoàn thành %DKHT)
    const sorted = [...rows].sort((a, b) => {
        if (config.rankBy === 'FORECAST_COMPLETION_RATE') {
            return b.forecast_completion_rate - a.forecast_completion_rate;
        }
        if (config.rankBy === 'REVENUE_ACTUAL') {
            return b.revenue_actual - a.revenue_actual;
        }
        if (config.rankBy === 'COMPLETION_RATE') {
            return b.completion_rate - a.completion_rate;
        }
        if (config.rankBy === 'REVENUE_QD') {
            return b.revenue_qd - a.revenue_qd;
        }
        // Mặc định: Xếp hạng theo % Dự kiến hoàn thành
        return b.forecast_completion_rate - a.forecast_completion_rate;
    });

    const totalCount = sorted.length;
    let topCount = 0;
    let botCount = 0;

    if (config.mode === 'PERCENT') {
        const topRatio = Math.max(1, Math.min(90, config.topValue)) / 100;
        const botRatio = Math.max(1, Math.min(90, config.botValue)) / 100;
        topCount = Math.max(1, Math.round(totalCount * topRatio));
        botCount = Math.max(1, Math.round(totalCount * botRatio));
    } else {
        topCount = Math.max(1, Math.min(totalCount, Math.round(config.topValue)));
        botCount = Math.max(1, Math.min(totalCount, Math.round(config.botValue)));
    }

    // Đảm bảo không bị chồng chéo nếu số lượng nhân viên ít
    if (topCount + botCount > totalCount) {
        const excess = (topCount + botCount) - totalCount;
        if (botCount > excess) {
            botCount -= excess;
        } else {
            botCount = 1;
            topCount = Math.max(1, totalCount - 1);
        }
    }

    return sorted.map((item, idx) => {
        const rank = idx + 1;
        let status: 'TOP' | 'BOT' | 'MID' = 'MID';
        let label = 'Ổn định';

        if (rank <= topCount) {
            status = 'TOP';
            label = config.mode === 'PERCENT' ? `TOP ${config.topValue}%` : `TOP #${rank}`;
        } else if (rank > totalCount - botCount) {
            status = 'BOT';
            label = config.mode === 'PERCENT' ? `BOT ${config.botValue}%` : `BOT #${rank}`;
        }

        return {
            ...item,
            rank,
            top_bot_status: status,
            top_bot_label: label
        };
    });
}

/**
 * Chuẩn hóa tên nhân viên, loại bỏ hoàn toàn các hậu tố/tiền tố bộ phận:
 * Ví dụ:
 * - "Nguyễn Văn A - AIO - TZ" -> "Nguyễn Văn A"
 * - "Trần Thị B - ĐMX" -> "Trần Thị B"
 * - "Lê Văn C (AIO)" -> "Lê Văn C"
 */
export function cleanEmployeeName(fullName: string): string {
    if (!fullName || !fullName.trim()) return '';
    let clean = fullName.trim();
    // 1. Loại bỏ các phần chú thích trong ngoặc đơn: (AIO), (ĐMX), (TGD), (Kho), (QL), v.v.
    clean = clean.replace(/\s*\([^)]*(aio|đmx|dmx|tgd|tgdd|kho|thu ngân|tư vấn|new|tz|ql|sm|am|asm|pg|sub|ctv|dịch vụ|dv|kỹ thuật|kt)[^)]*\)/gi, '');
    // 2. Loại bỏ các phần bộ phận nối bằng dấu gạch ngang ở đuôi: - AIO, - ĐMX, - TGD, - AIO - TZ, - Kho, v.v.
    clean = clean.replace(/\s*[-–—]\s*(aio|đmx|dmx|tgd|tgdd|bh|kho|thu ngân|tư vấn|new|tz|ql|sm|am|asm|pg|sub|ctv|dịch vụ|dv|kỹ thuật|kt)(\s*[-–—]\s*[\w\s]+)*\s*$/gi, '');
    return clean.trim();
}

/**
 * Rút gọn tên nhân viên:
 * Cấu trúc: 2 chữ cuối của tên nhân viên.
 * Ngoại lệ: Nếu chữ kế cuối là "Thị" (không phân biệt hoa/thường), chỉ hiển thị chữ cuối cùng (tên).
 * Ví dụ:
 * - "Nguyễn Phương Nam" -> "Phương Nam"
 * - "Nguyễn Thị Loan" -> "Loan" (vì chữ kế cuối là "Thị")
 * - "Trần Thị Kim Cúc" -> "Kim Cúc" (chữ kế cuối là "Kim")
 * - "Lê Quang Vinh" -> "Quang Vinh"
 */
export function getShortenedEmployeeName(fullName: string): string {
    const cleaned = cleanEmployeeName(fullName);
    if (!cleaned) return '';
    const words = cleaned.split(/\s+/);
    if (words.length <= 1) return words[0];

    const lastWord = words[words.length - 1];
    const secondToLast = words[words.length - 2];

    if (secondToLast.toLowerCase() === 'thị') {
        return lastWord;
    }
    return `${secondToLast} ${lastWord}`;
}

