export interface PageVisitItem {
    page_path: string;
    visit_count: number;
    last_visited_at: string;
}

/**
 * Số lượt truy cập khởi tạo mặc định cho người dùng mới (Cold-start)
 * Giúp Top 6 luôn có dữ liệu phong phú ngay từ lần đầu đăng nhập
 */
export const DEFAULT_PAGE_VISITS: Record<string, number> = {
    '/bc-ngay/tong-quan': 35,
    '/bao-cao-cum-sieu-thi': 30,
    '/bc-ngay-nhan-vien': 25,
    '/bc-thang/tong-quan': 20,
    '/tien-do-thi-dua': 18,
    '/bao-cao-hieu-qua-nhan-vien': 15,
    '/chi-tiet-nhan-vien': 12,
    '/nhip-doanh-thu': 10,
    '/cap-nhat': 8,
    '/trang-thai-du-lieu': 7,
    '/quan-tri-he-thong': 6,
    '/cap-ma-voucher': 5
};

const getStorageKey = (employeeId: string) => `saleshub_page_visits_${employeeId || 'guest'}`;

/**
 * Lấy danh sách lượt truy cập từ LocalStorage (0ms tức thì, 100% Free Infra)
 */
export function getLocalPageVisits(employeeId: string): Record<string, number> {
    try {
        const key = getStorageKey(employeeId);
        const saved = localStorage.getItem(key);
        if (saved) {
            const parsed = JSON.parse(saved) as Record<string, PageVisitItem>;
            const result: Record<string, number> = { ...DEFAULT_PAGE_VISITS };
            Object.entries(parsed).forEach(([path, item]) => {
                result[path] = Math.max(result[path] || 0, item.visit_count);
            });
            return result;
        }
    } catch (e) {
        console.warn('Lỗi đọc cache local page visits:', e);
    }
    return { ...DEFAULT_PAGE_VISITS };
}

/**
 * Lưu dữ liệu lượt truy cập vào LocalStorage
 */
function saveLocalPageVisits(employeeId: string, path: string, count: number): void {
    try {
        const key = getStorageKey(employeeId);
        const saved = localStorage.getItem(key);
        const currentData: Record<string, PageVisitItem> = saved ? JSON.parse(saved) : {};
        currentData[path] = {
            page_path: path,
            visit_count: count,
            last_visited_at: new Date().toISOString()
        };
        localStorage.setItem(key, JSON.stringify(currentData));
    } catch (e) {
        console.warn('Lỗi ghi cache local page visits:', e);
    }
}

/**
 * Đọc nhanh từ bộ nhớ LocalStorage (không phụ thuộc mạng, 0ms)
 */
export async function syncPageVisitsFromCloud(employeeId: string): Promise<Record<string, number>> {
    return getLocalPageVisits(employeeId);
}

/**
 * Ghi nhận 1 lượt truy cập trang cho người dùng
 * - Cập nhật LocalStorage tức thì (0ms, 100% Offline/Free Infra)
 * - Phát custom event để Homepage tự động cập nhật Top thẻ realtime
 */
export function recordPageVisit(employeeId: string, pagePath: string): void {
    if (!employeeId || !pagePath || pagePath === '/' || pagePath.startsWith('/dang-nhap')) {
        return;
    }

    const currentVisits = getLocalPageVisits(employeeId);
    const newCount = (currentVisits[pagePath] || 0) + 1;

    // Lưu LocalStorage ngay lập tức
    saveLocalPageVisits(employeeId, pagePath, newCount);

    // Kích hoạt custom event trên window để các widget phản hồi tức thì
    try {
        window.dispatchEvent(new CustomEvent('saleshub_page_visited', {
            detail: { employeeId, pagePath, count: newCount }
        }));
    } catch {
        // ignore
    }
}
