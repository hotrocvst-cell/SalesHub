import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    fetchStores,
    fetchCampaignDictionary,
    fetchBusinessRecords,
    type StoreItem,
    type CampaignDictItem,
    type BusinessDayRecord
} from '../../../core/lib/storage';
import { isStoreMatch, getShortStoreName, getCampaignLabel } from '../../../core/lib/formatters';
import { useAuth } from '../../../shared/contexts/AuthContext';
import type { CampaignProgramItem } from '../types';

/**
 * Chuẩn hóa chuỗi tiếng Việt để so khớp không phân biệt hoa thường, dấu và ký tự đặc biệt
 */
function normalizeText(text: string): string {
    return (text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Kiểm tra xem chương trình thi đua trong cẩm nang có khớp với một trong các tên mục tiêu từ báo cáo lũy kế tháng không
 */
function isProgramMatchingTargets(
    program: CampaignProgramItem,
    targetTerms: { raw: string; label: string; normalized: string }[]
): boolean {
    const pNameNorm = normalizeText(program.program_name);
    const pGroupNorm = normalizeText(program.group_name);
    const pRulesNorm = normalizeText(program.rules);

    for (const term of targetTerms) {
        const tNorm = term.normalized;
        if (!tNorm || tNorm.length < 2) continue;

        // 1. Khớp trực tiếp trong tên chương trình
        if (pNameNorm.includes(tNorm) || tNorm.includes(pNameNorm)) {
            return true;
        }

        // 2. Token overlap: Tên mục tiêu (ví dụ "phu kien", "gia dung", "bao hanh", "sim so") nằm trọn trong tên chương trình
        const targetTokens = tNorm.split(' ').filter(w => w.length > 1);
        if (targetTokens.length > 0 && targetTokens.every(tok => pNameNorm.includes(tok))) {
            return true;
        }

        // 3. Khớp nhóm thi đua (ví dụ "ICT", "CE", "Dịch vụ", "Gia dụng", "Phụ kiện")
        if (pGroupNorm && (pGroupNorm === tNorm || pGroupNorm.includes(tNorm) || tNorm.includes(pGroupNorm))) {
            return true;
        }

        // 4. Khớp từ khóa đặc thù ngành hàng
        if (tNorm.includes('sim') && (pNameNorm.includes('sim') || pRulesNorm.includes('sim'))) return true;
        if (tNorm.includes('bao hanh') && (pNameNorm.includes('bao hanh') || pRulesNorm.includes('bao hanh'))) return true;
        if (tNorm.includes('tra gop') && (pNameNorm.includes('tra gop') || pRulesNorm.includes('tra gop'))) return true;
        if (tNorm.includes('gia dung') && (pNameNorm.includes('gia dung') || pGroupNorm.includes('gia dung'))) return true;
        if (tNorm.includes('phu kien') && (pNameNorm.includes('phu kien') || pGroupNorm.includes('phu kien'))) return true;
    }

    return false;
}

export interface UseUserStoreCampaignFilterResult {
    selectedStore: string;
    setSelectedStore: (store: string) => void;
    storeOptions: string[];
    isStoreSelectable: boolean;
    storeTargetsCount: number;
    storeTargetNames: string[];
    matchedProgramIds: string[];
    onlyShowStoreTargets: boolean;
    setOnlyShowStoreTargets: (val: boolean) => void;
    handleAutoSelectStoreTargets: () => void;
    loadingTargets: boolean;
    reportMonthDisplay: string;
    userStoreLabel: string;
}

export function useUserStoreCampaignFilter(
    programs: CampaignProgramItem[],
    onApplySelection: (selectedIds: Set<string>) => void,
    showToast: (msg: string) => void
): UseUserStoreCampaignFilterResult {
    const { currentUser, isAdmin } = useAuth();

    const [stores, setStores] = useState<StoreItem[]>([]);
    const [campaignDict, setCampaignDict] = useState<CampaignDictItem[]>([]);
    const [businessRecords, setBusinessRecords] = useState<BusinessDayRecord[]>([]);
    const [loadingTargets, setLoadingTargets] = useState<boolean>(true);
    const [reportMonthDisplay, setReportMonthDisplay] = useState<string>('');

    // Checkbox "Chỉ xem thi đua có mục tiêu của shop"
    const [onlyShowStoreTargets, setOnlyShowStoreTargets] = useState<boolean>(false);

    // Xác định siêu thị mặc định của user
    const defaultUserStore = useMemo(() => {
        if (currentUser?.store_name && currentUser.store_name.trim()) {
            return currentUser.store_name.trim();
        }
        if (currentUser?.accessible_stores && currentUser.accessible_stores.length > 0) {
            return currentUser.accessible_stores[0].trim();
        }
        return '';
    }, [currentUser]);

    const [selectedStore, setSelectedStore] = useState<string>(defaultUserStore || 'all');

    // Đồng bộ lại nếu defaultUserStore thay đổi
    useEffect(() => {
        if (defaultUserStore && selectedStore === 'all' && !isAdmin) {
            setSelectedStore(defaultUserStore);
        }
    }, [defaultUserStore, isAdmin]);

    // 1. Tải dữ liệu siêu thị, từ điển và báo cáo lũy kế tháng
    useEffect(() => {
        let isMounted = true;
        const loadInitialData = async () => {
            setLoadingTargets(true);
            try {
                const now = new Date();
                const curMonth = now.getMonth() + 1;
                const curYear = now.getFullYear();

                const [storesRes, dictRes, recsCurrent] = await Promise.all([
                    fetchStores(),
                    fetchCampaignDictionary(),
                    fetchBusinessRecords(curMonth, curYear)
                ]);

                if (!isMounted) return;

                if (storesRes.success && storesRes.data) setStores(storesRes.data);
                if (dictRes.success && dictRes.data) setCampaignDict(dictRes.data);

                let records = recsCurrent.success && recsCurrent.data ? recsCurrent.data : [];
                let activeMonth = curMonth;
                let activeYear = curYear;

                // Nếu tháng hiện tại chưa có records nào (đầu tháng mới), thử tháng trước
                if (records.length === 0) {
                    const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
                    const prevYear = curMonth === 1 ? curYear - 1 : curYear;
                    const recsPrev = await fetchBusinessRecords(prevMonth, prevYear);
                    if (recsPrev.success && recsPrev.data && recsPrev.data.length > 0) {
                        records = recsPrev.data;
                        activeMonth = prevMonth;
                        activeYear = prevYear;
                    }
                }

                setBusinessRecords(records);
                setReportMonthDisplay(`Tháng ${activeMonth}/${activeYear}`);
            } catch (err) {
                console.warn('Lỗi tải dữ liệu mục tiêu lũy kế tháng:', err);
            } finally {
                if (isMounted) setLoadingTargets(false);
            }
        };

        loadInitialData();
        return () => { isMounted = false; };
    }, []);

    // 2. Danh sách các lựa chọn siêu thị cho dropdown
    const storeOptions = useMemo(() => {
        const set = new Set<string>();

        // Lấy từ danh sách stores hệ thống
        stores.forEach(s => {
            const name = s.name?.trim();
            if (name && !name.toLowerCase().startsWith('tổng')) {
                set.add(name);
            }
        });

        // Thêm từ businessRecords nếu có
        businessRecords.forEach(r => {
            const sName = getShortStoreName(r.storeName);
            if (sName && sName !== 'Tổng' && !/^(tổng|tong)/i.test(r.storeName)) {
                set.add(sName);
            }
        });

        // Nếu là tài khoản trải nghiệm, chỉ xem siêu thị 10335
        if (currentUser?.is_guest) {
            return [defaultUserStore || '10335 - AAR_BRV_VTA - 290 Trương Công Định'];
        }

        // Nếu là nhân viên thông thường, chỉ xem shop của mình
        if (currentUser?.role === 'NHAN_VIEN' && defaultUserStore) {
            return [defaultUserStore];
        }

        // Nếu quản lý có accessible_stores
        if (currentUser?.accessible_stores && currentUser.accessible_stores.length > 0 && !isAdmin) {
            const allowed = Array.from(set).filter(s =>
                currentUser.accessible_stores!.some(acc => isStoreMatch(s, acc, stores))
            );
            return allowed.length > 0 ? allowed : currentUser.accessible_stores;
        }

        const list = Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
        return list;
    }, [stores, businessRecords, currentUser, defaultUserStore, isAdmin]);

    // Quyền đổi siêu thị (Chỉ Quản lý, Trưởng ca hoặc Admin, không áp dụng cho tài khoản trải nghiệm)
    const isStoreSelectable = !currentUser?.is_guest && (isAdmin || (currentUser?.role !== 'NHAN_VIEN' && storeOptions.length > 1));

    // 3. Trích xuất danh sách các mục tiêu thi đua có target > 0 của selectedStore từ báo cáo lũy kế tháng
    const storeTargetTerms = useMemo(() => {
        if (!selectedStore || businessRecords.length === 0) return [];

        const isAll = selectedStore === 'all' || selectedStore.toLowerCase().includes('toàn cụm');

        // Lọc records phù hợp
        const matchedRecs = businessRecords.filter(r => {
            if (isAll) {
                const sName = getShortStoreName(r.storeName);
                return sName !== 'Tổng' && !/^(tổng|tong)/i.test(r.storeName);
            }
            return isStoreMatch(r.storeName, selectedStore, stores) ||
                   getShortStoreName(r.storeName) === getShortStoreName(selectedStore);
        });

        if (matchedRecs.length === 0) return [];

        // Gom các mục tiêu có target > 0 từ emulationSummary
        const targetMap = new Map<string, { raw: string; label: string; normalized: string }>();

        matchedRecs.forEach(r => {
            if (r.emulationSummary && typeof r.emulationSummary === 'object') {
                Object.entries(r.emulationSummary).forEach(([rawKey, val]: [string, any]) => {
                    const targetVal = Number(val?.target) || 0;
                    if (targetVal > 0) {
                        const trimmedRaw = rawKey.trim();
                        const label = getCampaignLabel(trimmedRaw, campaignDict) || trimmedRaw;
                        const key = trimmedRaw.toLowerCase();
                        if (!targetMap.has(key)) {
                            targetMap.set(key, {
                                raw: trimmedRaw,
                                label,
                                normalized: normalizeText(label || trimmedRaw)
                            });
                        }
                    }
                });
            }
        });

        return Array.from(targetMap.values());
    }, [selectedStore, businessRecords, stores, campaignDict]);

    const storeTargetNames = useMemo(() => storeTargetTerms.map(t => t.label || t.raw), [storeTargetTerms]);
    const storeTargetsCount = storeTargetTerms.length;

    // 4. So khớp danh sách chương trình trong cẩm nang với các mục tiêu của siêu thị
    const matchedProgramIds = useMemo<string[]>(() => {
        if (storeTargetTerms.length === 0 || programs.length === 0) return [];

        const ids: string[] = [];
        programs.forEach(program => {
            if (isProgramMatchingTargets(program, storeTargetTerms)) {
                ids.push(program.id);
            }
        });
        return ids;
    }, [programs, storeTargetTerms]);

    // 5. Hành động: Tự động tick chọn các chương trình thi đua có mục tiêu
    const handleAutoSelectStoreTargets = useCallback(() => {
        const storeLabel = selectedStore === 'all' ? 'Toàn cụm' : getShortStoreName(selectedStore);

        if (matchedProgramIds.length === 0) {
            showToast(`⚠️ Chưa tìm thấy chương trình thi đua có mục tiêu nào trong ${reportMonthDisplay} của ${storeLabel}`);
            return;
        }

        onApplySelection(new Set(matchedProgramIds));
        showToast(`🎯 Đã tự động chọn ${matchedProgramIds.length} chương trình thi đua có khai báo mục tiêu của ${storeLabel}!`);
    }, [matchedProgramIds, selectedStore, reportMonthDisplay, onApplySelection, showToast]);

    const userStoreLabel = useMemo(() => {
        if (selectedStore === 'all') return 'Toàn cụm';
        return getShortStoreName(selectedStore);
    }, [selectedStore]);

    return {
        selectedStore,
        setSelectedStore,
        storeOptions,
        isStoreSelectable,
        storeTargetsCount,
        storeTargetNames,
        matchedProgramIds,
        onlyShowStoreTargets,
        setOnlyShowStoreTargets,
        handleAutoSelectStoreTargets,
        loadingTargets,
        reportMonthDisplay,
        userStoreLabel
    };
}
