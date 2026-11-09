/**
 * Tiện ích bóc tách và tự động sinh hàng loạt mã đơn hàng tăng lũy kế ngẫu nhiên
 * Dành cho công cụ /tao-ma-don-hang
 */

export interface GeneratedOrderCode {
    id: string;
    code: string;
    index: number;
    stepFromPrevious: number;
    createdAt: string;
}

export interface ParseCodeResult {
    isValid: boolean;
    prefix: string;
    numericPart: string;
    padLength: number;
    baseNumber: bigint;
    error?: string;
}

/**
 * Phân tích cấu trúc mã mẫu đầu vào:
 * Tách phần tiền tố (prefix) và chuỗi số đuôi tăng dần (trailing digits)
 */
export function parseBaseOrderCode(baseCode: string): ParseCodeResult {
    const trimmed = (baseCode || '').trim();
    if (!trimmed) {
        return {
            isValid: false,
            prefix: '',
            numericPart: '',
            padLength: 0,
            baseNumber: 0n,
            error: 'Vui lòng nhập mã đơn hàng mẫu!'
        };
    }

    const match = trimmed.match(/^(.*?)(\d+)$/);
    if (!match) {
        return {
            isValid: false,
            prefix: trimmed,
            numericPart: '',
            padLength: 0,
            baseNumber: 0n,
            error: 'Mã đơn hàng mẫu phải kết thúc bằng một chuỗi số (ví dụ: 00111SO26110721539)!'
        };
    }

    const prefix = match[1];
    const numericPart = match[2];
    const padLength = numericPart.length;

    try {
        const baseNumber = BigInt(numericPart);
        return {
            isValid: true,
            prefix,
            numericPart,
            padLength,
            baseNumber
        };
    } catch {
        return {
            isValid: false,
            prefix,
            numericPart,
            padLength: 0,
            baseNumber: 0n,
            error: 'Phần số đuôi không hợp lệ!'
        };
    }
}

/**
 * Sinh danh sách mã đơn hàng liên tục với bước nhảy ngẫu nhiên
 */
export function generateBatchOrderCodes(
    baseCode: string,
    count: number = 20,
    minStep: number = 10,
    maxStep: number = 20,
    includeBaseCode: boolean = false
): { success: boolean; codes: GeneratedOrderCode[]; error?: string } {
    const parsed = parseBaseOrderCode(baseCode);
    if (!parsed.isValid) {
        return { success: false, codes: [], error: parsed.error };
    }

    const safeCount = Math.max(1, Math.min(count || 20, 500));
    const safeMin = Math.max(1, Math.min(minStep, maxStep));
    const safeMax = Math.max(safeMin, maxStep);

    const codes: GeneratedOrderCode[] = [];
    let currentNum = parsed.baseNumber;
    const nowStr = new Date().toLocaleTimeString('vi-VN');

    // Nếu người dùng chọn bao gồm cả mã gốc làm mã đầu tiên
    if (includeBaseCode) {
        codes.push({
            id: `code-0-${Date.now()}`,
            code: baseCode.trim(),
            index: 1,
            stepFromPrevious: 0,
            createdAt: nowStr
        });
    }

    const startIdx = includeBaseCode ? 1 : 0;
    const targetLength = includeBaseCode ? safeCount : safeCount;

    for (let i = startIdx; i < targetLength; i++) {
        // Tạo bước nhảy ngẫu nhiên trong khoảng [safeMin, safeMax]
        const step = Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
        currentNum += BigInt(step);
        const paddedNum = currentNum.toString().padStart(parsed.padLength, '0');
        const code = `${parsed.prefix}${paddedNum}`;

        codes.push({
            id: `code-${i + 1}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            code,
            index: i + 1,
            stepFromPrevious: step,
            createdAt: nowStr
        });
    }

    return { success: true, codes };
}

