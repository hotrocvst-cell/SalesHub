import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    Sparkles,
    AlertCircle,
    Save,
    Store,
    KeyRound,
    Users,
    Zap
} from 'lucide-react';
import type { StoreItem, EmployeeItem } from '../../../core/lib/storage';
import {
    getShortStoreName,
    formatStoreDisplayName,
    isStoreMatch,
    deduplicateStoreNames,
    getTodayDateString,
    cleanBiNumber,
    formatDate
} from '../../../core/lib/formatters';
import { useAuth } from '../../../shared/contexts/AuthContext';
import type { ParsedEmployeeRevenue } from '../../employee-cumulative/utils/employeeParsers';
import {
    extractDailyEmployeeRevenueImagesBatch,
    type DailyEmployeeOcrRecord
} from '../services/geminiDailyEmployeeOcrService';
import {
    resolveActiveGeminiKey,
    fetchAdminGeminiKeyCloud,
    GeminiQuotaExceededError,
    type ActiveKeyInfo
} from '../../data-update/services/geminiApiKeyService';
import GeminiApiKeyModal from '../../data-update/components/GeminiApiKeyModal';
import {
    saveDailyEmployeeSession,
    saveClusterDailyEmployeeSessions,
    type DailyEmployeeRevenueSessionRecord
} from '../services/dailyEmployeeRevenueSessionService';
import DailyOcrPreviewTable from './DailyOcrPreviewTable';
import DailyOcrUploadSection from './DailyOcrUploadSection';

function isSupportedImageFile(file: File): boolean {
    if (file.type && file.type.startsWith('image/')) return true;
    if (!file.type || file.type === 'application/octet-stream') {
        return !file.name || /\.(png|jpe?g|webp|gif|bmp|heic|heif|avif|tiff?)$/i.test(file.name);
    }
    return false;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    availableStores: StoreItem[];
    employeesDirectory: EmployeeItem[];
    defaultSelectedStore?: string;
    defaultReportDate?: string;
    currentUserName?: string;
    isAdmin: boolean;
    onApplyToReport: (
        records: ParsedEmployeeRevenue[],
        appliedStore: string,
        appliedDate: string,
        screenshotTimeStr?: string
    ) => void;
    onSaveToCloudSuccess?: (savedSession: DailyEmployeeRevenueSessionRecord) => void;
}

function stripOcrUiMetadata(records: DailyEmployeeOcrRecord[]): ParsedEmployeeRevenue[] {
    return records.map(r => ({
        employee_id: String(r.employee_id || '').trim(),
        full_name: String(r.full_name || '').trim(),
        quantity: Number(r.quantity) || 0,
        revenue_qd: Number(r.revenue_qd) || 0,
        revenue_actual: 0,
        installment_revenue: Number(r.installment_revenue) || 0,
        installment_rate: Number(r.installment_rate) || 0,
        revenue_return_qd: Number(r.revenue_return_qd) || 0,
        revenue_loan_qd: Number(r.revenue_loan_qd) || 0
    }));
}

export default function DailyEmployeeRevenueOcrModal({
    isOpen,
    onClose,
    availableStores,
    employeesDirectory,
    defaultSelectedStore = 'all',
    defaultReportDate = '',
    currentUserName = 'ADMIN',
    isAdmin,
    onApplyToReport,
    onSaveToCloudSuccess
}: Props) {
    // Bản đồ nhân viên -> ST từ danh bạ hệ thống
    const empStoreMap = useMemo(() => {
        const map: Record<string, string> = {};
        employeesDirectory.forEach(emp => {
            if (emp.employee_id) {
                map[emp.employee_id.trim()] = emp.store_name || '';
            }
        });
        return map;
    }, [employeesDirectory]);

    const { currentUser, isAdmin: authIsAdmin, canAccessStore } = useAuth();
    const effectiveIsAdmin = Boolean(isAdmin || authIsAdmin || currentUser?.role === 'ADMIN');

    // Lọc danh sách ST theo phân quyền người dùng
    const permittedStores = useMemo<StoreItem[]>(() => {
        if (effectiveIsAdmin) {
            return availableStores;
        }

        const isGuest = Boolean(currentUser?.is_guest);
        if (isGuest) {
            const guestTarget = currentUser?.store_name || '838679';
            return availableStores.filter(s => isStoreMatch(s.name, guestTarget, availableStores));
        }

        if (currentUser?.role === 'NHAN_VIEN') {
            if (!currentUser?.store_name) return [];
            return availableStores.filter(s => isStoreMatch(s.name, currentUser.store_name, availableStores));
        }

        const accessible = currentUser?.accessible_stores && currentUser.accessible_stores.length > 0
            ? currentUser.accessible_stores
            : (currentUser?.store_name ? [currentUser.store_name] : []);

        if (accessible.length === 0) return availableStores;
        return availableStores.filter(s =>
            canAccessStore(s.name) ||
            canAccessStore(getShortStoreName(s.name)) ||
            accessible.some(acc => isStoreMatch(s.name, acc, availableStores))
        );
    }, [availableStores, effectiveIsAdmin, currentUser, canAccessStore]);

    // Khử trùng lặp danh sách ST và chuẩn hóa tên có mã số
    const deduplicatedStores = useMemo<StoreItem[]>(() => {
        const uniqueNames = deduplicateStoreNames(permittedStores.map(s => s.name), availableStores);
        return uniqueNames.map(name => {
            const found = availableStores.find(s => s.name === name || isStoreMatch(s.name, name, availableStores));
            return found || { name, code: '' };
        });
    }, [permittedStores, availableStores]);

    // Quyền nạp Toàn Cụm: Chỉ Admin hoặc Quản lý phụ trách >= 2 ST
    const canAccessAllCluster = useMemo(() => {
        if (effectiveIsAdmin) return true;
        if (currentUser?.role === 'NHAN_VIEN') return false;
        return deduplicatedStores.length > 1;
    }, [effectiveIsAdmin, currentUser, deduplicatedStores]);

    const [selectedStore, setSelectedStore] = useState<string>(() => {
        if (defaultSelectedStore === 'all' && canAccessAllCluster) {
            return 'all';
        }
        if (defaultSelectedStore && defaultSelectedStore !== 'all') {
            const match = deduplicatedStores.find(s => isStoreMatch(s.name, defaultSelectedStore, availableStores));
            if (match) return match.name;
        }
        if (canAccessAllCluster) return 'all';
        return deduplicatedStores[0]?.name || '';
    });

    const wasOpenRef = useRef<boolean>(false);

    // Đồng bộ selectedStore với dropdown trang chính chỉ khi vừa mở modal (tránh reset mất ảnh khi đang thao tác)
    useEffect(() => {
        if (!isOpen) {
            wasOpenRef.current = false;
            return;
        }
        const justOpened = !wasOpenRef.current;
        wasOpenRef.current = true;
        if (!justOpened && selectedStore) {
            return;
        }

        if (defaultSelectedStore === 'all' && canAccessAllCluster) {
            setSelectedStore('all');
            return;
        }
        if (defaultSelectedStore && defaultSelectedStore !== 'all') {
            const match = deduplicatedStores.find(s => isStoreMatch(s.name, defaultSelectedStore, availableStores));
            if (match) {
                setSelectedStore(match.name);
                return;
            }
        }
        if (selectedStore === 'all' && !canAccessAllCluster) {
            setSelectedStore(deduplicatedStores[0]?.name || '');
        } else if (selectedStore !== 'all' && deduplicatedStores.length > 0) {
            const isValid = deduplicatedStores.some(s => isStoreMatch(s.name, selectedStore, availableStores));
            if (!isValid) {
                setSelectedStore(canAccessAllCluster ? 'all' : (deduplicatedStores[0]?.name || ''));
            }
        }
    }, [isOpen, defaultSelectedStore, deduplicatedStores, canAccessAllCluster, availableStores, selectedStore]);

    // Danh bạ nhân sự thuộc ST đang chọn (dùng cho gợi ý mapping khi thiếu Mã NV)
    const directoryForSelectedStore = useMemo(() => {
        if (!selectedStore || selectedStore === 'all') {
            return employeesDirectory;
        }
        const filtered = employeesDirectory.filter(e => isStoreMatch(e.store_name, selectedStore, availableStores));
        return filtered.length > 0 ? filtered : employeesDirectory;
    }, [employeesDirectory, selectedStore, availableStores]);

    // Ngày báo cáo realtime
    const [reportDate, setReportDate] = useState<string>(() => defaultReportDate || getTodayDateString());
    useEffect(() => {
        if (isOpen && defaultReportDate) {
            setReportDate(defaultReportDate);
        }
    }, [isOpen, defaultReportDate]);

    // 1. Quản lý 2 nhóm ảnh chuẩn mới (Doanh Thu QĐ & % Tỷ Trọng Trả Góp - không có DT Thực, không có Thi đua)
    const [pasteTarget, setPasteTarget] = useState<'QD' | 'INSTALLMENT'>('QD');
    const [qdFiles, setQdFiles] = useState<File[]>([]);
    const [installmentFiles, setInstallmentFiles] = useState<File[]>([]);

    const [isDraggingQD, setIsDraggingQD] = useState<boolean>(false);
    const [isDraggingInstallment, setIsDraggingInstallment] = useState<boolean>(false);
    const qdInputRef = useRef<HTMLInputElement>(null);
    const installmentInputRef = useRef<HTMLInputElement>(null);

    // 2. Gemini API Key
    const [keyInfo, setKeyInfo] = useState<ActiveKeyInfo>(() => resolveActiveGeminiKey());
    const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
    const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(false);

    // 3. Tiến trình trích xuất OCR
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const [progressText, setProgressText] = useState<string>('');
    const [progressPercent, setProgressPercent] = useState<number>(0);
    const [ocrError, setOcrError] = useState<string>('');
    const [detectedScreenshotTime, setDetectedScreenshotTime] = useState<string>('');

    // 4. Kết quả danh sách nhân viên bóc tách & Ref theo dõi đổi ST
    const [extractedRecords, setExtractedRecords] = useState<DailyEmployeeOcrRecord[]>([]);
    const [isSavingCloud, setIsSavingCloud] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');
    const toastTimerRef = useRef<number | null>(null);
    const closeBtnRef = useRef<HTMLButtonElement | null>(null);
    const lastStoreRef = useRef<string>('');

    const hasModalWorkingData =
        qdFiles.length > 0 ||
        installmentFiles.length > 0 ||
        extractedRecords.length > 0 ||
        Boolean(ocrError);
    const hasModalWorkingDataRef = useRef<boolean>(false);
    hasModalWorkingDataRef.current = hasModalWorkingData;

    const showToast = (msg: string) => {
        setToastMessage(msg);
        if (toastTimerRef.current) {
            window.clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = window.setTimeout(() => setToastMessage(''), 3500);
    };

    const resetModalBatch = () => {
        setQdFiles([]);
        setInstallmentFiles([]);
        setExtractedRecords([]);
        setOcrError('');
        setDetectedScreenshotTime('');
        setProgressText('');
        setProgressPercent(0);
        if (qdInputRef.current) qdInputRef.current.value = '';
        if (installmentInputRef.current) installmentInputRef.current.value = '';
    };

    // Tự động xóa trắng ảnh & kết quả cũ khi người dùng chuyển sang ST khác
    useEffect(() => {
        if (!selectedStore) return;
        const prev = lastStoreRef.current;
        if (prev && prev !== selectedStore) {
            const hadData = hasModalWorkingDataRef.current;
            resetModalBatch();
            if (hadData && isOpen) {
                const label = selectedStore === 'all' ? 'Toàn Cụm ST' : getShortStoreName(selectedStore);
                showToast(`🧹 Đã chuyển sang ${label} và tự động xóa trắng dữ liệu cũ!`);
            }
        }
        lastStoreRef.current = selectedStore;
    }, [selectedStore, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        fetchAdminGeminiKeyCloud().then(() => {
            setKeyInfo(resolveActiveGeminiKey());
        });
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        closeBtnRef.current?.focus();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isKeyModalOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isKeyModalOpen, onClose]);

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) {
                window.clearTimeout(toastTimerRef.current);
            }
        };
    }, []);

    // Hỗ trợ dán ảnh bằng phím tắt Ctrl + V trên toàn Modal
    useEffect(() => {
        if (!isOpen) return;
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            const pastedFiles: File[] = [];
            for (let i = 0; i < items.length; i++) {
                const file = items[i].kind === 'file' ? items[i].getAsFile() : null;
                if (file && (items[i].type.indexOf('image') !== -1 || isSupportedImageFile(file))) {
                    const targetCategory = pasteTarget === 'QD' ? 'DTQD' : 'TyTrongTG';
                    const extMatch = file.name?.match(/\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i);
                    const ext = extMatch ? extMatch[0].toLowerCase() : '.png';
                    const renamedFile = new File([file], `${targetCategory}_clipboard_${Date.now()}_${i + 1}${ext}`, {
                        type: file.type || 'image/png'
                    });
                    pastedFiles.push(renamedFile);
                }
            }

            if (pastedFiles.length > 0) {
                e.preventDefault();
                if (pasteTarget === 'QD') {
                    setQdFiles(prev => [...prev, ...pastedFiles]);
                    showToast(`📋 Đã dán ${pastedFiles.length} ảnh vào mục [1. Doanh Thu QĐ]!`);
                } else {
                    setInstallmentFiles(prev => [...prev, ...pastedFiles]);
                    showToast(`📋 Đã dán ${pastedFiles.length} ảnh vào mục [2. % Tỷ Trọng Trả Góp]!`);
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [isOpen, pasteTarget]);

    // Kéo thả ảnh trực tiếp vào từng mục
    const handleDropCategory = (e: React.DragEvent, category: 'QD' | 'INSTALLMENT') => {
        e.preventDefault();
        if (category === 'QD') setIsDraggingQD(false);
        else setIsDraggingInstallment(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const dropped = Array.from(e.dataTransfer.files).filter(isSupportedImageFile);
            if (dropped.length > 0) {
                if (category === 'QD') {
                    setQdFiles(prev => [...prev, ...dropped]);
                    showToast(`📁 Đã thêm ${dropped.length} ảnh vào [1. Doanh Thu QĐ]!`);
                } else {
                    setInstallmentFiles(prev => [...prev, ...dropped]);
                    showToast(`📁 Đã thêm ${dropped.length} ảnh vào [2. % Tỷ Trọng Trả Góp]!`);
                }
            } else {
                showToast('⚠️ Vui lòng thả đúng tệp hình ảnh (PNG, JPG, WEBP...).');
            }
        }
    };

    // Chọn ảnh từ nút bấm riêng của từng mục
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, category: 'QD' | 'INSTALLMENT') => {
        if (!e.target.files || e.target.files.length === 0) return;
        const selected = Array.from(e.target.files).filter(isSupportedImageFile);
        if (selected.length > 0) {
            if (category === 'QD') {
                setQdFiles(prev => [...prev, ...selected]);
                showToast(`📁 Đã chọn ${selected.length} ảnh Doanh Thu QĐ!`);
            } else {
                setInstallmentFiles(prev => [...prev, ...selected]);
                showToast(`📁 Đã chọn ${selected.length} ảnh % Tỷ Trọng Trả Góp!`);
            }
        } else {
            showToast('⚠️ Tệp vừa chọn không phải hình ảnh hợp lệ.');
        }
        if (e.target) e.target.value = '';
    };

    const handleClearAllFiles = () => {
        if (isExtracting || isSavingCloud) return;
        resetModalBatch();
        showToast('🧹 Đã xóa trắng ảnh và kết quả — sẵn sàng đợt nạp mới!');
    };

    // Chạy OCR bóc tách đa ảnh
    const handleRunOcr = async () => {
        const activeKey = keyInfo.key;
        if (!activeKey) {
            setIsKeyModalOpen(true);
            return;
        }

        if (qdFiles.length === 0 && installmentFiles.length === 0) {
            showToast('⚠️ Vui lòng chọn hoặc dán ít nhất 1 ảnh Doanh Thu QĐ hoặc % Tỷ Trọng Trả Góp!');
            return;
        }

        setIsExtracting(true);
        setOcrError('');
        setProgressText('Đang khởi tạo Gemini Vision...');
        setProgressPercent(10);

        try {
            const result = await extractDailyEmployeeRevenueImagesBatch(
                activeKey,
                {
                    qdFiles,
                    installmentFiles,
                    selectedStore,
                    storesList: availableStores
                },
                employeesDirectory,
                (msg, pct) => {
                    setProgressText(msg);
                    setProgressPercent(pct);
                },
                keyInfo.source
            );

            if (!result.success || result.records.length === 0) {
                setOcrError(result.errors?.join('; ') || 'Không tìm thấy dòng nhân viên nào trong ảnh. Hãy kiểm tra ảnh có rõ nét không.');
                setIsExtracting(false);
                return;
            }

            if (result.screenshotTimestamp) {
                setDetectedScreenshotTime(result.screenshotTimestamp);
            } else if (result.reportTime || result.reportDate) {
                const timeInfo = [result.reportTime, result.reportDate ? formatDate(result.reportDate) : ''].filter(Boolean).join(' ');
                setDetectedScreenshotTime(timeInfo);
            } else {
                setDetectedScreenshotTime(`${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${formatDate(reportDate)}`);
            }

            setExtractedRecords(result.records);
            setIsQuotaExceeded(false);
            setProgressPercent(100);
            setProgressText('Trích xuất hoàn tất!');

            const unmappedCount = result.records.filter(r => r.isUnmappedName).length;
            const nameMatchedCount = result.records.filter(
                r => !r.isUnmappedName && (r.mappingSource === 'NAME_EXACT' || r.mappingSource === 'NAME_FUZZY')
            ).length;

            if (unmappedCount > 0) {
                showToast(`⚠️ Đã đọc ${result.records.length} dòng (còn ${unmappedCount} dòng ảnh thiếu Mã NV cần chọn trong bảng)!`);
            } else if (nameMatchedCount > 0) {
                showToast(`✅ Đã đọc ${result.records.length} NV (${nameMatchedCount} dòng khớp tự động theo tên)!`);
            } else {
                showToast(`🎉 Bóc tách & đối chiếu thành công ${result.records.length} nhân viên!`);
            }
        } catch (err: any) {
            console.error('Lỗi khi bóc tách báo cáo nhân viên:', err);
            if (err instanceof GeminiQuotaExceededError) {
                setIsQuotaExceeded(true);
                setIsKeyModalOpen(true);
                setOcrError('Hạn mức API Key hệ thống đã hết. Hãy nhập Key cá nhân của bạn.');
            } else {
                setOcrError(err?.message || 'Có lỗi xảy ra khi bóc tách ảnh.');
            }
        } finally {
            setIsExtracting(false);
        }
    };

    // Sửa trực tiếp số liệu của nhân viên
    const handleUpdateRecord = (index: number, field: keyof ParsedEmployeeRevenue, value: any) => {
        setExtractedRecords(prev => {
            const updated = [...prev];
            const numericFields: Array<keyof ParsedEmployeeRevenue> = [
                'quantity',
                'revenue_qd',
                'installment_revenue',
                'installment_rate',
                'revenue_return_qd',
                'revenue_loan_qd'
            ];
            const normalizedVal = numericFields.includes(field)
                ? (value === '' ? 0 : cleanBiNumber(value))
                : value;

            updated[index] = { ...updated[index], [field]: normalizedVal };
            return updated;
        });
    };

    // Chọn / Đổi Mã NV từ danh bạ (tự gộp nếu Mã NV đích đã tồn tại trong bảng)
    const handleRemapEmployeeId = (sourceIndex: number, targetEmpId: string) => {
        const cleanTargetId = targetEmpId.trim();
        const sourceRow = extractedRecords[sourceIndex];
        if (!cleanTargetId || !sourceRow) return;

        const official = employeesDirectory.find(
            e => String(e.employee_id || '').trim().toLowerCase() === cleanTargetId.toLowerCase()
        );
        const officialId = official?.employee_id?.trim() || cleanTargetId;
        const officialName = official?.full_name?.trim() || sourceRow.full_name;

        const targetIndex = extractedRecords.findIndex(
            (r, idx) => idx !== sourceIndex && String(r.employee_id || '').trim().toLowerCase() === officialId.toLowerCase()
        );

        if (targetIndex >= 0) {
            setExtractedRecords(prev =>
                prev
                    .filter((_, idx) => idx !== sourceIndex)
                    .map(r => {
                        if (String(r.employee_id || '').trim().toLowerCase() !== officialId.toLowerCase()) return r;
                        return {
                            ...r,
                            employee_id: officialId,
                            full_name: officialName || r.full_name,
                            quantity: r.quantity || sourceRow.quantity,
                            revenue_qd: r.revenue_qd !== 0 ? r.revenue_qd : sourceRow.revenue_qd,
                            installment_revenue: r.installment_revenue || sourceRow.installment_revenue,
                            installment_rate: sourceRow.installment_rate || r.installment_rate,
                            revenue_return_qd: r.revenue_return_qd || sourceRow.revenue_return_qd || 0,
                            revenue_loan_qd: r.revenue_loan_qd || sourceRow.revenue_loan_qd || 0,
                            mappingSource: 'ID',
                            isUnmappedName: false,
                            ocrSourceName: sourceRow.ocrSourceName || r.ocrSourceName
                        };
                    })
            );
        } else {
            setExtractedRecords(prev =>
                prev.map((r, idx) =>
                    idx === sourceIndex
                        ? {
                            ...r,
                            employee_id: officialId,
                            full_name: officialName,
                            mappingSource: 'ID',
                            isUnmappedName: false,
                            ocrSourceName: r.ocrSourceName || r.full_name
                        }
                        : r
                )
            );
        }
    };

    const handleDeleteRecord = (index: number) => {
        setExtractedRecords(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddRecord = () => {
        setExtractedRecords(prev => [
            ...prev,
            {
                employee_id: '',
                full_name: 'Nhân viên mới',
                quantity: 0,
                revenue_qd: 0,
                revenue_actual: 0,
                installment_revenue: 0,
                installment_rate: 0,
                mappingSource: 'ID',
                isUnmappedName: false
            }
        ]);
    };

    // Thống kê tổng hợp kết quả (Không có DT Thực)
    const summaryStats = useMemo(() => {
        const totalEmp = extractedRecords.length;
        const totalQd = extractedRecords.reduce((acc, r) => acc + (Number(r.revenue_qd) || 0), 0);
        const totalInstallment = extractedRecords.reduce((acc, r) => acc + (Number(r.installment_revenue) || 0), 0);
        const totalQty = extractedRecords.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);

        const weightSum = extractedRecords.reduce((acc, r) => acc + ((Number(r.revenue_qd) || 0) > 0 ? Number(r.revenue_qd) : 0), 0);
        let avgInstRate = 0;
        if (weightSum > 0) {
            const weightedRate = extractedRecords.reduce(
                (acc, r) => acc + ((Number(r.revenue_qd) || 0) > 0 ? (Number(r.installment_rate) || 0) * Number(r.revenue_qd) : 0),
                0
            );
            avgInstRate = Number((weightedRate / weightSum).toFixed(1));
        } else {
            const withRate = extractedRecords.filter(r => (Number(r.installment_rate) || 0) > 0);
            if (withRate.length > 0) {
                avgInstRate = Number(
                    (withRate.reduce((acc, r) => acc + Number(r.installment_rate), 0) / withRate.length).toFixed(1)
                );
            }
        }

        return {
            totalEmp,
            totalQd,
            totalInstallment,
            totalQty,
            avgInstRate
        };
    }, [extractedRecords]);

    if (!isOpen) return null;

    const validateBeforeApply = (): boolean => {
        if (extractedRecords.length === 0) {
            showToast('⚠️ Chưa có dữ liệu nhân viên để xử lý!');
            return false;
        }
        const invalidRows = extractedRecords.filter(
            r => Boolean(r.isUnmappedName) || String(r.employee_id || '').startsWith('UNMAPPED::') || !String(r.employee_id || '').trim()
        );
        if (invalidRows.length > 0) {
            showToast(`⚠️ Còn ${invalidRows.length} dòng chưa có Mã NV chính thức! Vui lòng chọn Mã NV từ danh bạ hoặc xóa dòng thừa.`);
            return false;
        }
        return true;
    };

    // 1. Áp dụng vào báo cáo trên trang (in-memory)
    const handleApplyOnly = () => {
        if (!validateBeforeApply()) return;
        const cleanRecords = stripOcrUiMetadata(extractedRecords);

        onApplyToReport(cleanRecords, selectedStore, reportDate, detectedScreenshotTime);
        const storeLabel = selectedStore === 'all' ? 'Toàn Cụm' : getShortStoreName(selectedStore);
        showToast(`✅ Đã áp dụng ${cleanRecords.length} nhân viên (${storeLabel}) vào báo cáo!`);
        onClose();
    };

    // 2. Áp dụng & Lưu trực tiếp lên Supabase Cloud
    const handleApplyAndSaveCloud = async () => {
        if (!validateBeforeApply()) return;
        const cleanRecords = stripOcrUiMetadata(extractedRecords);

        setIsSavingCloud(true);
        try {
            const sessionRecord: DailyEmployeeRevenueSessionRecord = {
                store_name: selectedStore,
                report_date: reportDate,
                session_time: new Date().toISOString(),
                screenshot_time_str: detectedScreenshotTime || `${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${formatDate(reportDate)}`,
                employee_count: cleanRecords.length,
                total_revenue_qd: summaryStats.totalQd,
                total_revenue_actual: 0,
                total_installment: summaryStats.totalInstallment,
                total_quantity: summaryStats.totalQty,
                records: cleanRecords,
                raw_info: {
                    source: 'OCR_BI_MOBILE_NO_ACTUAL',
                    qd_files_count: qdFiles.length,
                    installment_files_count: installmentFiles.length
                },
                updated_by: currentUserName
            };

            if (selectedStore === 'all') {
                const clusterRes = await saveClusterDailyEmployeeSessions(
                    sessionRecord,
                    employeesDirectory,
                    currentUserName
                );

                if (!clusterRes.success) {
                    showToast(`❌ Lỗi lưu Cloud: ${clusterRes.error}`);
                    setIsSavingCloud(false);
                    return;
                }

                onApplyToReport(cleanRecords, 'all', reportDate, detectedScreenshotTime);
                onSaveToCloudSuccess?.(sessionRecord);

                const storeCount = clusterRes.affectedStores.length > 1 ? clusterRes.affectedStores.length - 1 : 0;
                showToast(`🎉 Đã lưu phiên Toàn Cụm (${cleanRecords.length} NV) và phân bổ về ${storeCount} ST!`);
            } else {
                const res = await saveDailyEmployeeSession(sessionRecord, currentUserName);
                if (!res.success) {
                    showToast(`❌ Lỗi lưu Cloud: ${res.error}`);
                    setIsSavingCloud(false);
                    return;
                }

                onApplyToReport(cleanRecords, selectedStore, reportDate, detectedScreenshotTime);
                onSaveToCloudSuccess?.(sessionRecord);

                showToast(`🎉 Đã lưu phiên ${cleanRecords.length} nhân viên của ${getShortStoreName(selectedStore)} lên Cloud!`);
            }

            setTimeout(() => {
                setIsSavingCloud(false);
                resetModalBatch();
                onClose();
            }, 600);
        } catch (err: any) {
            console.error('Lỗi khi lưu phiên nhân viên lên Cloud:', err);
            showToast('❌ Có lỗi xảy ra khi lưu lên Cloud.');
            setIsSavingCloud(false);
        }
    };

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-emp-ocr-modal-title"
            className="!mt-0 fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50"
        >
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* 1. HEADER */}
                <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-inner shrink-0">
                            <Sparkles className="w-5 h-5 text-emerald-300" aria-hidden="true" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 id="daily-emp-ocr-modal-title" className="text-base sm:text-lg font-black tracking-tight text-white">
                                    Nhập liệu Doanh Thu Nhân Viên
                                </h2>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5">
                                1. Doanh Thu QĐ (nhiều ảnh) + 2. % Tỷ Trọng Trả Góp • Hỗ trợ dán nhanh <kbd className="font-mono bg-white/20 px-1 rounded">Ctrl+V</kbd>
                            </p>
                        </div>
                    </div>

                    <button
                        ref={closeBtnRef}
                        type="button"
                        aria-label="Đóng hộp thoại nhập liệu doanh thu nhân viên"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                {/* TOAST THÔNG BÁO NỘI BỘ */}
                {toastMessage && (
                    <div role="status" aria-live="polite" className="bg-emerald-700 text-white text-xs font-bold px-4 py-2 text-center shrink-0">
                        {toastMessage}
                    </div>
                )}

                {/* 2. BODY CUỘN */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                    {/* KHỐI THIẾT LẬP ST REALTIME */}
                    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-3">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <div className="flex-1">
                                <label htmlFor="ocr-modal-store-select" className="block text-[11px] font-black uppercase text-slate-700 mb-1 flex items-center gap-1.5">
                                    <Store className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                                    <span>Chọn ST nhập liệu:</span>
                                    <span className="text-rose-600">*</span>
                                    {!effectiveIsAdmin && deduplicatedStores.length > 0 && (
                                        <span className="ml-auto text-[10px] font-normal normal-case text-slate-600">
                                            (Được phân quyền: <strong className="text-blue-700 font-bold">{deduplicatedStores.length}</strong> ST)
                                        </span>
                                    )}
                                </label>
                                {deduplicatedStores.length === 0 ? (
                                    <div className="text-xs text-rose-700 font-bold p-2 bg-rose-50 border border-rose-200 rounded-xl">
                                        Tài khoản của bạn chưa được phân quyền ST nào để nhập liệu. Vui lòng liên hệ Quản trị viên.
                                    </div>
                                ) : (
                                    <select
                                        id="ocr-modal-store-select"
                                        name="ocrStore"
                                        value={selectedStore}
                                        disabled={isExtracting || isSavingCloud}
                                        onChange={(e) => setSelectedStore(e.target.value)}
                                        className="w-full bg-white border border-slate-300 text-slate-800 py-2.5 px-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer disabled:opacity-60"
                                    >
                                        {canAccessAllCluster && (
                                            <option value="all">Toàn Cụm (Nhập 1 lần nhiều ST)</option>
                                        )}
                                        {deduplicatedStores.map(st => (
                                            <option key={st.id || st.code || st.name} value={st.name}>
                                                {formatStoreDisplayName(st.name)}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                {selectedStore === 'all' && (
                                    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl p-2.5 flex items-start gap-2 text-xs text-blue-900">
                                        <Users className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
                                        <div>
                                            <strong className="font-bold">Chế độ Nhập liệu Toàn Cụm:</strong> Hệ thống sẽ lưu 1 phiên Toàn Cụm đồng thời tự động phân bổ số liệu về từng ST theo danh sách nhân sự!
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="self-end sm:self-center pt-1 sm:pt-4 shrink-0 flex items-center gap-2 flex-wrap">
                                <div className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-1.5 shadow-sm tabular-nums">
                                    <Zap className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                                    <span>Hôm nay: {formatDate(reportDate)}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsKeyModalOpen(true)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded-xl text-xs font-bold border transition shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isQuotaExceeded
                                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                                        : keyInfo.source === 'USER'
                                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                            : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                                        }`}
                                >
                                    <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>{Boolean(keyInfo.key) ? (keyInfo.source === 'USER' ? 'Key Cá Nhân' : 'Key Hệ Thống') : 'Nhập API Key'}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* KHUNG NẠP ẢNH 2 BƯỚC & NÚT XỬ LÝ OCR */}
                    <DailyOcrUploadSection
                        pasteTarget={pasteTarget}
                        onChangePasteTarget={setPasteTarget}
                        qdFiles={qdFiles}
                        installmentFiles={installmentFiles}
                        isDraggingQD={isDraggingQD}
                        isDraggingInstallment={isDraggingInstallment}
                        onDragStateChange={(cat, dragging) => {
                            if (cat === 'QD') setIsDraggingQD(dragging);
                            else setIsDraggingInstallment(dragging);
                        }}
                        onDropCategory={handleDropCategory}
                        onFileInputChange={handleFileInputChange}
                        onRemoveFile={(cat, index) => {
                            if (cat === 'QD') setQdFiles(prev => prev.filter((_, idx) => idx !== index));
                            else setInstallmentFiles(prev => prev.filter((_, idx) => idx !== index));
                        }}
                        qdInputRef={qdInputRef}
                        installmentInputRef={installmentInputRef}
                        hasModalWorkingData={hasModalWorkingData}
                        isExtracting={isExtracting}
                        isSavingCloud={isSavingCloud}
                        progressText={progressText}
                        progressPercent={progressPercent}
                        onClearAllFiles={handleClearAllFiles}
                        onRunOcr={handleRunOcr}
                    />

                    {/* BÁO LỖI NẾU CÓ */}
                    {ocrError && (
                        <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2 text-xs text-rose-800 font-medium">
                            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />
                            <span>{ocrError}</span>
                        </div>
                    )}

                    {/* BẢNG XEM TRƯỚC & RÀ SOÁT MAPPING KẾT QUẢ */}
                    <DailyOcrPreviewTable
                        records={extractedRecords}
                        selectedStore={selectedStore}
                        employeesDirectory={directoryForSelectedStore}
                        empStoreMap={empStoreMap}
                        summaryStats={summaryStats}
                        onAddRecord={handleAddRecord}
                        onUpdateRecord={handleUpdateRecord}
                        onDeleteRecord={handleDeleteRecord}
                        onRemapEmployeeId={handleRemapEmployeeId}
                    />
                </div>

                {/* 3. FOOTER HÀNH ĐỘNG LUÔN CỐ ĐỊNH Ở ĐÁY MODAL */}
                <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
                    <div className="text-xs text-slate-600 font-medium">
                        Đang nạp Realtime cho: <strong className="text-blue-700">{selectedStore === 'all' ? 'Toàn Cụm' : formatStoreDisplayName(selectedStore)}</strong> • {formatDate(reportDate)}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                        >
                            Đóng
                        </button>

                        {(qdFiles.length + installmentFiles.length) > 0 && (
                            <button
                                type="button"
                                onClick={handleRunOcr}
                                disabled={isExtracting || isSavingCloud}
                                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition cursor-pointer"
                                title="Xử lý bóc tách số liệu từ các ảnh đã nạp bằng Gemini AI"
                            >
                                <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isExtracting ? 'animate-spin' : ''}`} aria-hidden="true" />
                                <span>
                                    {isExtracting
                                        ? `Đang OCR (${progressPercent}%)`
                                        : extractedRecords.length > 0
                                            ? `Quét Lại OCR (${qdFiles.length + installmentFiles.length})`
                                            : `Xử Lý OCR (${qdFiles.length + installmentFiles.length} ảnh)`}
                                </span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleApplyOnly}
                            disabled={extractedRecords.length === 0 || isExtracting}
                            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 disabled:opacity-50 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                            title="Áp dụng số liệu vào báo cáo để xem trước mà chưa lưu Cloud"
                        >
                            <span>Áp Dụng Vào Báo Cáo</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleApplyAndSaveCloud}
                            disabled={isSavingCloud || extractedRecords.length === 0 || isExtracting}
                            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition cursor-pointer"
                            title="Áp dụng vào báo cáo và lưu vĩnh viễn lên Cloud"
                        >
                            <Save className={`w-4 h-4 ${isSavingCloud ? 'animate-spin' : ''}`} aria-hidden="true" />
                            <span>{isSavingCloud ? 'Đang lưu Cloud...' : 'Áp Dụng & Lưu Cloud Ngay'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAL CÀI ĐẶT GEMINI API KEY */}
            <GeminiApiKeyModal
                isOpen={isKeyModalOpen}
                onClose={() => setIsKeyModalOpen(false)}
                isAdmin={isAdmin}
                onKeySaved={() => {
                    setKeyInfo(resolveActiveGeminiKey());
                    setIsQuotaExceeded(false);
                }}
            />
        </div>,
        document.body
    );
}
