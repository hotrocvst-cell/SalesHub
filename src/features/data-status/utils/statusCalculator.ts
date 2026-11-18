import type { BusinessDayRecord, StoreItem, EmployeeItem } from '../../../core/lib/storage';
import type { EmployeeDataSession } from '../../employee-cumulative/utils/sessionStorage';
import { isStoreMatch } from '../../../core/lib/formatters';
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

/**
 * Xác định ngày hiển thị phù hợp nhất với phiên đang kiểm tra (expectedDate):
 * - Nếu đã có đúng phiên expectedDate -> trả về chính expectedDate
 * - Nếu chưa có -> trả về ngày gần nhất trước expectedDate (<= expectedDate); nếu không có ngày nào trước đó -> null (Thiếu)
 */
function resolveDateForExpectedSession(sortedDates: string[], expectedDate: string): string | null {
    if (sortedDates.length === 0) return null;
    if (sortedDates.includes(expectedDate)) return expectedDate;
    const upToExpected = sortedDates.filter(d => d <= expectedDate);
    return upToExpected.length > 0 ? upToExpected[upToExpected.length - 1] : null;
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

    // Lọc danh sách ST áp dụng
    const activeStores = stores.filter(s => s.is_active !== false);
    const applicableStores = targetStore === 'all'
        ? activeStores
        : activeStores.filter(s => isStoreMatch(s.name, targetStore, stores));

    const totalStoreCount = applicableStores.length || 1;

    // 1. DOANH THU LŨY KẾ ST
    // Lọc các bản ghi khớp với tháng/năm và ST được chọn
    const storeRecords = records.filter(r => {
        if (targetStore !== 'all') {
            if (!isStoreMatch(r.storeName, targetStore, stores)) return false;
        } else {
            const matchesApp = applicableStores.some(s => isStoreMatch(r.storeName, s.name, stores));
            if (!matchesApp) return false;
        }
        return r.month === selectedMonth && r.year === selectedYear;
    });

    const validRevStoreRecords = storeRecords.filter(r => (r.revenueActual || 0) > 0 || (r.revenueTarget || 0) > 0);
    const storeDates = Array.from(new Set(validRevStoreRecords.map(r => r.reportDate))).filter(Boolean).sort();
    const displayStoreRevenueDate = resolveDateForExpectedSession(storeDates, expectedDate);

    // Lọc bản ghi đúng phiên đang chọn (expectedDate)
    const n1StoreRecords = validRevStoreRecords.filter(r => r.reportDate === expectedDate);
    const storeRevenueStoresCovered = applicableStores.filter(store =>
        n1StoreRecords.some(r => isStoreMatch(r.storeName, store.name, stores))
    ).length;

    const isStoreRevenueOk = storeRevenueStoresCovered >= totalStoreCount && storeRevenueStoresCovered > 0;

    // Thời gian cập nhật ưu tiên theo phiên đang chọn, fallback về bản ghi gần nhất <= expectedDate
    const upToStoreRecords = validRevStoreRecords.filter(r => r.reportDate <= expectedDate);
    const refStoreRecord = (n1StoreRecords.length > 0 ? n1StoreRecords : upToStoreRecords)
        .slice()
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
    const storeRevenueUpdatedAt = refStoreRecord?.updatedAt || null;

    const storeRevenueStream: DataStreamStatus = {
        id: 'store_revenue',
        title: 'ST - Doanh Thu Lũy Kế',
        shortTitle: 'DT ST LK',
        category: 'store',
        isOk: isStoreRevenueOk,
        statusText: isStoreRevenueOk ? 'OK' : (displayStoreRevenueDate ? 'CHẬM PHIÊN' : 'CHƯA CÓ DỮ LIỆU'),
        expectedDate,
        latestDataDate: displayStoreRevenueDate,
        lastUpdatedAt: storeRevenueUpdatedAt,
        lastUpdatedBy: refStoreRecord?.updatedBy || null,
        recordCount: n1StoreRecords.length > 0 ? n1StoreRecords.length : validRevStoreRecords.length,
        storeCoveredCount: storeRevenueStoresCovered,
        totalStoreCount,
        coveragePercent: Math.round((storeRevenueStoresCovered / totalStoreCount) * 100),
        description: 'Dữ liệu doanh thu lũy kế của ST',
        warningMessage: isStoreRevenueOk
            ? undefined
            : displayStoreRevenueDate
                ? `Phiên gần nhất trước mốc kiểm tra dừng ở ngày ${displayStoreRevenueDate}. Chưa đủ dữ liệu phiên ngày ${expectedDate}.`
                : `Chưa có bản ghi doanh thu nào cho phiên ngày ${expectedDate}.`,
        actionUrl: '/cap-nhat-ocr',
        actionLabel: 'Cập nhật số liệu LK'
    };

    // 2. TIẾN ĐỘ THI ĐUA NGÀNH HÀNG ST
    const emulationRecords = storeRecords.filter(r => r.emulationSummary && Object.keys(r.emulationSummary).length > 0);
    const emulationDates = Array.from(new Set(emulationRecords.map(r => r.reportDate))).filter(Boolean).sort();
    const displayEmulationDate = resolveDateForExpectedSession(emulationDates, expectedDate);

    const n1EmulationRecords = emulationRecords.filter(r => r.reportDate === expectedDate);
    const emulationStoresCovered = applicableStores.filter(store =>
        n1EmulationRecords.some(r => isStoreMatch(r.storeName, store.name, stores))
    ).length;

    const isStoreEmulationOk = emulationStoresCovered >= totalStoreCount && emulationStoresCovered > 0;

    const storeEmulationStream: DataStreamStatus = {
        id: 'store_emulation',
        title: 'ST - Lũy Kế Thi Đua',
        shortTitle: 'Thi đua ST LK',
        category: 'store',
        isOk: isStoreEmulationOk,
        statusText: isStoreEmulationOk ? 'OK' : (displayEmulationDate ? 'CHẬM PHIÊN' : 'CHƯA CÓ DỮ LIỆU'),
        expectedDate,
        latestDataDate: displayEmulationDate,
        lastUpdatedAt: storeRevenueUpdatedAt,
        recordCount: n1EmulationRecords.length > 0 ? n1EmulationRecords.length : emulationRecords.length,
        storeCoveredCount: emulationStoresCovered,
        totalStoreCount,
        coveragePercent: Math.round((emulationStoresCovered / totalStoreCount) * 100),
        description: 'Dữ liệu lũy kế thi đua các ngành hàng của ST',
        warningMessage: isStoreEmulationOk
            ? undefined
            : displayEmulationDate
                ? `Số liệu thi đua gần nhất ngày ${displayEmulationDate}. Chưa đủ thi đua phiên ngày ${expectedDate}.`
                : `Chưa có số liệu thi đua ngành hàng ST cho phiên ngày ${expectedDate}.`,
        actionUrl: '/cap-nhat-ocr',
        actionLabel: 'Nạp thi đua ST'
    };

    // 3. DOANH THU LŨY KẾ NHÂN VIÊN (Sessions)
    const empSessions = sessions.filter(s => {
        if (targetStore !== 'all') {
            if (!isStoreMatch(s.store_name, targetStore, stores)) return false;
        } else {
            const matchesApp = applicableStores.some(st => isStoreMatch(s.store_name, st.name, stores));
            if (!matchesApp) return false;
        }
        return s.month === selectedMonth && s.year === selectedYear;
    });

    const revSessions = empSessions.filter(s =>
        (s.session_type === 'REVENUE_CAMPAIGN' || s.session_type === 'FULL_SYNC') &&
        s.records && s.records.some(r => (r.revenue_actual || 0) > 0 || (r.revenue_qd || 0) > 0)
    );

    const revSessionDates = Array.from(new Set(revSessions.map(s => s.report_date))).filter(Boolean).sort();
    const displayEmpRevDate = resolveDateForExpectedSession(revSessionDates, expectedDate);

    const n1RevSessions = revSessions.filter(s => s.report_date === expectedDate);
    const empRevStoresCovered = applicableStores.filter(store =>
        n1RevSessions.some(s => isStoreMatch(s.store_name, store.name, stores))
    ).length;

    const isEmpRevOk = empRevStoresCovered >= totalStoreCount && empRevStoresCovered > 0;

    const upToRevSessions = revSessions.filter(s => (s.report_date || '') <= expectedDate);
    const refRevSession = (n1RevSessions.length > 0 ? n1RevSessions : upToRevSessions)
        .slice()
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];

    const empRevenueStream: DataStreamStatus = {
        id: 'employee_revenue',
        title: 'Nhân Viên - Lũy Kế Doanh Thu',
        shortTitle: 'DT Nhân viên LK',
        category: 'employee',
        isOk: isEmpRevOk,
        statusText: isEmpRevOk ? 'OK' : (displayEmpRevDate ? 'CHẬM PHIÊN' : 'CHƯA CÓ DỮ LIỆU'),
        expectedDate,
        latestDataDate: displayEmpRevDate,
        lastUpdatedAt: refRevSession?.created_at || null,
        lastUpdatedBy: refRevSession?.created_by || null,
        recordCount: (n1RevSessions.length > 0 ? n1RevSessions : revSessions).reduce(
            (acc, s) => acc + (s.employee_count || s.records?.length || 0),
            0
        ),
        storeCoveredCount: empRevStoresCovered,
        totalStoreCount,
        coveragePercent: Math.round((empRevStoresCovered / totalStoreCount) * 100),
        description: 'Dữ liệu doanh thu lũy kế theo từng nhân viên',
        warningMessage: isEmpRevOk
            ? undefined
            : displayEmpRevDate
                ? `Phiên doanh thu nhân sự gần nhất ngày ${displayEmpRevDate}. Chưa đủ phiên ngày ${expectedDate}.`
                : `Chưa có phiên doanh thu nhân sự nào cho phiên ngày ${expectedDate}.`,
        actionUrl: '/cap-nhat-nhan-vien-ocr',
        actionLabel: 'Cập nhật số liệu NV'
    };

    // 4. TIẾN ĐỘ THI ĐUA NHÂN VIÊN
    const campSessions = empSessions.filter(s =>
        (s.session_type === 'REVENUE_CAMPAIGN' || s.session_type === 'FULL_SYNC') &&
        s.records && s.records.some(r => r.campaigns && Object.keys(r.campaigns).length > 0)
    );

    const campSessionDates = Array.from(new Set(campSessions.map(s => s.report_date))).filter(Boolean).sort();
    const displayEmpCampDate = resolveDateForExpectedSession(campSessionDates, expectedDate);

    const n1CampSessions = campSessions.filter(s => s.report_date === expectedDate);
    const empCampStoresCovered = applicableStores.filter(store =>
        n1CampSessions.some(s => isStoreMatch(s.store_name, store.name, stores))
    ).length;

    const isEmpCampOk = empCampStoresCovered >= totalStoreCount && empCampStoresCovered > 0;

    const upToCampSessions = campSessions.filter(s => (s.report_date || '') <= expectedDate);
    const refCampSession = (n1CampSessions.length > 0 ? n1CampSessions : upToCampSessions)
        .slice()
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];

    const empEmulationStream: DataStreamStatus = {
        id: 'employee_emulation',
        title: 'Nhân Viên - Lũy Kế Thi Đua',
        shortTitle: 'Thi đua Nhân viên LK',
        category: 'employee',
        isOk: isEmpCampOk,
        statusText: isEmpCampOk ? 'OK' : (displayEmpCampDate ? 'CHẬM PHIÊN' : 'CHƯA CÓ DỮ LIỆU'),
        expectedDate,
        latestDataDate: displayEmpCampDate,
        lastUpdatedAt: refCampSession?.created_at || null,
        lastUpdatedBy: refCampSession?.created_by || null,
        recordCount: (n1CampSessions.length > 0 ? n1CampSessions : campSessions).reduce(
            (acc, s) => acc + (s.employee_count || s.records?.length || 0),
            0
        ),
        storeCoveredCount: empCampStoresCovered,
        totalStoreCount,
        coveragePercent: Math.round((empCampStoresCovered / totalStoreCount) * 100),
        description: 'Dữ liệu lũy kế thi đua của từng nhân viên',
        warningMessage: isEmpCampOk
            ? undefined
            : displayEmpCampDate
                ? `Phiên thi đua nhân viên gần nhất ngày ${displayEmpCampDate}. Chưa đủ phiên ngày ${expectedDate}.`
                : `Chưa có phiên thi đua nhân viên nào cho phiên ngày ${expectedDate}.`,
        actionUrl: '/cap-nhat-nhan-vien-ocr',
        actionLabel: 'Nạp thi đua NV'
    };

    // 5. CHỈ TIÊU KHOÁN THÁNG (Doanh thu & Thi đua)
    const applicableEmployees = employees.filter(e => {
        if (e.is_active === false) return false;
        if (targetStore !== 'all') {
            return isStoreMatch(e.store_name, targetStore, stores);
        }
        return applicableStores.some(st => isStoreMatch(e.store_name, st.name, stores));
    });

    const targetRevCount = empRevenueTargets.filter(t => {
        const emp = employees.find(e => e.employee_id === t.employee_id);
        if (!emp) return false;
        if (targetStore !== 'all') {
            return isStoreMatch(emp.store_name, targetStore, stores);
        }
        return applicableStores.some(st => isStoreMatch(emp.store_name, st.name, stores));
    }).length;

    const targetCampCount = empCampaignTargets.filter(t => {
        const emp = employees.find(e => e.employee_id === t.employee_id);
        if (!emp) return false;
        if (targetStore !== 'all') {
            return isStoreMatch(emp.store_name, targetStore, stores);
        }
        return applicableStores.some(st => isStoreMatch(emp.store_name, st.name, stores));
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

    // Hàm kiểm tra 1 session có chứa dữ liệu giờ công của 1 ST cụ thể hay không
    // (Hỗ trợ cả trường hợp session lưu theo tên ST riêng HOẶC session Toàn Cụm có chứa nhân viên của ST đó)
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

    // Phiên liên quan đến phạm vi đang chọn (Toàn Cụm hoặc ST cụ thể)
    const relevantHoursSessions = targetStore === 'all'
        ? monthHoursSessions
        : monthHoursSessions.filter(s => {
            const targetEmps = employees.filter(e => isStoreMatch(e.store_name, targetStore, stores) && e.is_active !== false);
            const targetEmpIds = new Set(targetEmps.map(e => e.employee_id));
            return sessionHasStoreWorkHours(s, targetStore, targetEmpIds);
        });

    const hoursSessionDates = Array.from(new Set(relevantHoursSessions.map(s => s.report_date))).filter(Boolean).sort();
    const displayHoursDate = resolveDateForExpectedSession(hoursSessionDates, expectedDate);

    // Kiểm tra ST nào trong applicableStores đã có dữ liệu giờ công đúng phiên (expectedDate)
    const n1HoursSessions = monthHoursSessions.filter(s => s.report_date === expectedDate);
    const storesWithHours = applicableStores.filter(store => {
        const storeEmps = employees.filter(e => isStoreMatch(e.store_name, store.name, stores) && e.is_active !== false);
        const storeEmpIds = new Set(storeEmps.map(e => e.employee_id));
        return n1HoursSessions.some(s => sessionHasStoreWorkHours(s, store.name, storeEmpIds));
    });

    const hoursStoresCovered = storesWithHours.length;
    const isHoursOk = hoursStoresCovered >= totalStoreCount && hoursStoresCovered > 0;

    const upToHoursSessions = relevantHoursSessions.filter(s => (s.report_date || '') <= expectedDate);
    const refHoursSession = (n1HoursSessions.length > 0 ? n1HoursSessions : upToHoursSessions)
        .slice()
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];

    const workHoursStream: DataStreamStatus = {
        id: 'employee_work_hours',
        title: 'Nhân Viên - Giờ Công Làm Việc',
        shortTitle: 'Giờ công NV LK',
        category: 'employee',
        isOk: isHoursOk,
        statusText: isHoursOk ? 'OK' : (displayHoursDate ? 'CHẬM PHIÊN' : 'CHƯA CÓ DỮ LIỆU'),
        expectedDate,
        latestDataDate: displayHoursDate,
        lastUpdatedAt: refHoursSession?.created_at || null,
        lastUpdatedBy: refHoursSession?.created_by || null,
        recordCount: (n1HoursSessions.length > 0 ? n1HoursSessions : relevantHoursSessions).reduce(
            (acc, s) => acc + (s.employee_count || s.records?.length || 0),
            0
        ),
        storeCoveredCount: hoursStoresCovered,
        totalStoreCount,
        coveragePercent: totalStoreCount > 0
            ? Math.round((hoursStoresCovered / totalStoreCount) * 100)
            : 0,
        description: 'Dữ liệu lũy kế giờ công của từng nhân viên',
        warningMessage: isHoursOk
            ? undefined
            : displayHoursDate
                ? `Phiên giờ công gần nhất ngày ${displayHoursDate}. Chưa đủ phiên ngày ${expectedDate}.`
                : `Chưa có phiên giờ công nào cho phiên ngày ${expectedDate}.`,
        actionUrl: '/cap-nhat-nhan-vien-ocr',
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

    // TÍNH BẢNG MA TRẬN THEO TỪNG ST (đối chiếu chính xác theo phiên expectedDate đã chọn)
    const matrix: StoreMatrixRow[] = applicableStores.map(store => {
        const storeName = store.name;

        // 1. DT ST
        const sAllRecords = records.filter(
            r => isStoreMatch(r.storeName, storeName, stores) && r.month === selectedMonth && r.year === selectedYear
        );
        const sRevRecords = sAllRecords.filter(r => (r.revenueActual || 0) > 0 || (r.revenueTarget || 0) > 0);
        const sRevDates = Array.from(new Set(sRevRecords.map(r => r.reportDate))).filter(Boolean).sort();
        const storeRevenueOk = sRevDates.includes(expectedDate);
        const storeRevenueDate = resolveDateForExpectedSession(sRevDates, expectedDate);

        // 2. Thi đua ST
        const sEmuRecords = sAllRecords.filter(r => r.emulationSummary && Object.keys(r.emulationSummary).length > 0);
        const sEmuDates = Array.from(new Set(sEmuRecords.map(r => r.reportDate))).filter(Boolean).sort();
        const storeEmulationOk = sEmuDates.includes(expectedDate);

        // 3. DT Nhân viên
        const sSessions = sessions.filter(
            s => isStoreMatch(s.store_name, storeName, stores) && s.month === selectedMonth && s.year === selectedYear
        );
        const sEmpRev = sSessions.filter(s =>
            (s.session_type === 'REVENUE_CAMPAIGN' || s.session_type === 'FULL_SYNC') &&
            s.records && s.records.some(r => (r.revenue_actual || 0) > 0 || (r.revenue_qd || 0) > 0)
        );
        const sEmpRevDates = Array.from(new Set(sEmpRev.map(s => s.report_date))).filter(Boolean).sort();
        const employeeRevenueOk = sEmpRevDates.includes(expectedDate);
        const employeeRevenueDate = resolveDateForExpectedSession(sEmpRevDates, expectedDate);

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

        // 6. Giờ công Nhân viên (Đối chiếu chính xác theo phiên expectedDate)
        const sHoursSessions = monthHoursSessions.filter(s => sessionHasStoreWorkHours(s, storeName, storeEmpIds));
        const sHoursDates = Array.from(new Set(sHoursSessions.map(s => s.report_date))).filter(Boolean).sort();
        const storeHoursOk = sHoursDates.includes(expectedDate);
        const workHoursDate = resolveDateForExpectedSession(sHoursDates, expectedDate);

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
            storeRevenueDate,
            storeEmulationOk,
            storeEmulationCount: sEmuRecords.length,
            employeeRevenueOk,
            employeeRevenueDate,
            employeeEmulationOk,
            employeeEmulationCount: sEmpCamp.length,
            employeeTargetsOk,
            employeeTargetsCount: sTargetsCount,
            workHoursOk: storeHoursOk,
            workHoursDate,
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
