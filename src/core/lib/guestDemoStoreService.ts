import type { StoreItem, EmployeeItem, BusinessDayRecord } from './storage';
import type { EmployeeDataSession } from '../../features/employee-cumulative/utils/sessionStorage';
import { isStoreMatch } from './formatters';

// Định danh siêu thị mẫu dành riêng cho tài khoản trải nghiệm
export const GUEST_DEMO_STORE = '838679 - Demo Store';
export const GUEST_DEMO_STORE_CODE = '838679';
export const GUEST_DEMO_STORE_NAME = 'Demo Store';

// Siêu thị nguồn và phạm vi dữ liệu phiên mẫu
export const GUEST_SOURCE_STORE = '10335 - AAR_BRV_VTA - 290 Trương Công Định';
export const GUEST_SOURCE_CODE = '10335';
export const GUEST_DEMO_START_DATE = '2026-10-01';
export const GUEST_DEMO_END_DATE = '2026-10-10';

export interface DemoEmployeeMapping {
    originalId: string;
    originalName: string;
    demoId: string;
    demoName: string;
    demoShortName: string;
    jobTitle: string;
}

// Bảng ánh xạ 1-1 cố định bảo mật danh tính nhân sự thực tế sang tên nhân viên mới chuyên nghiệp
export const DEMO_EMPLOYEE_MAPPINGS: DemoEmployeeMapping[] = [
    {
        originalId: '260732',
        originalName: 'Nguyễn Thị Hồng Loan',
        demoId: 'NV83801',
        demoName: 'Nguyễn Minh Anh',
        demoShortName: 'Minh Anh',
        jobTitle: 'Quản Lý Siêu Thị'
    },
    {
        originalId: '27560',
        originalName: 'Bùi Minh Lãm',
        demoId: 'NV83802',
        demoName: 'Lê Hoàng Long',
        demoShortName: 'Hoàng Long',
        jobTitle: 'Trưởng Ca Bán Hàng'
    },
    {
        originalId: '267997',
        originalName: 'Nguyễn Thùy Trang',
        demoId: 'NV83803',
        demoName: 'Trần Bảo Ngọc',
        demoShortName: 'Bảo Ngọc',
        jobTitle: 'Chuyên Viên Tư Vấn'
    },
    {
        originalId: '249041',
        originalName: 'Nguyễn Phương Nam',
        demoId: 'NV83804',
        demoName: 'Đặng Gia Huy',
        demoShortName: 'Gia Huy',
        jobTitle: 'Chuyên Viên Tư Vấn'
    },
    {
        originalId: '4614',
        originalName: 'Lê Quang Vinh',
        demoId: 'NV83805',
        demoName: 'Phạm Quỳnh Anh',
        demoShortName: 'Quỳnh Anh',
        jobTitle: 'Chuyên Viên Tư Vấn'
    },
    {
        originalId: '22838',
        originalName: 'Trần Thị Sáu',
        demoId: 'NV83806',
        demoName: 'Vũ Tuấn Kiệt',
        demoShortName: 'Tuấn Kiệt',
        jobTitle: 'Chuyên Viên Tư Vấn'
    }
];

// Danh sách tên dự phòng nếu có phát sinh thêm nhân sự ngoài danh sách chính
const EXTRA_DEMO_NAMES = [
    { name: 'Bùi Thanh Trúc', shortName: 'Thanh Trúc', title: 'Chuyên Viên Tư Vấn' },
    { name: 'Đỗ Nhật Nam', shortName: 'Nhật Nam', title: 'Chuyên Viên Tư Vấn' },
    { name: 'Hoàng Khánh Vy', shortName: 'Khánh Vy', title: 'Chuyên Viên Tư Vấn' },
    { name: 'Trịnh Quốc Bảo', shortName: 'Quốc Bảo', title: 'Chuyên Viên Tư Vấn' },
    { name: 'Ngô Thảo My', shortName: 'Thảo My', title: 'Chuyên Viên Tư Vấn' },
    { name: 'Võ Đức Duy', shortName: 'Đức Duy', title: 'Chuyên Viên Tư Vấn' }
];

/**
 * Kiểm tra xem một chuỗi tên/mã siêu thị có phải là siêu thị Demo Store hay không
 */
export function isGuestDemoStore(storeName?: string): boolean {
    if (!storeName) return false;
    const clean = storeName.trim().toLowerCase();
    return clean.includes('838679') || clean.includes('demo store');
}

/**
 * Lấy đối tượng StoreItem chuẩn cho siêu thị 838679 - Demo Store
 */
export function getGuestDemoStoreItem(): StoreItem {
    return {
        id: 'store_838679_demo',
        name: GUEST_DEMO_STORE,
        code: GUEST_DEMO_STORE_CODE,
        address: '290 Trương Công Định'
    };
}

/**
 * Chuyển đổi tên và mã nhân sự sang thông tin nhân sự mẫu
 */
export function mapToDemoEmployee(originalEmpId?: string, originalName?: string): {
    employeeId: string;
    fullName: string;
    shortName: string;
    jobTitle: string;
} {
    const cleanId = String(originalEmpId || '').trim();
    const cleanName = String(originalName || '').trim();

    // 1. Khớp theo mã nhân viên
    if (cleanId) {
        const foundById = DEMO_EMPLOYEE_MAPPINGS.find(m => m.originalId === cleanId);
        if (foundById) {
            return {
                employeeId: foundById.demoId,
                fullName: foundById.demoName,
                shortName: foundById.demoShortName,
                jobTitle: foundById.jobTitle
            };
        }
    }

    // 2. Khớp theo họ tên cũ
    if (cleanName) {
        const foundByName = DEMO_EMPLOYEE_MAPPINGS.find(m =>
            m.originalName.toLowerCase() === cleanName.toLowerCase() ||
            cleanName.toLowerCase().includes(m.originalName.toLowerCase())
        );
        if (foundByName) {
            return {
                employeeId: foundByName.demoId,
                fullName: foundByName.demoName,
                shortName: foundByName.demoShortName,
                jobTitle: foundByName.jobTitle
            };
        }
    }

    // 3. Fallback băm deterministic theo chuỗi
    let hash = 0;
    const seed = cleanId || cleanName || 'emp_default';
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    const idx = Math.abs(hash) % EXTRA_DEMO_NAMES.length;
    const extra = EXTRA_DEMO_NAMES[idx];
    const demoIdNum = String(10 + (Math.abs(hash) % 90));

    return {
        employeeId: `NV838${demoIdNum}`,
        fullName: extra.name,
        shortName: extra.shortName,
        jobTitle: extra.title
    };
}

/**
 * Lấy danh sách nhân viên của siêu thị 838679 - Demo Store
 */
export function getGuestDemoEmployees(): EmployeeItem[] {
    return DEMO_EMPLOYEE_MAPPINGS.map(m => ({
        id: `emp_${m.demoId}`,
        employee_id: m.demoId,
        full_name: m.demoName,
        role: m.jobTitle,
        job_title: m.jobTitle,
        department: 'Bán Hàng',
        store_name: GUEST_DEMO_STORE,
        is_active: true
    }));
}

/**
 * Kiểm tra xem mốc ngày có nằm trong khung ngày trải nghiệm (01/10 đến 10/10) hay không
 */
export function isDemoDateAllowed(reportDate?: string): boolean {
    if (!reportDate) return false;
    const cleanDate = reportDate.slice(0, 10);
    return cleanDate >= GUEST_DEMO_START_DATE && cleanDate <= GUEST_DEMO_END_DATE;
}

/**
 * Chuyển đổi các phiên dữ liệu nhân sự (employee_data_sessions) của shop 10335 sang 838679 - Demo Store
 */
export function transformDemoSessions(sessions: EmployeeDataSession[]): EmployeeDataSession[] {
    if (!Array.isArray(sessions)) return [];

    // Chỉ lấy phiên của shop 10335 hoặc AAR trong khoảng ngày 01 đến 10/10/2026
    const relevantSessions = sessions.filter(s => {
        const isShop = isStoreMatch(s.store_name, GUEST_SOURCE_STORE) || isStoreMatch(s.store_name, GUEST_SOURCE_CODE);
        const isMonth10 = s.month === 10 && s.year === 2026;
        const isDateOk = !s.report_date || isDemoDateAllowed(s.report_date);
        return isShop && isMonth10 && isDateOk;
    });

    return relevantSessions.map(sess => {
        // Chuyển đổi tên và mã nhân viên bên trong từng dòng records
        const newRecords = (sess.records || []).map(r => {
            const mapped = mapToDemoEmployee(r.employee_id, r.full_name);
            return {
                ...r,
                employee_id: mapped.employeeId,
                full_name: mapped.fullName,
                short_name: mapped.shortName,
                job_title: mapped.jobTitle || r.job_title,
                store_name: GUEST_DEMO_STORE
            };
        });

        return {
            ...sess,
            id: sess.id.startsWith('demo_') ? sess.id : `demo_${sess.id}`,
            store_name: GUEST_DEMO_STORE,
            session_title: sess.session_title.replace(/10335\s*-\s*AAR[^\s]*/g, GUEST_DEMO_STORE).replace(/AAR[^\s]*/g, GUEST_DEMO_STORE_NAME),
            records: newRecords
        };
    });
}

/**
 * Chuyển đổi các bản ghi kinh doanh ngày (daily_business_records) của shop 10335 sang 838679 - Demo Store
 */
export function transformDemoBusinessRecords(records: BusinessDayRecord[]): BusinessDayRecord[] {
    if (!Array.isArray(records)) return [];

    const filtered = records.filter(r => {
        const isShop = isStoreMatch(r.storeName, GUEST_SOURCE_STORE) || isStoreMatch(r.storeName, GUEST_SOURCE_CODE);
        const isMonth10 = r.month === 10 && r.year === 2026;
        const isDateOk = !r.reportDate || isDemoDateAllowed(r.reportDate);
        return isShop && isMonth10 && isDateOk;
    });

    return filtered.map(r => ({
        ...r,
        id: r.id ? (String(r.id).startsWith('demo_') ? r.id : `demo_${r.id}`) : `demo_${r.reportDate}`,
        storeName: GUEST_DEMO_STORE
    }));
}
