import type { CampaignSummaryData, CampaignSummaryRow, SmartRemarkAnalysis } from '../types';
import type { EmployeeDataSession } from '../../employee-cumulative/utils/sessionStorage';
import { getCampaignLabel, formatDate, isStoreMatch } from '../../../core/lib/formatters';
import { getShortenedEmployeeName } from '../../employee-performance/utils/performanceConfig';
import type { CampaignDictItem } from '../../../core/lib/storage';
import { getStoreCampaignScoreConfig, getCampaignPoints } from '../../../core/lib/storeCampaignScoreService';

/**
 * Chuẩn hóa chuỗi định danh thi đua để đối chiếu linh hoạt:
 * - Bỏ dấu tiếng Việt, chuyển chữ thường
 * - Bỏ tiền tố tháng (T09 -, T10 -, ...)
 * - Bỏ ký tự đặc biệt, gạch dưới, khoảng trắng
 */
export function normalizeCampaignToken(str: string): string {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
        .replace(/đ/g, 'd')
        .replace(/^t\d{1,2}\s*-\s*(t\d{1,2}\s*)?/i, '') // Bỏ tiền tố tháng kiểu T10 -, T09 - T10 -
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

/**
 * Tìm NHÓM thi đua chuẩn (canonical campaign) từ rawKey dựa vào campaignDict:
 * - Ưu tiên khớp chính xác với NHÓM thi đua ĐANG HOẠT ĐỘNG (is_active)
 * - Tiếp theo đối chiếu token chuẩn hóa (để gom "Ví trả sau", "T10 - VÍ TRẢ SAU", "VÍ_TRẢ_SAU" về cùng 1 NHÓM thi đua chuẩn)
 * - Nếu không có trong active, tìm trong toàn bộ từ điển
 */
export function resolveCanonicalCampaign(
    rawKey: string,
    campaignDict: CampaignDictItem[] = []
): { canonicalKey: string; dictItem?: CampaignDictItem } {
    if (!rawKey) return { canonicalKey: '' };
    const trimmed = rawKey.trim();
    if (!campaignDict || campaignDict.length === 0) {
        return { canonicalKey: trimmed };
    }

    const upper = trimmed.toUpperCase();
    const token = normalizeCampaignToken(trimmed);

    const activeItems = campaignDict.filter(d => d.is_active);

    // 1. Khớp tuyệt đối theo raw_key trong active
    const exactActiveRaw = activeItems.find(d => d.raw_key.trim().toUpperCase() === upper);
    if (exactActiveRaw) return { canonicalKey: exactActiveRaw.raw_key, dictItem: exactActiveRaw };

    // 2. Khớp tuyệt đối theo display_name trong active
    const exactActiveDisplay = activeItems.find(d => d.display_name.trim().toUpperCase() === upper);
    if (exactActiveDisplay) return { canonicalKey: exactActiveDisplay.raw_key, dictItem: exactActiveDisplay };

    // 3. Khớp qua token chuẩn hóa trong active (loại bỏ T10 -, dấu tiếng Việt, gạch dưới)
    const tokenActive = activeItems.find(d => {
        const dRawToken = normalizeCampaignToken(d.raw_key);
        const dDisplayToken = normalizeCampaignToken(d.display_name);
        return dRawToken === token || dDisplayToken === token;
    });
    if (tokenActive) return { canonicalKey: tokenActive.raw_key, dictItem: tokenActive };

    // 4. Nếu rawKey trùng với một mục inactive, kiểm tra xem mục inactive đó có cùng display_name / token với mục active nào không
    const inactiveMatch = campaignDict.find(d => !d.is_active && (
        d.raw_key.trim().toUpperCase() === upper ||
        d.display_name.trim().toUpperCase() === upper ||
        normalizeCampaignToken(d.raw_key) === token ||
        normalizeCampaignToken(d.display_name) === token
    ));
    if (inactiveMatch) {
        const inactToken = normalizeCampaignToken(inactiveMatch.display_name) || normalizeCampaignToken(inactiveMatch.raw_key);
        const linkedActive = activeItems.find(d =>
            normalizeCampaignToken(d.display_name) === inactToken ||
            normalizeCampaignToken(d.raw_key) === inactToken
        );
        if (linkedActive) return { canonicalKey: linkedActive.raw_key, dictItem: linkedActive };
    }

    // 5. Nếu không khớp được với active item nào, tìm trong tất cả các item (kể cả inactive)
    const anyExact = campaignDict.find(d => d.raw_key.trim().toUpperCase() === upper || d.display_name.trim().toUpperCase() === upper);
    if (anyExact) return { canonicalKey: anyExact.raw_key, dictItem: anyExact };

    const anyToken = campaignDict.find(d =>
        normalizeCampaignToken(d.raw_key) === token ||
        normalizeCampaignToken(d.display_name) === token
    );
    if (anyToken) return { canonicalKey: anyToken.raw_key, dictItem: anyToken };

    // 6. Fallback giữ nguyên rawKey
    return { canonicalKey: trimmed };
}

/**
 * Kiểm tra nhân viên có thuộc siêu thị được chọn hay không
 */
export function isEmployeeInStore(
    employeeId: string,
    selectedStore: string,
    empStoreMap: Record<string, string> = {},
    sessionStoreName?: string,
    storesList?: Array<{ code?: string; name: string; id?: string }>
): boolean {
    if (!selectedStore || selectedStore === 'all') return true;

    const empStore = empStoreMap[employeeId.trim()];
    if (empStore) {
        return isStoreMatch(empStore, selectedStore, storesList);
    }

    // Nếu không có trong danh bạ nhân viên, kiểm tra theo siêu thị của phiên
    if (sessionStoreName && sessionStoreName !== 'Toàn Cụm Siêu Thị') {
        return isStoreMatch(sessionStoreName, selectedStore, storesList);
    }

    return false;
}

/**
 * Chuyển đổi một phiên dữ liệu đã cập nhật thành Bảng Tổng Hợp Thi Đua Ngành Hàng
 * - Lọc kết quả nhân viên theo siêu thị và CHỈ CHỌN nhân viên có khai báo target
 * - Tổng số thi đua CHỈ TÍNH theo thi đua có target và theo siêu thị
 * - Số liệu mỗi ô là kết quả % Dự Kiến Hoàn Thành (%DKHT)
 * - Tên nhân viên rút gọn: MSNV - Tên NV viết tắt
 * - Thứ hạng sắp xếp giảm dần theo số thi đua dự kiến đạt
 */
export function buildCampaignSummaryFromSession(
    session: EmployeeDataSession,
    targetsMap: Record<string, Record<string, number>> = {},
    campaignDict: CampaignDictItem[] = [],
    passedDays: number = 26,
    operatingDays: number = 30,
    options?: {
        selectedStore?: string;
        empStoreMap?: Record<string, string>;
        storesList?: Array<{ code?: string; name: string; id?: string }>;
    }
): CampaignSummaryData {
    const rawRecords = session.records || [];
    const selectedStore = options?.selectedStore || 'all';
    const empStoreMap = options?.empStoreMap || {};

    // 1. Lọc kết quả nhân viên:
    // (a) Theo siêu thị (nếu có chọn siêu thị cụ thể)
    // (b) CHỈ CHỌN NHÂN VIÊN CÓ KHAI BÁO TARGET (targetsMap[empId] có ít nhất 1 target > 0)
    const filteredRecords = rawRecords.filter(r => {
        const empId = (r.employee_id || '').trim();
        if (!empId) return false;

        // Bắt buộc: Nhân viên phải có khai báo target thi đua cho tháng này
        const empTargets = targetsMap[empId];
        if (!empTargets) return false;
        const hasTarget = Object.values(empTargets).some(v => Number(v) > 0);
        if (!hasTarget) return false;

        // Lọc theo siêu thị
        if (selectedStore !== 'all') {
            const belongsToStore = isEmployeeInStore(
                empId,
                selectedStore,
                empStoreMap,
                session.store_name,
                options?.storesList
            );
            if (!belongsToStore) return false;
        }

        return true;
    });

    // 2. Tổng số thi đua chỉ tính theo thi đua có target và theo siêu thị:
    // Thu thập các thi đua mà các nhân viên thuộc siêu thị này có target > 0
    // Chuẩn hóa về canonicalKey để triệt tiêu việc nhân đôi cột khi đổi tên / cập nhật raw_key (ví dụ: Ví trả sau vs T10 - VÍ TRẢ SAU)
    const canonicalCategoriesMap = new Map<string, {
        canonicalKey: string;
        rawKeys: Set<string>;
        dictItem?: CampaignDictItem;
    }>();

    filteredRecords.forEach(r => {
        const empId = (r.employee_id || '').trim();
        const empTargets = targetsMap[empId] || {};
        Object.entries(empTargets).forEach(([rawKey, val]) => {
            if (Number(val) > 0 && rawKey && rawKey.trim()) {
                const trimmedKey = rawKey.trim();
                const resolved = resolveCanonicalCampaign(trimmedKey, campaignDict);
                const cKey = resolved.canonicalKey;

                if (!canonicalCategoriesMap.has(cKey)) {
                    canonicalCategoriesMap.set(cKey, {
                        canonicalKey: cKey,
                        rawKeys: new Set<string>(),
                        dictItem: resolved.dictItem
                    });
                }
                canonicalCategoriesMap.get(cKey)!.rawKeys.add(trimmedKey);
            }
        });
    });

    // Sắp xếp các cột thi đua theo thứ tự khai báo trong từ điển (order_index/sort_order) hoặc bảng chữ cái
    const categories = Array.from(canonicalCategoriesMap.keys()).sort((a, b) => {
        const itemA = canonicalCategoriesMap.get(a)?.dictItem || campaignDict.find(d => d.raw_key === a || d.display_name === a);
        const itemB = canonicalCategoriesMap.get(b)?.dictItem || campaignDict.find(d => d.raw_key === b || d.display_name === b);
        const orderA = itemA?.order_index ?? itemA?.sort_order ?? 999;
        const orderB = itemB?.order_index ?? itemB?.sort_order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.localeCompare(b);
    });

    const totalCategories = categories.length;

    // 3. Tính toán %DKHT cho từng nhân viên và từng ngành hàng thi đua
    const safePassed = Math.max(1, passedDays);
    const safeTotalDays = Math.max(1, operatingDays);

    const effectiveStoreName = selectedStore === 'all'
        ? (session.store_name || 'Toàn Cụm Siêu Thị')
        : selectedStore;

    const baseScoreConfig = getStoreCampaignScoreConfig(effectiveStoreName);
    const isPointsMode = baseScoreConfig.scoring_mode === 'POINTS';

    const rows: CampaignSummaryRow[] = filteredRecords.map(r => {
        const empId = (r.employee_id || '').trim();
        const fullName = (r.full_name || '').trim();
        const shortName = getShortenedEmployeeName(fullName);
        const displayName = `${empId} - ${shortName}`;

        const empStore = empStoreMap[empId] || session.store_name || effectiveStoreName;
        const currentScoreConfig = (selectedStore === 'all' && empStore)
            ? getStoreCampaignScoreConfig(empStore)
            : baseScoreConfig;

        let achievedCount = 0;
        let achievedPoints = 0;
        let totalPoints = 0;
        const campaignRates: Record<string, number> = {};

        categories.forEach(cat => {
            const catInfo = canonicalCategoriesMap.get(cat);
            const aliasKeys = catInfo ? Array.from(catInfo.rawKeys) : [cat];

            // 1. Lấy targetVal: Ưu tiên key chính thức cat, nếu không có thì tìm trong các aliasKeys
            const empTargets = targetsMap[empId] || {};
            let targetVal = Number(empTargets[cat]) || 0;
            if (targetVal <= 0) {
                for (const alias of aliasKeys) {
                    const v = Number(empTargets[alias]) || 0;
                    if (v > 0) {
                        targetVal = v;
                        break;
                    }
                }
            }

            // 2. Lấy actualVal từ session: Kiểm tra r.campaigns[cat] và tất cả các alias hoặc key có canonicalKey === cat
            let actualVal = 0;
            if (r.campaigns) {
                if (r.campaigns[cat] !== undefined) {
                    actualVal = Number(r.campaigns[cat]) || 0;
                } else {
                    for (const alias of aliasKeys) {
                        if (r.campaigns[alias] !== undefined) {
                            actualVal = Number(r.campaigns[alias]) || 0;
                            break;
                        }
                    }
                }

                if (actualVal === 0) {
                    for (const [sessKey, sessVal] of Object.entries(r.campaigns)) {
                        const sessResolved = resolveCanonicalCampaign(sessKey, campaignDict);
                        if (sessResolved.canonicalKey === cat) {
                            actualVal = Number(sessVal) || 0;
                            break;
                        }
                    }
                }
            }

            let rate = 0;
            if (targetVal > 0) {
                // Công thức dự báo chuẩn: (Lũy kế thực tế / passedDays * totalDays) / Target * 100
                const forecastVal = (actualVal / safePassed) * safeTotalDays;
                rate = Math.round((forecastVal / targetVal) * 100);
            } else {
                rate = 0;
            }

            campaignRates[cat] = rate;
            const pointsWeight = getCampaignPoints(cat, currentScoreConfig);
            totalPoints += pointsWeight;

            // Quy tắc tính: nếu dự kiến đạt từ 100%, có điểm. Không đạt không có điểm
            if (rate >= 100) {
                achievedCount++;
                achievedPoints += pointsWeight;
            }
        });

        // Tỷ lệ hoàn thành tổng quan: nếu tính điểm thì tính theo Điểm đạt/Tổng điểm, nếu đếm số lượng thì Số đạt/Tổng số mục
        const achievementRate = isPointsMode
            ? (totalPoints > 0 ? Number(((achievedPoints / totalPoints) * 100).toFixed(1)) : 0)
            : (totalCategories > 0 ? Number(((achievedCount / totalCategories) * 100).toFixed(1)) : 0);

        return {
            stt: 1,
            employee_id: empId,
            full_name: fullName,
            display_name: displayName,
            store_name: empStoreMap[empId] || session.store_name,
            achieved_count: achievedCount,
            total_count: totalCategories,
            achieved_points: Number(achievedPoints.toFixed(1)),
            total_points: Number(totalPoints.toFixed(1)),
            achievement_rate: achievementRate,
            campaign_rates: campaignRates,
            scoring_mode: isPointsMode ? 'POINTS' : 'COUNT'
        };
    });

    // 4. Sắp xếp giảm dần theo điểm hoặc số thi đua dự kiến đạt (và tỷ lệ %DKHT)
    rows.sort((a, b) => {
        if (isPointsMode) {
            const diffPoints = (b.achieved_points ?? 0) - (a.achieved_points ?? 0);
            if (diffPoints !== 0) return diffPoints;
        } else {
            if (b.achieved_count !== a.achieved_count) {
                return b.achieved_count - a.achieved_count;
            }
        }
        return b.achievement_rate - a.achievement_rate;
    });

    // Gán lại số thứ tự STT
    rows.forEach((r, idx) => {
        r.stt = idx + 1;
    });

    // Định dạng ngày hiển thị DD/MM/YYYY
    const dateDisplay = formatDate(session.report_date);

    return {
        report_date: session.report_date,
        date_display: dateDisplay,
        mode_label: 'DỰ KIẾN',
        store_name: effectiveStoreName,
        scoring_mode: isPointsMode ? 'POINTS' : 'COUNT',
        total_categories: totalCategories,
        categories,
        rows,
        created_at: session.created_at,
        updated_at: new Date().toISOString()
    };
}

/**
 * Thuật toán phân tích số liệu thông minh & tạo văn bản nhận xét Messaging App
 */
export function generateSmartRemarks(
    data: CampaignSummaryData,
    campaignDict: CampaignDictItem[] = []
): SmartRemarkAnalysis {
    if (!data.rows || data.rows.length === 0) {
        return {
            topEmployees: [],
            bottomEmployees: [],
            bestCategories: [],
            weakCategories: [],
            recommendedZaloText: ''
        };
    }

    const isPointsMode = data.scoring_mode === 'POINTS';
    const rows = [...data.rows].sort((a, b) => {
        if (isPointsMode) {
            return (b.achieved_points ?? 0) - (a.achieved_points ?? 0);
        }
        return b.achieved_count - a.achieved_count;
    });

    // 1. Top 3 nhân sự xuất sắc
    const topEmployees = rows.slice(0, 3).map(r => ({
        name: r.display_name,
        achieved: isPointsMode ? `${r.achieved_points ?? 0}/${r.total_points ?? 0} đ` : `${r.achieved_count}/${r.total_count}`,
        rate: r.achievement_rate
    }));

    // 2. Nhóm nhân sự cần tập trung hỗ trợ
    const bottomEmployees = rows.slice(-3).reverse().map(r => ({
        name: r.display_name,
        achieved: isPointsMode ? `${r.achieved_points ?? 0}/${r.total_points ?? 0} đ` : `${r.achieved_count}/${r.total_count}`,
        rate: r.achievement_rate
    }));

    // 3. Đánh giá ngành hàng mũi nhọn & ngành hàng cần kéo số
    const categoryStats: { name: string; shortName: string; passCount: number; zeroCount: number; under50Count: number }[] = [];
    data.categories.forEach(cat => {
        let pass = 0;
        let zero = 0;
        let under50 = 0;
        data.rows.forEach(r => {
            const val = r.campaign_rates[cat] || 0;
            if (val >= 100) pass++;
            if (val === 0) zero++;
            if (val < 50) under50++;
        });
        const shortName = getCampaignLabel(cat, campaignDict);
        categoryStats.push({ name: cat, shortName, passCount: pass, zeroCount: zero, under50Count: under50 });
    });

    const bestCategories = [...categoryStats]
        .sort((a, b) => b.passCount - a.passCount)
        .slice(0, 3)
        .map(c => ({
            name: c.shortName,
            passRate: Number(((c.passCount / Math.max(1, data.rows.length)) * 100).toFixed(1)),
            passedCount: c.passCount
        }));

    const weakCategories = [...categoryStats]
        .sort((a, b) => b.under50Count - a.under50Count)
        .slice(0, 3)
        .map(c => ({
            name: c.shortName,
            zeroCount: c.zeroCount,
            under50Count: c.under50Count
        }));

    // 4. Mẫu tin nhắn Messaging App chuẩn phong cách TGDD/DMX
    const topNames = topEmployees.map((t, idx) => `   ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} ${t.name}: dự kiến đạt ${t.achieved} (${t.rate}%)`).join('\n');
    const bottomNames = bottomEmployees.map(b => `   👉 ${b.name}: dự kiến đạt ${b.achieved} (${b.rate}%)`).join('\n');
    const bestCatText = bestCategories.map(c => `   🔥 ${c.name}: ${c.passedCount}/${data.rows.length} bạn hoàn thành (${c.passRate}%)`).join('\n');
    const weakCatText = weakCategories.map(c => `   ⚠️ ${c.name}: có ${c.under50Count} bạn chưa đạt`).join('\n');

    const recommendedZaloText = `📢 TỔNG HỢP THI ĐUA NGÀNH HÀNG (${data.date_display} - ${data.mode_label})
🏢 ${data.store_name}
📊 Thi đua: ${data.total_categories} ngành hàng

🏆 TOP XUẤT SẮC DẪN ĐẦU:
${topNames}
👏 Chúc mừng các bạn đã duy trì phong độ rất tốt trên nhiều ngành hàng!

🌟 CÁC THI ĐUA MŨI NHỌN DẪN ĐẦU:
${bestCatText}

⚡ TRỌNG TÂM CẦN TĂNG TỐC KÉO SỐ:
${weakCatText}

🎯 NHÂN SỰ CẦN TĂNG TỐC VỀ ĐÍCH:
${bottomNames}
\n💪 Các bạn rà soát NH còn thiếu, tập trung bán kèm bán thêm các gói bảo hiểm, phụ kiện để nhanh chóng về đích nhé!

Chúc team một ngày bùng nổ! 🔥🚀`;

    return {
        topEmployees,
        bottomEmployees,
        bestCategories,
        weakCategories,
        recommendedZaloText
    };
}
