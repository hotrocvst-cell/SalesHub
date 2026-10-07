import type { BusinessDayRecord, StoreItem, EmployeeItem } from '../../../core/lib/storage';
import type { EmployeeDataSession } from '../../employee-cumulative/utils/sessionStorage';
import { isStoreMatch, getShortStoreName } from '../../../core/lib/formatters';
import type { DataStreamStatus, StoreMatrixRow, OverallReadinessSummary } from '../types';

interface StatusCalculationInput {
    records: BusinessDayRecord[];
    sessions: EmployeeDataSession[];
    empRevenueTargets: { employee_id: string; target_revenue: number }[];
    empCampaignTargets: any[];
    stores: StoreItem[];
    employees: EmployeeItem[];
    targetStore: string;
    expectedDate: string; // Ngày n-1
    todayDate: string;    // Ngày n
    selectedMonth: number;
    selectedYear: number;
}

export function calculateDataStatus(input: StatusCalculationInput): {
    streams: DataStreamStatus[];
    matrix: StoreMatrixRow[];
    summary: OverallReadinessSummary;
} {
    const {
        records,
        sessions,
        empRevenueTargets,
        empCampaignTargets,
        stores,
        employees,
        targetStore,
        expectedDate,
        todayDate,
        selectedMonth,
        selectedYear
    } = input;

    // Lọc danh sách siêu thị áp dụng
    const activeStores = stores.filter(s => s.is_active !== false);
    const applicableStores = targetStore === 'all'
        ? activeStores
        : activeStores.filter(s => isStoreMatch(s.name, targetStore, stores));

    const totalStoreCount = applicableStores.length || 1;

    // 1. DOANH THU LŨY KẾ SIÊU THỊ
    // Lọc các bản ghi khớp với tháng/năm và siêu thị được chọn
    const storeRecords = records.filter(r => {
        if (targetStore !== 'all' && !isStoreMatch(r.storeName, targetStore, stores)) return false;
        return r.month === selectedMonth && r.year === selectedYear;
    });

    const storeDates = Array.from(new Set(storeRecords.map(r => r.reportDate))).sort();
    const latestStoreRevenueDate = storeDates.length > 0 ? storeDates[storeDates.length - 1] : null;

    // Lọc bản ghi đúng ngày n-1
    const n1StoreRecords = storeRecords.filter(r => r.reportDate === expectedDate && (r.revenueActual > 0 || r.revenueTarget > 0));
    const storeRevenueStoresCovered = new Set(
        n1StoreRecords.map(r => getShortStoreName(r.storeName))
    ).size;

    const isStoreRevenueOk = targetStore === 'all'
        ? (storeRevenueStoresCovered >= totalStoreCount && storeRevenueStoresCovered > 0)
        : (latestStoreRevenueDate === expectedDate);

    // Thời gian cập nhật gần nhất
    const latestStoreRecord = storeRecords.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
    const storeRevenueUpdatedAt = latestStoreRecord?.updatedAt || null;

    const storeRevenueStream: DataStreamStatus = {
        id: 'store_revenue',
        title: 'Siêu Thị - Doanh Thu Lũy Kế',
        shortTitle: 'DT Siêu thị LK',
        category: 'store',
        isOk: isStoreRevenueOk,
        statusText: isStoreRevenueOk ? 'OK' : (latestStoreRevenueDate ? 'CHẬM PHIÊN' : 'CHƯA CÓ DỮ LIỆU'),
        expectedDate,
        latestDataDate: latestStoreRevenueDate,
        lastUpdatedAt: storeRevenueUpdatedAt,
        lastUpdatedBy: latestStoreRecord?.updatedBy || null,
        recordCount: storeRecords.length,
        storeCoveredCount: storeRevenueStoresCovered,
        totalStoreCount,
        coveragePercent: Math.round((storeRevenueStoresCovered / totalStoreCount) * 100),
        description: 'Dữ liệu doanh thu lũy kế của siêu thị',
        warningMessage: isStoreRevenueOk
            ? undefined
            : latestStoreRevenueDate
                ? `Phiên mới nhất đang dừng ở ngày ${latestStoreRevenueDate}. Chưa có dữ liệu chốt ca ngày ${expectedDate} (n-1).`
                : `Chưa có bản ghi doanh thu nào trong tháng ${selectedMonth}/${selectedYear}.`,
        actionUrl: '/cap-nhat',
        actionLabel: 'Cập nhật số liệu LK'
    };

    // 2. TIẾN ĐỘ THI ĐUA NGÀNH HÀNG SIÊU THỊ
    const emulationRecords = storeRecords.filter(r => r.emulationSummary && Object.keys(r.emulationSummary).length > 0);
    const emulationDates = Array.from(new Set(emulationRecords.map(r => r.reportDate))).sort();
    const latestEmulationDate = emulationDates.length > 0 ? emulationDates[emulationDates.length - 1] : null;

    const n1EmulationRecords = emulationRecords.filter(r => r.reportDate === expectedDate);
    const emulationStoresCovered = new Set(
        n1EmulationRecords.map(r => getShortStoreName(r.storeName))
    ).size;

    const isStoreEmulationOk = targetStore === 'all'
        ? (emulationStoresCovered >= totalStoreCount && emulationStoresCovered > 0)
        : (latestEmulationDate === expectedDate);

    const storeEmulationStream: DataStreamStatus = {
        id: 'store_emulation',
        title: 'Siêu Thị - Lũy Kế Thi Đua',
        shortTitle: 'Thi đua Siêu thị LK',
        category: 'store',
        isOk: isStoreEmulationOk,
        statusText: isStoreEmulationOk ? 'OK' : (latestEmulationDate ? 'CHẬM PHIÊN' : 'CHƯA CÓ DỮ LIỆU'),
        expectedDate,
        latestDataDate: latestEmulationDate,
        lastUpdatedAt: storeRevenueUpdatedAt,
        recordCount: emulationRecords.length,
        storeCoveredCount: emulationStoresCovered,
        totalStoreCount,
        coveragePercent: Math.round((emulationStoresCovered / totalStoreCount) * 100),
        description: 'Dữ liệu lũy kế thi đua các ngành hàng của siêu thị',
        warningMessage: isStoreEmulationOk
            ? undefined
            : latestEmulationDate
                ? `Số liệu thi đua mới nhất ngày ${latestEmulationDate}. Chưa nạp thi đua ngày ${expectedDate} (n-1).`
                : `Chưa có số liệu thi đua ngành hàng của siêu thị trong tháng ${selectedMonth}/${selectedYear}.`,
        actionUrl: '/cap-nhat',
        actionLabel: 'Nạp thi đua ST'
    };

    // 3. DOANH THU LŨY KẾ NHÂN VIÊN (Sessions)
    const empSessions = sessions.filter(s => {
        if (targetStore !== 'all' && !isStoreMatch(s.store_name, targetStore, stores)) return false;
        return s.month === selectedMonth && s.year === selectedYear;
    });

    const revSessions = empSessions.filter(s =>
        (s.session_type === 'REVENUE_CAMPAIGN' || s.session_type === 'FULL_SYNC') &&
        s.records && s.records.some(r => (r.revenue_actual || 0) > 0 || (r.revenue_qd || 0) > 0)
    );

    const revSessionDates = Array.from(new Set(revSessions.map(s => s.report_date))).filter(Boolean).sort();
    const latestEmpRevDate = revSessionDates.length > 0 ? revSessionDates[revSessionDates.length - 1] : null;

    const n1RevSessions = revSessions.filter(s => s.report_date === expectedDate);
    const empRevStoresCovered = new Set(
        n1RevSessions.map(s => getShortStoreName(s.store_name))
    ).size;

    const isEmpRevOk = targetStore === 'all'
        ? (empRevStoresCovered >= totalStoreCount && empRevStoresCovered > 0)
        : (latestEmpRevDate === expectedDate);

    const latestRevSession = revSessions.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];

    const empRevenueStream: DataStreamStatus = {
        id: 'employee_revenue',
        title: 'Nhân Viên - Lũy Kế Doanh Thu',
        shortTitle: 'DT Nhân viên LK',
        category: 'employee',
        isOk: isEmpRevOk,
        statusText: isEmpRevOk ? 'OK' : (latestEmpRevDate ? 'CHẬM PHIÊN' : 'CHƯA CÓ DỮ LIỆU'),
        expectedDate,
        latestDataDate: latestEmpRevDate,
        lastUpdatedAt: latestRevSession?.created_at || null,
        lastUpdatedBy: latestRevSession?.created_by || null,
        recordCount: revSessions.reduce((acc, s) => acc + (s.employee_count || s.records?.length || 0), 0),
        storeCoveredCount: empRevStoresCovered,
        totalStoreCount,
        coveragePercent: Math.round((empRevStoresCovered / totalStoreCount) * 100),
        description: 'Dữ liệu doanh thu lũy kế theo từng nhân viên',
        warningMessage: isEmpRevOk
            ? undefined
            : latestEmpRevDate
                ? `Phiên doanh thu nhân sự gần nhất ngày ${latestEmpRevDate}. Cần nạp phiên ngày ${expectedDate} (n-1).`
                : `Chưa có phiên doanh thu nhân sự nào được lưu cho tháng ${selectedMonth}/${selectedYear}.`,
        actionUrl: '/cap-nhat-luy-ke-nhan-vien',
        actionLabel: 'Cập nhật số liệu NV'
    };

    // 4. TIẾN ĐỘ THI ĐUA NHÂN VIÊN
    const campSessions = empSessions.filter(s =>
        (s.session_type === 'REVENUE_CAMPAIGN' || s.session_type === 'FULL_SYNC') &&
        s.records && s.records.some(r => r.campaigns && Object.keys(r.campaigns).length > 0)
    );

    const campSessionDates = Array.from(new Set(campSessions.map(s => s.report_date))).filter(Boolean).sort();
    const latestEmpCampDate = campSessionDates.length > 0 ? campSessionDates[campSessionDates.length - 1] : null;

    const n1CampSessions = campSessions.filter(s => s.report_date === expectedDate);
    const empCampStoresCovered = new Set(
        n1CampSessions.map(s => getShortStoreName(s.store_name))
    ).size;

    const isEmpCampOk = targetStore === 'all'
        ? (empCampStoresCovered >= totalStoreCount && empCampStoresCovered > 0)
        : (latestEmpCampDate === expectedDate);

    const latestCampSession = campSessions.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];

    const empEmulationStream: DataStreamStatus = {
        id: 'employee_emulation',
        title: 'Nhân Viên - Lũy Kế Thi Đua',
        shortTitle: 'Thi đua Nhân viên LK',
        category: 'employee',
        isOk: isEmpCampOk,
        statusText: isEmpCampOk ? 'OK' : (latestEmpCampDate ? 'CHẬM PHIÊN' : 'CHƯA CÓ DỮ LIỆU'),
        expectedDate,
        latestDataDate: latestEmpCampDate,
        lastUpdatedAt: latestCampSession?.created_at || null,
        lastUpdatedBy: latestCampSession?.created_by || null,
        recordCount: campSessions.reduce((acc, s) => acc + (s.employee_count || s.records?.length || 0), 0),
        storeCoveredCount: empCampStoresCovered,
        totalStoreCount,
        coveragePercent: Math.round((empCampStoresCovered / totalStoreCount) * 100),
        description: 'Dữ liệu lũy kế thi đua của từng nhân viên',
        warningMessage: isEmpCampOk
            ? undefined
            : latestEmpCampDate
                ? `Phiên thi đua nhân viên gần nhất ngày ${latestEmpCampDate}. Cần nạp phiên ngày ${expectedDate} (n-1).`
                : `Chưa có phiên thi đua nhân viên nào được bóc tách cho tháng ${selectedMonth}/${selectedYear}.`,
        actionUrl: '/cap-nhat-luy-ke-nhan-vien',
        actionLabel: 'Nạp thi đua NV'
    };

    // 5. CHỈ TIÊU KHOÁN THÁNG (Doanh thu & Thi đua)
    const applicableEmployees = employees.filter(e => {
        if (e.is_active === false) return false;
        if (targetStore === 'all') return true;
        return isStoreMatch(e.store_name, targetStore, stores);
    });

    const targetRevCount = empRevenueTargets.filter(t => {
        if (targetStore === 'all') return true;
        const emp = employees.find(e => e.employee_id === t.employee_id);
        return emp ? isStoreMatch(emp.store_name, targetStore, stores) : false;
    }).length;

    const targetCampCount = empCampaignTargets.filter(t => {
        if (targetStore === 'all') return true;
        const emp = employees.find(e => e.employee_id === t.employee_id);
        return emp ? isStoreMatch(emp.store_name, targetStore, stores) : false;
    }).length;

    const totalTargetAssigned = targetRevCount + (targetCampCount > 0 ? 1 : 0);
    const isTargetOk = applicableEmployees.length > 0
        ? (targetRevCount >= Math.min(applicableEmployees.length, 1))
        : targetRevCount > 0;

    const empTargetStream: DataStreamStatus = {
        id: 'employee_targets',
        title: 'Nhân Viên - Đặt mục tiêu',
        shortTitle: 'Mục tiêu Tháng NV',
        category: 'config',
        isOk: isTargetOk,
        statusText: isTargetOk ? 'OK' : 'CẦN CẬP NHẬT',
        expectedDate: `Tháng ${selectedMonth}/${selectedYear}`,
        latestDataDate: `Tháng ${selectedMonth}/${selectedYear}`,
        lastUpdatedAt: null,
        recordCount: targetRevCount + targetCampCount,
        storeCoveredCount: targetRevCount > 0 ? totalStoreCount : 0,
        totalStoreCount,
        coveragePercent: applicableEmployees.length > 0
            ? Math.min(100, Math.round((targetRevCount / applicableEmployees.length) * 100))
            : (targetRevCount > 0 ? 100 : 0),
        description: 'Mục tiêu doanh thu và thi đua từng nhân viên theo tháng',
        warningMessage: isTargetOk
            ? undefined
            : `Chưa phân bổ mục tiêu cho nhân viên tháng ${selectedMonth}/${selectedYear}.`,
        actionUrl: '/muc-tieu-nhan-vien',
        actionLabel: 'Cài đặt mục tiêu'
    };

    // 6. GIỜ CÔNG LŨY KẾ NHÂN VIÊN
    // Lọc tất cả phiên trong tháng/năm có dữ liệu giờ công
    const monthHoursSessions = sessions.filter(s =>
        s.month === selectedMonth &&
        s.year === selectedYear &&
        (s.session_type === 'WORK_HOURS' || (s.records && s.records.some(r => (r.work_hours || 0) > 0)))
    );

    // Hàm kiểm tra 1 session có chứa dữ liệu giờ công của 1 siêu thị cụ thể hay không
    // (Hỗ trợ cả trường hợp session lưu theo tên siêu thị riêng HOẶC session Toàn Cụm có chứa nhân viên của siêu thị đó)
    const sessionHasStoreWorkHours = (s: EmployeeDataSession, sName: string, sEmpIds: Set<string>): boolean => {
        if (isStoreMatch(s.store_name, sName, stores)) {
            return true;
        }
        if (s.records && s.records.some(r =>
            (sEmpIds.has(r.employee_id) || (Boolean((r as any).store_name) && isStoreMatch((r as any).store_name, sName, stores))) &&
            (r.work_hours || 0) > 0
        )) {
            return true;
        }
        return false;
    };

    // Kiểm tra siêu thị nào trong applicableStores đã có dữ liệu giờ công
    const storesWithHours = applicableStores.filter(store => {
        const storeEmps = employees.filter(e => isStoreMatch(e.store_name, store.name, stores) && e.is_active !== false);
        const storeEmpIds = new Set(storeEmps.map(e => e.employee_id));
        return monthHoursSessions.some(s => sessionHasStoreWorkHours(s, store.name, storeEmpIds));
    });

    const hoursStoresCovered = storesWithHours.length;
    const isHoursOk = targetStore === 'all'
        ? (hoursStoresCovered >= totalStoreCount && hoursStoresCovered > 0)
        : (hoursStoresCovered > 0);

    // Phiên liên quan đến phạm vi đang chọn (Toàn Cụm hoặc siêu thị cụ thể)
    const relevantHoursSessions = targetStore === 'all'
        ? monthHoursSessions
        : monthHoursSessions.filter(s => {
            const targetEmps = employees.filter(e => isStoreMatch(e.store_name, targetStore, stores) && e.is_active !== false);
            const targetEmpIds = new Set(targetEmps.map(e => e.employee_id));
            return sessionHasStoreWorkHours(s, targetStore, targetEmpIds);
        });

    const latestHoursSession = relevantHoursSessions.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];

    const workHoursStream: DataStreamStatus = {
        id: 'employee_work_hours',
        title: 'Nhân Viên - Giờ Công Làm Việc',
        shortTitle: 'Giờ công all NV',
        category: 'employee',
        isOk: isHoursOk,
        statusText: isHoursOk ? 'OK' : (relevantHoursSessions.length > 0 ? 'CHẬM PHIÊN' : 'CẦN CẬP NHẬT'),
        expectedDate: `Tháng ${selectedMonth}/${selectedYear}`,
        latestDataDate: isHoursOk
            ? `Đã nạp (${relevantHoursSessions.length} phiên)`
            : (relevantHoursSessions.length > 0 ? `Đã có ${relevantHoursSessions.length} phiên` : null),
        lastUpdatedAt: latestHoursSession?.created_at || null,
        lastUpdatedBy: latestHoursSession?.created_by || null,
        recordCount: relevantHoursSessions.reduce((acc, s) => acc + (s.employee_count || s.records?.length || 0), 0),
        storeCoveredCount: hoursStoresCovered,
        totalStoreCount,
        coveragePercent: totalStoreCount > 0
            ? Math.round((hoursStoresCovered / totalStoreCount) * 100)
            : 0,
        description: 'Lũy kế giờ công all nhân viên',
        warningMessage: isHoursOk
            ? undefined
            : `Chưa có dữ liệu giờ công cho ${targetStore !== 'all' ? targetStore : 'các siêu thị'} trong tháng ${selectedMonth}/${selectedYear}.`,
        actionUrl: '/cap-nhat-luy-ke-nhan-vien',
        actionLabel: 'Nạp giờ công'
    };

    const streams = [
        storeRevenueStream,
        storeEmulationStream,
        empRevenueStream,
        empEmulationStream,
        empTargetStream,
        workHoursStream
    ];

    // TÍNH BẢNG MA TRẬN THEO TỪNG SIÊU THỊ
    const matrix: StoreMatrixRow[] = applicableStores.map(store => {
        const storeName = store.name;

        // 1. DT Siêu thị
        const sRevRecords = records.filter(r => isStoreMatch(r.storeName, storeName, stores) && r.month === selectedMonth && r.year === selectedYear);
        const sRevDates = Array.from(new Set(sRevRecords.map(r => r.reportDate))).sort();
        const sRevLatestDate = sRevDates[sRevDates.length - 1] || null;
        const storeRevenueOk = sRevLatestDate === expectedDate;

        // 2. Thi đua Siêu thị
        const sEmuRecords = sRevRecords.filter(r => r.emulationSummary && Object.keys(r.emulationSummary).length > 0);
        const sEmuDates = Array.from(new Set(sEmuRecords.map(r => r.reportDate))).sort();
        const storeEmulationOk = sEmuDates.includes(expectedDate);

        // 3. DT Nhân viên
        const sSessions = sessions.filter(s => isStoreMatch(s.store_name, storeName, stores) && s.month === selectedMonth && s.year === selectedYear);
        const sEmpRev = sSessions.filter(s =>
            (s.session_type === 'REVENUE_CAMPAIGN' || s.session_type === 'FULL_SYNC') &&
            s.records && s.records.some(r => (r.revenue_actual || 0) > 0 || (r.revenue_qd || 0) > 0)
        );
        const sEmpRevDates = Array.from(new Set(sEmpRev.map(s => s.report_date))).filter(Boolean).sort();
        const sEmpRevLatestDate = sEmpRevDates[sEmpRevDates.length - 1] || null;
        const employeeRevenueOk = sEmpRevLatestDate === expectedDate;

        // 4. Thi đua Nhân viên
        const sEmpCamp = sSessions.filter(s =>
            (s.session_type === 'REVENUE_CAMPAIGN' || s.session_type === 'FULL_SYNC') &&
            s.records && s.records.some(r => r.campaigns && Object.keys(r.campaigns).length > 0)
        );
        const sEmpCampDates = Array.from(new Set(sEmpCamp.map(s => s.report_date))).filter(Boolean);
        const employeeEmulationOk = sEmpCampDates.includes(expectedDate);

        // 5. Chỉ tiêu Nhân viên
        const storeEmps = employees.filter(e => isStoreMatch(e.store_name, storeName, stores) && e.is_active !== false);
        const storeEmpIds = new Set(storeEmps.map(e => e.employee_id));
        const sTargetsCount = empRevenueTargets.filter(t => storeEmpIds.has(t.employee_id)).length;
        const employeeTargetsOk = storeEmps.length > 0 ? sTargetsCount >= Math.min(storeEmps.length, 1) : sTargetsCount > 0;

        // 6. Giờ công Nhân viên
        const storeHoursOk = monthHoursSessions.some(s => sessionHasStoreWorkHours(s, storeName, storeEmpIds));

        // Điểm sẵn sàng (6 chỉ số cốt lõi)
        const checkItems = [
            storeRevenueOk,
            storeEmulationOk,
            employeeRevenueOk,
            employeeEmulationOk,
            employeeTargetsOk,
            storeHoursOk
        ];
        const okCount = checkItems.filter(Boolean).length;
        const readinessScore = Math.round((okCount / checkItems.length) * 100);
        const allOk = okCount === checkItems.length;

        return {
            storeName,
            storeCode: store.code,
            storeRevenueOk,
            storeRevenueDate: sRevLatestDate,
            storeEmulationOk,
            storeEmulationCount: sEmuRecords.length,
            employeeRevenueOk,
            employeeRevenueDate: sEmpRevLatestDate,
            employeeEmulationOk,
            employeeEmulationCount: sEmpCamp.length,
            employeeTargetsOk,
            employeeTargetsCount: sTargetsCount,
            workHoursOk: storeHoursOk,
            readinessScore,
            allOk
        };
    });

    // TỔNG KẾT HỆ THỐNG
    const okStreams = streams.filter(s => s.isOk).length;
    const warningStreams = streams.length - okStreams;
    const readinessPercent = Math.round((okStreams / streams.length) * 100);
    const fullyReadyStores = matrix.filter(m => m.allOk).length;

    const summary: OverallReadinessSummary = {
        totalStreams: streams.length,
        okStreams,
        warningStreams,
        readinessPercent,
        todayDate,
        expectedDate,
        totalStores: applicableStores.length,
        fullyReadyStores
    };

    return { streams, matrix, summary };
}
