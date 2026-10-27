import {
    type CashAuditRecord,
    CASH_HISTORY_LOCAL_KEY
} from '../types';

/**
 * Đọc lịch sử kiểm tiền từ LocalStorage (key: cash_history_portal)
 */
export function getLocalCashHistory(): CashAuditRecord[] {
    try {
        const raw = localStorage.getItem(CASH_HISTORY_LOCAL_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((item: any) => ({
            id: item.id || Date.now(),
            time: item.time || new Date().toLocaleString('vi-VN'),
            store_name: item.store_name || '',
            user_code: item.user_code || item.note || '',
            note: item.note || '',
            target: Number(item.target) || 0,
            total: Number(item.total) || 0,
            diff: Number(item.diff) || (Number(item.total) - Number(item.target)),
            details: item.details || {},
            created_at: item.created_at || (typeof item.id === 'number' ? new Date(item.id).toISOString() : new Date().toISOString())
        }));
    } catch (err) {
        console.error('Lỗi khi đọc lịch sử từ localStorage:', err);
        return [];
    }
}

/**
 * Lưu 1 bản ghi kiểm tiền vào LocalStorage
 */
export function saveCashAuditRecord(record: CashAuditRecord): CashAuditRecord[] {
    const locals = getLocalCashHistory();
    const updated = [record, ...locals.filter(r => String(r.id) !== String(record.id))].slice(0, 50);
    try {
        localStorage.setItem(CASH_HISTORY_LOCAL_KEY, JSON.stringify(updated));
    } catch (err) {
        console.error('Lỗi khi ghi lịch sử vào localStorage:', err);
    }
    return updated;
}

/**
 * Xóa 1 bản ghi kiểm tiền khỏi LocalStorage
 */
export function deleteCashAuditRecord(id: string | number): CashAuditRecord[] {
    const updated = getLocalCashHistory().filter(r => String(r.id) !== String(id));
    try {
        localStorage.setItem(CASH_HISTORY_LOCAL_KEY, JSON.stringify(updated));
    } catch (err) {
        console.error('Lỗi khi cập nhật localStorage sau khi xóa:', err);
    }
    return updated;
}

/**
 * Xóa toàn bộ lịch sử trong LocalStorage
 */
export function clearAllCashAuditHistory(): void {
    try {
        localStorage.removeItem(CASH_HISTORY_LOCAL_KEY);
    } catch (err) {
        console.error('Lỗi khi xóa toàn bộ lịch sử trong localStorage:', err);
    }
}
