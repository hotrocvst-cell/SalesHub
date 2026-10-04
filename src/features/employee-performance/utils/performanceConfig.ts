import type { EmployeePerformanceRow } from '../types';

export interface StoreOperatingConfig {
    openTime: string;   // e.g. "08:00"
    closeTime: string;  // e.g. "22:00"
    operatingHours: number; // e.g. 14
    monthlyDays: Record<string, number>; // key: "YYYY-MM" -> e.g. "2026-09": 30
}

export interface TopBotConfig {
    mode: 'PERCENT' | 'COUNT'; // PERCENT hoặc COUNT
    topValue: number;          // e.g. 20 (%) hoặc 3 (NV)
    botValue: number;          // e.g. 20 (%) hoặc 3 (NV)
    rankBy: 'FORECAST_COMPLETION_RATE' | 'REVENUE_QD' | 'REVENUE_ACTUAL' | 'COMPLETION_RATE';
}

const STORE_CONFIG_KEY = 'saleshub_store_operating_config_v1';
const TOP_BOT_CONFIG_KEY = 'saleshub_top_bot_config_v1';

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
 * Lưu cấu hình hoạt động của siêu thị
 */
export function saveStoreOperatingConfig(
    storeName: string,
    month: number,
    year: number,
    config: {
        openTime: string;
        closeTime: string;
        operatingDays: number;
        applyToAll?: boolean;
    },
    allStoreNames: string[] = []
): void {
    try {
        const raw = localStorage.getItem(STORE_CONFIG_KEY);
        const allConfigs: Record<string, StoreOperatingConfig> = raw ? JSON.parse(raw) : {};
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const operatingHours = calculateOperatingHours(config.openTime, config.closeTime);

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
            if (!allConfigs[sName].monthlyDays) {
                allConfigs[sName].monthlyDays = {};
            }
            allConfigs[sName].monthlyDays[monthKey] = config.operatingDays;
        });

        localStorage.setItem(STORE_CONFIG_KEY, JSON.stringify(allConfigs));
    } catch (e) {
        console.error('Lỗi lưu store operating config:', e);
    }
}

/**
 * Lấy cấu hình phân loại TOP/BOT
 */
export function getTopBotConfig(): TopBotConfig {
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
            return {
                mode: parsed.mode === 'COUNT' ? 'COUNT' : 'PERCENT',
                topValue: Number(parsed.topValue) || 20,
                botValue: Number(parsed.botValue) || 20,
                rankBy: parsed.rankBy || 'FORECAST_COMPLETION_RATE'
            };
        }
    } catch (e) {
        console.warn('Lỗi đọc top bot config:', e);
    }

    return defaultCfg;
}

/**
 * Lưu cấu hình phân loại TOP/BOT
 */
export function saveTopBotConfig(config: TopBotConfig): void {
    try {
        localStorage.setItem(TOP_BOT_CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
        console.error('Lỗi lưu top bot config:', e);
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

