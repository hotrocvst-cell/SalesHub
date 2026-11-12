import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';
import { useUserStoreFilter } from '../../shared/hooks/useUserStoreFilter';
import {
    fetchStores,
    fetchEmployees,
    fetchCampaignDictionary,
    type StoreItem,
    type EmployeeItem,
    type CampaignDictItem
} from '../../core/lib/storage';
import {
    getYesterdayDateString,
    formatDate,
    formatDateTime,
    formatValue,
    getShortStoreName,
    isStoreMatch
} from '../../core/lib/formatters';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import OcrUploadZone from './components/OcrUploadZone';
import EmployeeManualDataEntryModule from './components/EmployeeManualDataEntryModule';
import GeminiApiKeyModal from './components/GeminiApiKeyModal';
import {
    extractAndMergeEmployeeImages,
    extractAdditionalEmulationImages,
    extractAdditionalWorkHoursImages,
    convertOcrItemsToSessionRecords,
    convertSessionRecordsToOcrItems,
    type EmployeeOcrParsedItem
} from './services/geminiEmployeeOcrService';
import { mergeOcrItemsWithExistingSessions } from './services/employeeOcrSessionMerge';
import {
    fetchStoreKnownCampaignTargets,
    isQuantityCampaign,
    type KnownStoreCampaignTarget,
    type CampaignMappingItem
} from './services/campaignTargetMappingService';
import {
    resolveActiveGeminiKey,
    fetchAdminGeminiKeyCloud,
    GeminiQuotaExceededError,
    type ActiveKeyInfo
} from './services/geminiApiKeyService';
import {
    saveEmployeeDataSession,
    findExistingEmployeeSession,
    checkSupabaseSessionTable,
    EMPLOYEE_DATA_SESSIONS_SQL,
    type EmployeeDataSession
} from '../employee-cumulative/utils/sessionStorage';
import {
    Camera,
    Sparkles,
    Calendar,
    Store,
    Users,
    Save,
    KeyRound,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    RefreshCw,
    Database,
    RotateCcw,
    Edit3,
    History,
    X,
    Copy,
    Check,
    Clock,
    Lock
} from 'lucide-react';

export default function EmployeeExtractOcrPage() {
    const navigate = useNavigate();
    const { isAdmin, currentUser } = useAuth();

    // 1. Cấu hình Ngày chốt phiên & Kỳ tháng/năm
    const [reportDate, setReportDate] = useState<string>(() => getYesterdayDateString());
    const [selectedMonth, setSelectedMonth] = useState<number>(() => {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        return y.getMonth() + 1;
    });
    const [selectedYear, setSelectedYear] = useState<number>(() => {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        return y.getFullYear();
    });

    // 2. ST & Danh mục nhân sự
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [selectedStore, setSelectedStore] = useState<string>('');
    const [systemEmployees, setSystemEmployees] = useState<EmployeeItem[]>([]);

    // Phân quyền phạm vi ST theo vai trò người dùng (Nhân viên bị khóa shop, Quản lý đa shop, Admin toàn quyền)
    const { allowedStores, isLockedToSingleStore } = useUserStoreFilter(
        stores,
        selectedStore,
        setSelectedStore
    );

    // Tự động khởi tạo ST đầu tiên được phân quyền nếu chưa chọn
    useEffect(() => {
        if (!selectedStore && allowedStores.length > 0) {
            setSelectedStore(allowedStores[0].name);
        }
    }, [allowedStores, selectedStore]);

    // 3. Tab chuyển đổi
    const [activeTab, setActiveTab] = useState<'ocr' | 'manual'>('ocr');

    // 4. File tải lên (Hỗ trợ tải nhiều ảnh cho Doanh thu QĐ, % Tỷ trọng trả góp, Giờ công và Thi đua)
    const [qdFiles, setQdFiles] = useState<File[]>([]);
    const [installmentFiles, setInstallmentFiles] = useState<File[]>([]);
    const [workHoursFiles, setWorkHoursFiles] = useState<File[]>([]);
    const [emulationFiles, setEmulationFiles] = useState<File[]>([]);

    // 5. Cấu hình Gemini Key
    const [keyInfo, setKeyInfo] = useState<ActiveKeyInfo>(() => resolveActiveGeminiKey());
    const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
    const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(false);

    // 6. Trạng thái quét OCR
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const [progressText, setProgressText] = useState<string>('');
    const [progressPercent, setProgressPercent] = useState<number>(0);
    const [ocrError, setOcrError] = useState<string>('');
    const [screenshotTimestamp, setScreenshotTimestamp] = useState<string>('');

    // 7. Dữ liệu nhân viên sau bóc tách / nhập tay
    const [employeesData, setEmployeesData] = useState<EmployeeOcrParsedItem[]>([]);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');

    // 8. Trạng thái kết nối Cloud & Kiểm tra trùng phiên
    const [cloudTableReady, setCloudTableReady] = useState<boolean>(true);
    const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
    const [isSqlCopied, setIsSqlCopied] = useState<boolean>(false);
    const [existingSession, setExistingSession] = useState<EmployeeDataSession | null>(null);
    const [existingWorkHoursSession, setExistingWorkHoursSession] = useState<EmployeeDataSession | null>(null);
    const [isCheckingDuplicate, setIsCheckingDuplicate] = useState<boolean>(false);

    // 9. Quét bổ sung ảnh thi đua
    const [isScanningAdditional, setIsScanningAdditional] = useState<boolean>(false);
    const [additionalProgressText, setAdditionalProgressText] = useState<string>('');

    // 10. Dữ liệu chỉ tiêu thi đua đã biết của ST để auto-mapping (...) và danh mục hệ thống
    const [knownStoreCampaigns, setKnownStoreCampaigns] = useState<KnownStoreCampaignTarget[]>([]);
    const [campaignDict, setCampaignDict] = useState<CampaignDictItem[]>([]);
    const [campaignMappings, setCampaignMappings] = useState<CampaignMappingItem[]>([]);

    // 11. Quản lý làm mới đợt nạp & theo dõi đổi ST / trạng thái đã lưu
    const [batchResetKey, setBatchResetKey] = useState<number>(0);
    const [hasSavedCurrentBatch, setHasSavedCurrentBatch] = useState<boolean>(false);
    const prevStoreRef = useRef<string>('');

    const hasWorkingData =
        qdFiles.length > 0 ||
        installmentFiles.length > 0 ||
        workHoursFiles.length > 0 ||
        emulationFiles.length > 0 ||
        employeesData.length > 0 ||
        Boolean(ocrError) ||
        campaignMappings.length > 0;

    const hasWorkingDataRef = useRef<boolean>(false);
    hasWorkingDataRef.current = hasWorkingData;

    // Người dùng thao tác
    const userDisplayName = useMemo(() => {
        if (currentUser?.full_name) {
            return currentUser.employee_id
                ? `${currentUser.full_name} (${currentUser.employee_id})`
                : currentUser.full_name;
        }
        return currentUser?.email || 'Quản lý';
    }, [currentUser]);

    // Khởi tạo dữ liệu
    useEffect(() => {
        fetchAdminGeminiKeyCloud().then(() => {
            setKeyInfo(resolveActiveGeminiKey());
        });

        fetchStores().then(res => {
            if (res.success && res.data && res.data.length > 0) {
                setStores(res.data);
            }
        });

        fetchEmployees().then(res => {
            if (res.success && res.data) {
                setSystemEmployees(res.data);
            }
        });

        fetchCampaignDictionary().then(res => {
            if (res.success && res.data) {
                setCampaignDict(res.data);
            }
        });

        checkSupabaseSessionTable().then(res => {
            setCloudTableReady(res.exists);
        });
    }, []);

    // Tự động tải chỉ tiêu thi đua đã biết của ST từ daily_business_records khi đổi ST hoặc ngày chốt
    useEffect(() => {
        if (!selectedStore) return;
        fetchStoreKnownCampaignTargets(selectedStore, reportDate, stores).then(targets => {
            setKnownStoreCampaigns(targets);
        });
    }, [selectedStore, reportDate, stores]);

    // Danh bạ nhân viên của ST đang chọn
    const storeEmployees = useMemo(() => {
        if (!selectedStore) return [];
        return systemEmployees.filter(emp => isStoreMatch(emp.store_name, selectedStore, stores));
    }, [systemEmployees, selectedStore, stores]);

    // Khi đổi ST, tự động tải danh bạ nhân sự mới nhất của ST đó từ Supabase
    useEffect(() => {
        if (!selectedStore) return;
        fetchEmployees(selectedStore).then(res => {
            if (res.success && res.data && res.data.length > 0) {
                setSystemEmployees(prev => {
                    const others = prev.filter(e => !isStoreMatch(e.store_name, selectedStore, stores));
                    return [...others, ...(res.data || [])];
                });
            }
        });
    }, [selectedStore, stores]);

    // Tự động kiểm tra xem đã tồn tại phiên dữ liệu (REVENUE_CAMPAIGN hoặc WORK_HOURS) cho ST & Ngày chốt này chưa
    useEffect(() => {
        if (!selectedStore || !reportDate) return;
        let isMounted = true;
        setExistingSession(null);
        setExistingWorkHoursSession(null);
        setIsCheckingDuplicate(true);

        Promise.all([
            findExistingEmployeeSession(selectedStore, reportDate, 'REVENUE_CAMPAIGN'),
            findExistingEmployeeSession(selectedStore, reportDate, 'WORK_HOURS')
        ])
            .then(([foundRev, foundHours]) => {
                if (isMounted) {
                    setExistingSession(foundRev);
                    setExistingWorkHoursSession(foundHours);
                    setIsCheckingDuplicate(false);
                }
            })
            .catch(err => {
                console.warn('Lỗi kiểm tra phiên trùng:', err);
                if (isMounted) setIsCheckingDuplicate(false);
            });

        return () => { isMounted = false; };
    }, [selectedStore, reportDate]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    // Xóa trắng toàn bộ ảnh & bảng số liệu hiện tại để chuẩn bị đợt nạp mới
    const resetWorkingBatch = () => {
        setQdFiles([]);
        setInstallmentFiles([]);
        setWorkHoursFiles([]);
        setEmulationFiles([]);
        setEmployeesData([]);
        setCampaignMappings([]);
        setScreenshotTimestamp('');
        setOcrError('');
        setProgressText('');
        setProgressPercent(0);
        setIsQuotaExceeded(false);
        setHasSavedCurrentBatch(false);
        setActiveTab('ocr');
        setBatchResetKey(prev => prev + 1);
    };

    // Tự động xóa trắng dữ liệu cũ khi chuyển sang ST khác
    useEffect(() => {
        if (!selectedStore) return;
        const prevStore = prevStoreRef.current;
        if (prevStore && prevStore !== selectedStore) {
            const hadData = hasWorkingDataRef.current;
            resetWorkingBatch();
            if (hadData) {
                showToast(`🧹 Đã chuyển sang ST ${getShortStoreName(selectedStore)} và tự động xóa trắng dữ liệu cũ!`);
            }
        }
        prevStoreRef.current = selectedStore;
    }, [selectedStore]);

    // Nút xóa trắng dữ liệu thủ công cho đợt nạp mới
    const handleManualResetBatch = () => {
        if (isExtracting || isSaving || isScanningAdditional) return;
        if (!hasWorkingData) {
            showToast('✨ Vùng nạp dữ liệu đang trống sẵn sàng cho đợt nạp mới.');
            return;
        }
        if (employeesData.length > 0 && !hasSavedCurrentBatch) {
            const confirmed = window.confirm(
                `Dữ liệu rà soát (${employeesData.length} NV) chưa được lưu lên Cloud. Bạn có chắc muốn xóa trắng ảnh và bảng số liệu để chuẩn bị đợt nạp mới?`
            );
            if (!confirmed) return;
        }
        resetWorkingBatch();
        showToast('🧹 Đã xóa trắng dữ liệu — sẵn sàng cho đợt nạp mới!');
    };

    // Xóa nhanh toàn bộ ảnh đã chọn ở Tab OCR
    const handleClearUploadedFiles = () => {
        if (isExtracting || isSaving || isScanningAdditional) return;
        setQdFiles([]);
        setInstallmentFiles([]);
        setWorkHoursFiles([]);
        setEmulationFiles([]);
        setOcrError('');
        setBatchResetKey(prev => prev + 1);
        showToast('🧹 Đã xóa toàn bộ ảnh đã chọn!');
    };

    const handleEmployeesChange = (items: EmployeeOcrParsedItem[]) => {
        setEmployeesData(items);
        setHasSavedCurrentBatch(false);
    };

    // Khi người dùng đổi Ngày chốt phiên
    const handleReportDateChange = (newDate: string) => {
        setReportDate(newDate);
        if (newDate) {
            const [yStr, mStr] = newDate.split('-');
            const y = parseInt(yStr, 10);
            const m = parseInt(mStr, 10);
            if (y && m) {
                setSelectedMonth(m);
                setSelectedYear(y);
            }
        }
    };

    // Chạy OCR trích xuất dữ liệu nhân viên
    const handleRunOcr = async () => {
        const activeKey = keyInfo.key;
        if (!activeKey) {
            setIsKeyModalOpen(true);
            return;
        }

        if (
            qdFiles.length === 0 &&
            installmentFiles.length === 0 &&
            workHoursFiles.length === 0 &&
            emulationFiles.length === 0
        ) {
            showToast('⚠️ Vui lòng chọn ít nhất 1 ảnh (Doanh thu QĐ, % Tỷ trọng trả góp, Giờ công hoặc Thi đua)!');
            return;
        }

        if (!selectedStore) {
            setOcrError('Vui lòng chọn ST trước khi quét nhận diện OCR!');
            return;
        }

        // Kiểm tra phân quyền ST
        const isStorePermitted = allowedStores.some(s => isStoreMatch(s.name, selectedStore, stores));
        if (!isAdmin && !isStorePermitted) {
            setOcrError(`Tài khoản của bạn không có quyền cập nhật dữ liệu cho ST [${getShortStoreName(selectedStore)}]!`);
            return;
        }

        setIsExtracting(true);
        setOcrError('');
        setProgressText('Đang kết nối Gemini Vision...');
        setProgressPercent(10);

        try {
            const result = await extractAndMergeEmployeeImages(
                activeKey,
                { qdFiles, installmentFiles, workHoursFiles, emulationFiles },
                storeEmployees.length > 0 ? storeEmployees : systemEmployees,
                (msg, pct) => {
                    setProgressText(msg);
                    setProgressPercent(pct);
                },
                keyInfo.source,
                {
                    knownTargets: knownStoreCampaigns,
                    campaignDict: campaignDict
                }
            );

            if (!result.success || result.employees.length === 0) {
                setOcrError(result.errors?.join('; ') || 'Không thể trích xuất số liệu nhân viên từ ảnh đã chọn.');
                setIsExtracting(false);
                return;
            }

            if (result.screenshotTimestamp) {
                setScreenshotTimestamp(result.screenshotTimestamp);
            }

            if (result.campaignMappings && result.campaignMappings.length > 0) {
                setCampaignMappings(result.campaignMappings);
            }

            // CHỈ NHẬP SỐ LIỆU CỦA NHÂN SỰ CÓ TRONG DANH BẠ SIÊU THỊ
            if (storeEmployees.length === 0) {
                setOcrError(`ST [${getShortStoreName(selectedStore)}] chưa có nhân sự nào trong danh bạ hệ thống. Vui lòng cập nhật danh bạ ST trước khi nhập số liệu!`);
                setIsExtracting(false);
                return;
            }

            const storeEmpIdSet = new Set(
                storeEmployees.map(e => String(e.employee_id || '').trim().toLowerCase())
            );
            const storeEmpMap = new Map(
                storeEmployees.map(e => [String(e.employee_id || '').trim().toLowerCase(), e.full_name?.trim() || ''])
            );

            const unmappedEmployees: EmployeeOcrParsedItem[] = [];
            const matchedEmployees: EmployeeOcrParsedItem[] = [];
            let excludedCount = 0;

            result.employees.forEach(emp => {
                const rawId = String(emp.employeeId || '').trim();
                const cleanId = rawId.toLowerCase();
                const isUnmapped = Boolean(emp.isUnmappedName) || rawId.startsWith('UNMAPPED::');

                if (isUnmapped) {
                    unmappedEmployees.push({
                        ...emp,
                        isUnmappedName: true,
                        mappingSource: 'UNMAPPED'
                    });
                } else if (storeEmpIdSet.has(cleanId)) {
                    const officialName = storeEmpMap.get(cleanId);
                    matchedEmployees.push({
                        ...emp,
                        fullName: officialName || emp.fullName
                    });
                } else {
                    excludedCount++;
                }
            });

            const combinedEmployees = [...unmappedEmployees, ...matchedEmployees];
            const nameMatchedCount = matchedEmployees.filter(
                e => e.mappingSource === 'NAME_EXACT' || e.mappingSource === 'NAME_FUZZY'
            ).length;

            if (combinedEmployees.length === 0) {
                setOcrError(`Đã quét nhận diện được ${result.employees.length} dòng nhân sự nhưng KHÔNG có nhân sự nào thuộc danh bạ của ST [${getShortStoreName(selectedStore)}]. Vui lòng kiểm tra lại ảnh chụp đúng ST hoặc cập nhật danh bạ ST!`);
                setIsExtracting(false);
                return;
            }

            const { mergedItems: finalMergedEmployees, hydratedFromExisting } = mergeOcrItemsWithExistingSessions(
                combinedEmployees,
                existingSession,
                existingWorkHoursSession,
                {
                    hasQd: qdFiles.length > 0,
                    hasInstallment: installmentFiles.length > 0,
                    hasEmulation: emulationFiles.length > 0,
                    hasWorkHours: workHoursFiles.length > 0
                },
                storeEmployees
            );

            setEmployeesData(finalMergedEmployees);
            setHasSavedCurrentBatch(false);
            setIsQuotaExceeded(false);
            setProgressPercent(100);
            setProgressText(`Trích xuất thành công! Đã nạp ${finalMergedEmployees.length} dòng để rà soát...`);
            const mergeSuffix = hydratedFromExisting ? ' (đã ghép giữ nguyên số liệu phiên đang có)' : '';
            if (unmappedEmployees.length > 0) {
                showToast(
                    `⚠️ Đã nạp ${finalMergedEmployees.length} dòng (${unmappedEmployees.length} dòng từ ảnh không có Mã NV cần rà soát & chọn Mã NV trong bảng)${mergeSuffix}!`
                );
            } else if (excludedCount > 0) {
                showToast(
                    `✅ Đã nhập ${finalMergedEmployees.length} nhân viên theo danh bạ ST (loại bỏ ${excludedCount} nhân sự/dòng ngoài danh bạ)${mergeSuffix}!`
                );
            } else if (nameMatchedCount > 0) {
                showToast(
                    `✅ Đã nhập ${finalMergedEmployees.length} nhân viên (${nameMatchedCount} dòng khớp tự động theo tên — vui lòng kiểm tra lại)${mergeSuffix}!`
                );
            } else {
                showToast(`✅ Đã nhập thành công ${finalMergedEmployees.length} nhân viên thuộc danh bạ ST${mergeSuffix}!`);
            }

            setTimeout(() => {
                setIsExtracting(false);
                setActiveTab('manual');
            }, 800);
        } catch (err: any) {
            console.error('Lỗi khi chạy OCR nhân viên:', err);
            setIsExtracting(false);

            if (err instanceof GeminiQuotaExceededError) {
                setIsQuotaExceeded(true);
                setIsKeyModalOpen(true);
                setOcrError('Hạn mức API Key hệ thống đã hết. Vui lòng cấu hình API Key cá nhân để tiếp tục.');
            } else {
                setOcrError(err?.message || 'Có lỗi xảy ra trong quá trình nhận diện hình ảnh.');
            }
        }
    };

    // Lưu phiên nhân viên lên Supabase Cloud (Hỗ trợ ghi đè phiên cũ hoặc tạo phiên mới)
    const handleSaveToCloud = async (options?: { overwriteSessionId?: string }) => {
        if (!selectedStore) {
            showToast('⚠️ Vui lòng chọn ST trước khi lưu phiên!');
            return;
        }

        // Kiểm tra phân quyền ST
        const isStorePermitted = allowedStores.some(s => isStoreMatch(s.name, selectedStore, stores));
        if (!isAdmin && !isStorePermitted) {
            showToast(`⛔ Bạn không có quyền lưu dữ liệu cho ST [${getShortStoreName(selectedStore)}]!`);
            return;
        }

        if (employeesData.length === 0) {
            showToast('⚠️ Chưa có dữ liệu nhân viên để lưu!');
            return;
        }

        const unmappedRows = employeesData.filter(
            e => Boolean(e.isUnmappedName) || String(e.employeeId || '').trim().startsWith('UNMAPPED::')
        );
        if (unmappedRows.length > 0) {
            showToast(`⚠️ Còn ${unmappedRows.length} dòng chưa được gán Mã NV chính thức! Vui lòng chọn Mã NV từ danh bạ hoặc xóa dòng thừa trước khi lưu Cloud.`);
            return;
        }

        // Đảm bảo chỉ lưu nhân sự có trong danh bạ ST
        let validEmployees = employeesData;
        if (storeEmployees.length > 0) {
            const storeEmpIdSet = new Set(
                storeEmployees.map(e => String(e.employee_id || '').trim().toLowerCase())
            );
            validEmployees = employeesData.filter(e => storeEmpIdSet.has(String(e.employeeId || '').trim().toLowerCase()));
            if (validEmployees.length === 0) {
                showToast(`⚠️ Không có nhân viên nào thuộc danh bạ của ST ${getShortStoreName(selectedStore)} để lưu!`);
                return;
            }
        }

        setIsSaving(true);
        try {
            const storeShortName = getShortStoreName(selectedStore);
            const totalQd = validEmployees.reduce((s, e) => s + (Number(e.revenueQd) || 0), 0);
            const totalHours = Number(
                validEmployees.reduce((s, e) => s + (Number(e.workHours) || 0), 0).toFixed(1)
            );
            const hasAnyRevOrCamp = validEmployees.some(
                e =>
                    (Number(e.revenueQd) || 0) !== 0 ||
                    (Number(e.installmentQd) || 0) !== 0 ||
                    (Number(e.installmentRate) || 0) > 0 ||
                    Object.keys(e.campaigns || {}).length > 0
            );
            const isHoursOnlySession = !existingSession && !hasAnyRevOrCamp && totalHours > 0;

            const sessionRecords = convertOcrItemsToSessionRecords(validEmployees, selectedStore);

            const sessionPayload = {
                session_type: isHoursOnlySession ? ('WORK_HOURS' as const) : ('REVENUE_CAMPAIGN' as const),
                session_title: isHoursOnlySession
                    ? `Phiên Giờ Công NV - ${storeShortName} - Ngày ${formatDate(reportDate)}`
                    : `Phiên Doanh Thu & Thi Đua NV - ${storeShortName} - Ngày ${formatDate(reportDate)}`,
                store_name: selectedStore,
                month: selectedMonth,
                year: selectedYear,
                report_date: reportDate,
                created_by: userDisplayName,
                employee_count: sessionRecords.length,
                total_revenue_actual: 0,
                total_revenue_qd: isHoursOnlySession ? 0 : totalQd,
                total_work_hours: totalHours,
                source_type: 'OCR_IMAGE' as any,
                records: sessionRecords,
                note: `Nạp tự động qua OCR lúc ${new Date().toLocaleTimeString('vi-VN')} - Ảnh chụp: ${screenshotTimestamp || 'N/A'}`
            };

            const isOverwrite = Boolean(options?.overwriteSessionId);
            const res = await saveEmployeeDataSession(sessionPayload, options);

            if (!res.success) {
                showToast(`⚠️ Không thể lưu phiên: ${res.error}`);
                setIsSaving(false);
                return;
            }

            if (isHoursOnlySession) {
                setExistingWorkHoursSession(res.session);
            } else {
                setExistingSession(res.session);
            }
            setHasSavedCurrentBatch(true);
            showToast(isOverwrite
                ? `🔄 Đã ghi đè & cập nhật thành công phiên ${sessionRecords.length} nhân viên danh bạ ST!`
                : `🎉 Đã lưu thành công phiên mới ${sessionRecords.length} nhân viên danh bạ ST lên Cloud!`
            );
            setIsSaving(false);
        } catch (err: any) {
            console.error('Lỗi khi lưu phiên nhân viên:', err);
            showToast(`⚠️ Lỗi khi lưu: ${err?.message || 'Không thể kết nối'}`);
            setIsSaving(false);
        }
    };

    // Nạp lại dữ liệu từ phiên đã có vào bảng rà soát (hỗ trợ cả REVENUE_CAMPAIGN lẫn WORK_HOURS)
    const handleRestoreExistingSession = (targetSession?: EmployeeDataSession) => {
        const sessToRestore = targetSession || existingSession || existingWorkHoursSession;
        if (!sessToRestore || !sessToRestore.records || sessToRestore.records.length === 0) {
            showToast('⚠️ Phiên này không có bản ghi nhân viên nào!');
            return;
        }
        let records = sessToRestore.records;
        if (storeEmployees.length > 0) {
            const storeEmpIdSet = new Set(
                storeEmployees.map(e => String(e.employee_id || '').trim().toLowerCase())
            );
            records = records.filter(r => storeEmpIdSet.has(String(r.employee_id || '').trim().toLowerCase()));
        }
        const hoursById = new Map<string, number>();
        if (sessToRestore.session_type !== 'WORK_HOURS' && existingWorkHoursSession?.records) {
            existingWorkHoursSession.records.forEach(hr => {
                const k = String(hr.employee_id || '').trim().toLowerCase();
                if (k && (hr.work_hours || 0) > 0) hoursById.set(k, Number(hr.work_hours) || 0);
            });
        }
        const items = convertSessionRecordsToOcrItems(records);
        // Đảm bảo các chỉ tiêu số lượng (SL) được làm tròn chuẩn số nguyên (ví dụ 47,8 -> 48)
        const normalizedItems = items.map(emp => {
            const campaigns = { ...emp.campaigns };
            const details = (emp.campaignDetails || []).map(d => {
                const isQty = isQuantityCampaign(d.unit, d.campaignName, knownStoreCampaigns, campaignDict);
                const val = isQty ? Math.round(d.value) : d.value;
                if (isQty) {
                    campaigns[d.campaignName] = val;
                }
                return {
                    ...d,
                    value: val,
                    unit: isQty ? 'SL' : d.unit
                };
            });
            Object.entries(campaigns).forEach(([cName, cVal]) => {
                if (isQuantityCampaign(undefined, cName, knownStoreCampaigns, campaignDict)) {
                    campaigns[cName] = Math.round(cVal);
                }
            });
            const empKey = String(emp.employeeId || '').trim().toLowerCase();
            const workHours = (emp.workHours || 0) > 0 ? emp.workHours : (hoursById.get(empKey) || 0);
            return { ...emp, workHours, campaigns, campaignDetails: details };
        });
        setEmployeesData(normalizedItems);
        setHasSavedCurrentBatch(true);
        setActiveTab('manual');
        showToast(`📥 Đã nạp thành công ${normalizedItems.length} nhân viên thuộc danh bạ ST từ phiên ngày ${formatDate(reportDate)}!`);
    };

    // Quét bổ sung các ảnh thi đua mới và chèn thêm vào danh sách nhân viên hiện tại
    const handleScanAdditionalEmulation = async (additionalFiles: File[]) => {
        const activeKey = keyInfo.key;
        if (!activeKey) {
            setIsKeyModalOpen(true);
            return;
        }

        if (additionalFiles.length === 0) return;

        setIsScanningAdditional(true);
        setAdditionalProgressText('Đang nén các ảnh thi đua bổ sung...');

        try {
            const result = await extractAdditionalEmulationImages(
                activeKey,
                additionalFiles,
                employeesData,
                storeEmployees.length > 0 ? storeEmployees : systemEmployees,
                (msg) => setAdditionalProgressText(msg),
                keyInfo.source,
                {
                    knownTargets: knownStoreCampaigns,
                    campaignDict: campaignDict
                }
            );

            if (result.screenshotTimestamp) {
                setScreenshotTimestamp(result.screenshotTimestamp);
            }

            if (result.success && result.employees.length > 0) {
                // Giữ nhân sự trong danh bạ ST + giữ lại các dòng chưa khớp Mã NV để user rà soát chọn lại
                const storeEmpIdSet = new Set(
                    storeEmployees.map(e => String(e.employee_id || '').trim().toLowerCase())
                );
                const storeEmpNameMap = new Map(
                    storeEmployees.map(e => [String(e.employee_id || '').trim().toLowerCase(), e.full_name?.trim() || ''])
                );

                const unmappedRows: EmployeeOcrParsedItem[] = [];
                const validRows: EmployeeOcrParsedItem[] = [];

                result.employees.forEach(e => {
                    const rawId = String(e.employeeId || '').trim();
                    const cleanId = rawId.toLowerCase();
                    if (e.isUnmappedName || rawId.startsWith('UNMAPPED::')) {
                        unmappedRows.push({
                            ...e,
                            isUnmappedName: true,
                            mappingSource: 'UNMAPPED'
                        });
                    } else if (storeEmployees.length === 0 || storeEmpIdSet.has(cleanId)) {
                        validRows.push({
                            ...e,
                            fullName: storeEmpNameMap.get(cleanId) || e.fullName
                        });
                    }
                });

                const filteredEmps = [...unmappedRows, ...validRows];
                setEmployeesData(filteredEmps);
                setHasSavedCurrentBatch(false);

                if (result.campaignMappings && result.campaignMappings.length > 0) {
                    setCampaignMappings(prev => {
                        const map = new Map(prev.map(m => [m.resolvedName, m]));
                        result.campaignMappings?.forEach(m => map.set(m.resolvedName, m));
                        return Array.from(map.values());
                    });
                }

                if (unmappedRows.length > 0) {
                    showToast(`⚠️ Đã quét ${additionalFiles.length} ảnh thi đua, còn ${unmappedRows.length} dòng chưa khớp Mã NV cần chọn lại trong bảng!`);
                } else {
                    showToast(`🎉 Đã quét & bổ sung thành công ${additionalFiles.length} ảnh thi đua cho nhân sự ST!`);
                }
            } else {
                showToast('⚠️ Không trích xuất được thêm số liệu từ các ảnh đã chọn.');
            }
        } catch (err: any) {
            console.error('Lỗi khi quét thi đua bổ sung:', err);
            if (err instanceof GeminiQuotaExceededError) {
                setIsQuotaExceeded(true);
                setIsKeyModalOpen(true);
            } else {
                showToast(`⚠️ Lỗi: ${err?.message || 'Không thể quét ảnh bổ sung'}`);
            }
        } finally {
            setIsScanningAdditional(false);
            setAdditionalProgressText('');
        }
    };

    // Quét bổ sung ảnh giờ công và cập nhật vào bảng nhân viên hiện tại
    const handleScanAdditionalWorkHours = async (additionalFiles: File[]) => {
        const activeKey = keyInfo.key;
        if (!activeKey) {
            setIsKeyModalOpen(true);
            return;
        }
        if (additionalFiles.length === 0) return;

        setIsScanningAdditional(true);
        setAdditionalProgressText('Đang nén ảnh giờ công bổ sung...');

        try {
            const result = await extractAdditionalWorkHoursImages(
                activeKey,
                additionalFiles,
                employeesData,
                storeEmployees.length > 0 ? storeEmployees : systemEmployees,
                (msg) => setAdditionalProgressText(msg),
                keyInfo.source
            );

            if (result.screenshotTimestamp) {
                setScreenshotTimestamp(result.screenshotTimestamp);
            }

            if (result.success && result.employees.length > 0) {
                const storeEmpIdSet = new Set(
                    storeEmployees.map(e => String(e.employee_id || '').trim().toLowerCase())
                );
                const storeEmpNameMap = new Map(
                    storeEmployees.map(e => [String(e.employee_id || '').trim().toLowerCase(), e.full_name?.trim() || ''])
                );

                const unmappedRows: EmployeeOcrParsedItem[] = [];
                const validRows: EmployeeOcrParsedItem[] = [];

                result.employees.forEach(e => {
                    const rawId = String(e.employeeId || '').trim();
                    const cleanId = rawId.toLowerCase();
                    if (e.isUnmappedName || rawId.startsWith('UNMAPPED::')) {
                        unmappedRows.push({
                            ...e,
                            isUnmappedName: true,
                            mappingSource: 'UNMAPPED'
                        });
                    } else if (storeEmployees.length === 0 || storeEmpIdSet.has(cleanId)) {
                        validRows.push({
                            ...e,
                            fullName: storeEmpNameMap.get(cleanId) || e.fullName
                        });
                    }
                });

                setEmployeesData([...unmappedRows, ...validRows]);
                setHasSavedCurrentBatch(false);
                showToast(`✅ Đã quét & cập nhật giờ công từ ${additionalFiles.length} ảnh cho nhân sự ST!`);
            } else {
                showToast('⚠️ Không trích xuất được số liệu giờ công từ các ảnh đã chọn.');
            }
        } catch (err: any) {
            console.error('Lỗi khi quét giờ công bổ sung:', err);
            if (err instanceof GeminiQuotaExceededError) {
                setIsQuotaExceeded(true);
                setIsKeyModalOpen(true);
            } else {
                showToast(`⚠️ Lỗi: ${err?.message || 'Không thể quét ảnh giờ công'}`);
            }
        } finally {
            setIsScanningAdditional(false);
            setAdditionalProgressText('');
        }
    };

    // Đổi tên chương trình thi đua đã mapping cho toàn bộ nhân viên
    const handleRemapCampaign = (oldName: string, newName: string) => {
        if (!oldName || !newName || oldName === newName) return;

        const isNewQuantity = isQuantityCampaign(undefined, newName, knownStoreCampaigns, campaignDict);

        setEmployeesData(prev => prev.map(emp => {
            const campaigns = { ...emp.campaigns };
            if (campaigns[oldName] !== undefined) {
                const oldVal = campaigns[oldName];
                campaigns[newName] = isNewQuantity ? Math.round(oldVal) : oldVal;
                delete campaigns[oldName];
            }
            const campaignDetails = (emp.campaignDetails || []).map(d =>
                d.campaignName === oldName
                    ? {
                        ...d,
                        campaignName: newName,
                        value: isNewQuantity ? Math.round(d.value) : d.value,
                        unit: isNewQuantity ? 'SL' : d.unit,
                        isAutoMatched: false,
                        mappedReason: 'Quản lý chọn thủ công'
                    }
                    : d
            );
            return { ...emp, campaigns, campaignDetails };
        }));

        setCampaignMappings(prev => prev.map(m =>
            m.resolvedName === oldName
                ? {
                    ...m,
                    resolvedName: newName,
                    unit: isNewQuantity ? 'SL' : m.unit,
                    isAutoMatched: false,
                    mappedReason: 'Quản lý tùy chỉnh thủ công'
                }
                : m
        ));

        showToast(`🔄 Đã đổi tên chỉ tiêu [${oldName}] thành [${newName}] cho toàn bộ nhân viên!`);
    };

    const hasAnyRevOrCampInTable = useMemo(
        () =>
            employeesData.some(
                e =>
                    (Number(e.revenueQd) || 0) !== 0 ||
                    (Number(e.installmentQd) || 0) !== 0 ||
                    (Number(e.installmentRate) || 0) > 0 ||
                    Object.keys(e.campaigns || {}).length > 0
            ),
        [employeesData]
    );
    const activeExistingSession = existingSession || (!hasAnyRevOrCampInTable ? existingWorkHoursSession : null);

    const handleCopySql = () => {
        navigator.clipboard.writeText(EMPLOYEE_DATA_SESSIONS_SQL);
        setIsSqlCopied(true);
        setTimeout(() => setIsSqlCopied(false), 2000);
    };

    return (
        <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-4">
            {/* Toast popup */}
            {toastMessage && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {toastMessage}
                </div>
            )}

            {/* BANNER BÁO CÁO TRẠNG THÁI CLOUD (QUY CHUẨN 8) */}
            <div data-html2canvas-ignore="true" data-export-ignore="true">
                <CloudDataSyncStatusBanner
                    storageType="cloud"
                    syncStatus={isSaving ? 'syncing' : 'synced'}
                    tableReady={cloudTableReady}
                    tableName="employee_data_sessions"
                    customMessage="Cơ sở dữ liệu Phiên Nhân Viên Supabase Cloud (Dùng chung toàn bộ báo cáo nhân sự)"
                    compact={true}
                />
            </div>

            {/* HEADER CÔNG CỤ */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-xs shrink-0">
                        <Camera className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                                Cập Nhật Dữ Liệu Nhân Viên Bằng OCR
                            </h1>
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                Vision AI
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Trích xuất số liệu nhân viên từ ảnh chụp BI (DTQĐ, DT Trả góp QĐ, % Tỷ trọng trả góp, Thi đua, Giờ công) • Lưu phiên lũy kế liên tiếp
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                    {isAdmin && !cloudTableReady && (
                        <button
                            type="button"
                            onClick={() => setShowSqlModal(true)}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                            <Database className="w-3.5 h-3.5" />
                            <span>Mã SQL Bảng</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleManualResetBatch}
                        disabled={!hasWorkingData || isExtracting || isSaving || isScanningAdditional}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
                            hasWorkingData && !isExtracting && !isSaving && !isScanningAdditional
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200 cursor-pointer shadow-2xs'
                                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-75'
                        }`}
                        title="Xóa trắng toàn bộ ảnh đã tải & bảng số liệu hiện tại để chuẩn bị đợt nạp mới"
                    >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Xóa trắng</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate('/quan-ly-phien-nhan-vien')}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
                    >
                        <History className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                        <span>Xem Phiên Đã Lưu</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsKeyModalOpen(true)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer border border-slate-200"
                        title="Cài đặt Gemini API Key"
                    >
                        <KeyRound className="w-4 h-4 text-amber-600" />
                    </button>
                </div>
            </div>

            {/* THANH ĐIỀU KHIỂN & BỘ LỌC (QUY CHUẨN 10: ST HÀNG ĐẦU TIÊN) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-3">
                {/* Dòng 1: Chọn ST Riêng Biệt (Đã phân quyền theo tài khoản) */}
                <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1 flex items-center justify-between gap-1 flex-wrap">
                        <span className="flex items-center gap-1">
                            {isLockedToSingleStore ? (
                                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            ) : (
                                <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            )}
                            <span>Đơn Vị / ST Áp Dụng</span>
                            {isLockedToSingleStore && (
                                <span className="text-[10px] bg-amber-200/80 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ml-1">
                                    {currentUser?.is_guest ? 'Trải nghiệm' : 'Đã khóa theo tài khoản'}
                                </span>
                            )}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 normal-case">
                            ({storeEmployees.length} nhân sự trong danh bạ ST)
                        </span>
                    </label>
                    <select
                        value={selectedStore}
                        onChange={(e) => setSelectedStore(e.target.value)}
                        disabled={isLockedToSingleStore || isExtracting || isSaving || isScanningAdditional}
                        className={`w-full bg-white border border-slate-300 text-slate-800 py-2 px-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-xs ${
                            isLockedToSingleStore || isExtracting || isSaving || isScanningAdditional
                                ? 'cursor-not-allowed bg-slate-100 text-slate-600'
                                : 'cursor-pointer'
                        }`}
                    >
                        {allowedStores.map(s => (
                            <option key={s.id || s.code} value={s.name}>
                                🏪 {s.name} {s.code ? `(${s.code})` : ''}
                            </option>
                        ))}
                    </select>

                    {allowedStores.length === 0 && (
                        <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>Tài khoản của bạn chưa được phân quyền phụ trách ST nào. Vui lòng liên hệ Admin để được cấp quyền!</span>
                        </div>
                    )}

                    {storeEmployees.length === 0 && allowedStores.length > 0 && (
                        <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>ST <strong>{getShortStoreName(selectedStore)}</strong> chưa có nhân sự nào trong danh bạ hệ thống.</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/cau-hinh-sieu-thi-nhan-vien')}
                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shrink-0 transition cursor-pointer"
                            >
                                Cập nhật danh bạ ST
                            </button>
                        </div>
                    )}
                </div>

                {/* Dòng 2: Ngày chốt phiên & Kỳ tháng */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 border-t border-slate-200">
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-amber-600" />
                            <span>Ngày Chốt Phiên (Mặc định N-1)</span>
                        </label>
                        <input
                            type="date"
                            value={reportDate}
                            onChange={(e) => handleReportDateChange(e.target.value)}
                            className="w-full bg-white border border-slate-300 text-slate-800 py-1.5 px-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Kỳ Tháng
                        </label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="w-full bg-white border border-slate-300 text-slate-800 py-1.5 px-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Kỳ Năm
                        </label>
                        <input
                            type="number"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="w-full bg-white border border-slate-300 text-slate-800 py-1.5 px-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                        />
                    </div>
                </div>

                {/* Dòng 3: Báo cáo trạng thái phiên dữ liệu trên Cloud của ngày này */}
                <div className="pt-2 border-t border-slate-200">
                    {isCheckingDuplicate ? (
                        <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                            <span>Đang kiểm tra phiên trùng lặp trên Cloud...</span>
                        </div>
                    ) : existingSession ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                <div>
                                    <span className="font-bold text-amber-900 tabular-nums">
                                        Đã có phiên ngày {formatDate(reportDate)} ({existingSession.employee_count} NV • DTQĐ: {formatValue(existingSession.total_revenue_qd)} tr
                                        {(existingSession.total_work_hours || 0) > 0
                                            ? ` • Giờ công: ${Number(existingSession.total_work_hours.toFixed(1)).toLocaleString('vi-VN')} h`
                                            : ''}
                                        )
                                    </span>
                                    <span className="text-[11px] text-amber-700 block">
                                        Nạp bởi: {existingSession.created_by} lúc {formatDateTime(existingSession.created_at)}
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleRestoreExistingSession(existingSession)}
                                className="px-3 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
                            >
                                <RotateCcw className="w-3 h-3 text-amber-600" />
                                <span>Xem Lại Phiên Đang Có</span>
                            </button>
                        </div>
                    ) : existingWorkHoursSession ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-xs">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-teal-700 shrink-0" />
                                <div>
                                    <span className="font-bold text-teal-950 tabular-nums">
                                        Đã có phiên Giờ Công ngày {formatDate(reportDate)} ({existingWorkHoursSession.employee_count} NV • {Number((existingWorkHoursSession.total_work_hours || 0).toFixed(1)).toLocaleString('vi-VN')} h)
                                    </span>
                                    <span className="text-[11px] text-teal-800 block">
                                        Nạp bởi: {existingWorkHoursSession.created_by} lúc {formatDateTime(existingWorkHoursSession.created_at)} • Chưa có phiên DTQĐ/Thi đua
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleRestoreExistingSession(existingWorkHoursSession)}
                                className="px-3 py-1 bg-white hover:bg-teal-100 text-teal-900 border border-teal-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
                            >
                                <RotateCcw className="w-3 h-3 text-teal-700" />
                                <span>Xem Lại Phiên Giờ Công</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 border border-rose-300 text-xs shadow-2xs">
                            <div className="flex items-center gap-2.5">
                                <span className="p-1.5 rounded-xl bg-rose-600 text-white font-black shadow-xs shrink-0 animate-pulse">
                                    <AlertCircle className="w-4 h-4" />
                                </span>
                                <div>
                                    <span className="font-extrabold text-rose-950 text-xs sm:text-sm block">
                                        Chưa có phiên dữ liệu mới nhất cho ngày {formatDate(reportDate)} tại {getShortStoreName(selectedStore)}
                                    </span>
                                    <span className="text-[11px] text-rose-800 font-medium block mt-0.5">
                                        Chưa có số liệu mới nhất được cập nhật lên hệ thống • Vui lòng tải ảnh OCR hoặc nạp số liệu để tạo phiên.
                                    </span>
                                </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-200/90 text-rose-950 border border-rose-300 self-start sm:self-auto shrink-0 flex items-center gap-1 shadow-2xs">
                                <span>🚨</span>
                                <span>Chưa có phiên</span>
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* TAB CHUYỂN ĐỔI BƯỚC LÀM VIỆC */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-inner">
                <button
                    type="button"
                    onClick={() => setActiveTab('ocr')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        activeTab === 'ocr'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Camera className="w-3.5 h-3.5" />
                    <span>1. Tải Ảnh OCR Tự Động</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('manual')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        activeTab === 'manual'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>2. Rà Soát & Nhập Trực Quan ({employeesData.length} NV)</span>
                </button>
            </div>

            {/* Lỗi trích xuất nếu có */}
            {ocrError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <strong className="block font-bold">Lỗi trích xuất ảnh:</strong>
                        <span>{ocrError}</span>
                    </div>
                </div>
            )}

            {/* NỘI DUNG THEO TAB */}
            {activeTab === 'ocr' ? (
                <div className="space-y-4">
                    <OcrUploadZone
                        key={`ocr-${selectedStore}-${batchResetKey}`}
                        mode="EMPLOYEE"
                        qdFiles={qdFiles}
                        onQdFilesChange={setQdFiles}
                        installmentFiles={installmentFiles}
                        onInstallmentFilesChange={setInstallmentFiles}
                        workHoursFiles={workHoursFiles}
                        onWorkHoursFilesChange={setWorkHoursFiles}
                        emulationFiles={emulationFiles}
                        onEmulationFilesChange={setEmulationFiles}
                        hasGeminiKey={Boolean(keyInfo.key)}
                        keySource={keyInfo.source}
                        isQuotaExceeded={isQuotaExceeded}
                        onOpenKeyModal={() => setIsKeyModalOpen(true)}
                        onRunOcr={handleRunOcr}
                        onClearAllFiles={handleClearUploadedFiles}
                        isExtracting={isExtracting}
                        progressText={progressText}
                        progressPercent={progressPercent}
                    />
                </div>
            ) : (
                <EmployeeManualDataEntryModule
                    key={`manual-${selectedStore}-${batchResetKey}`}
                    employees={employeesData}
                    onChangeEmployees={handleEmployeesChange}
                    storeName={selectedStore}
                    reportDate={reportDate}
                    onSaveToSupabase={handleSaveToCloud}
                    isSaving={isSaving}
                    existingSession={activeExistingSession}
                    isCheckingExisting={isCheckingDuplicate}
                    onRestoreExistingSession={() => handleRestoreExistingSession(activeExistingSession || undefined)}
                    onScanAdditionalEmulation={handleScanAdditionalEmulation}
                    onScanAdditionalWorkHours={handleScanAdditionalWorkHours}
                    isScanningAdditional={isScanningAdditional}
                    additionalProgressText={additionalProgressText}
                    storeEmployees={storeEmployees}
                    campaignMappings={campaignMappings}
                    knownStoreCampaigns={knownStoreCampaigns}
                    campaignDict={campaignDict}
                    onRemapCampaign={handleRemapCampaign}
                    onResetBatch={handleManualResetBatch}
                    hasSavedSession={hasSavedCurrentBatch}
                />
            )}

            {/* MODAL MÃ SQL SUPABASE DÀNH RIÊNG CHO ADMIN (QUY CHUẨN 12) */}
            {showSqlModal && isAdmin && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl text-slate-100">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <Database className="w-5 h-5 text-amber-400" />
                                <h3 className="font-extrabold text-sm sm:text-base text-white">
                                    Mã SQL Bảng Phiên Nhân Viên
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowSqlModal(false)}
                                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed">
                            Chạy câu lệnh SQL này trong <strong>Supabase SQL Editor</strong> để khởi tạo bảng <code>employee_data_sessions</code>.
                        </p>

                        <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto max-h-60 leading-relaxed">
                            {EMPLOYEE_DATA_SESSIONS_SQL}
                        </pre>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                            <button
                                onClick={() => setShowSqlModal(false)}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                            >
                                Đóng
                            </button>
                            <button
                                onClick={handleCopySql}
                                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition cursor-pointer"
                            >
                                {isSqlCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{isSqlCopied ? 'Đã sao chép' : 'Sao chép SQL'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CÀI ĐẶT GEMINI KEY */}
            <GeminiApiKeyModal
                isOpen={isKeyModalOpen}
                onClose={() => setIsKeyModalOpen(false)}
                isAdmin={isAdmin}
                onKeySaved={(source) => {
                    setKeyInfo(resolveActiveGeminiKey());
                    setIsQuotaExceeded(false);
                    showToast(`✅ Đã lưu cấu hình API Key (${source === 'ADMIN' ? 'Hệ Thống' : 'Cá Nhân'})!`);
                }}
            />
        </div>
    );
}
