import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    X,
    Camera,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Save,
    Trash2,
    Plus,
    Store,
    Calendar,
    UploadCloud,
    Clipboard,
    KeyRound,
    RotateCcw,
    TrendingUp,
    CreditCard,
    Coins,
    Users
} from 'lucide-react';
import type { StoreItem, EmployeeItem } from '../../../core/lib/storage';
import { getShortStoreName, formatValue, cleanBiNumber, formatDate } from '../../../core/lib/formatters';
import type { ParsedEmployeeRevenue } from '../../employee-cumulative/utils/employeeParsers';
import { extractDailyEmployeeRevenueImagesBatch } from '../services/geminiDailyEmployeeOcrService';
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
    if (!isOpen) return null;

    // Bản đồ nhân viên -> siêu thị từ danh bạ hệ thống
    const empStoreMap = useMemo(() => {
        const map: Record<string, string> = {};
        employeesDirectory.forEach(emp => {
            if (emp.employee_id) {
                map[emp.employee_id.trim()] = emp.store_name || '';
            }
        });
        return map;
    }, [employeesDirectory]);

    // Khởi tạo siêu thị và ngày chốt (mặc định cho phép 'all' - Toàn Cụm)
    const storeOptions = useMemo(() => {
        const names = availableStores.map(s => s.name);
        return ['all', ...names];
    }, [availableStores]);

    const [selectedStore, setSelectedStore] = useState<string>(() => {
        if (defaultSelectedStore) {
            return defaultSelectedStore;
        }
        return 'all';
    });

    const [reportDate, setReportDate] = useState<string>(() => {
        return defaultReportDate || new Date().toISOString().split('T')[0];
    });

    // 1. Quản lý 2 danh sách file trong cùng 1 khung upload duy nhất
    const [pasteTarget, setPasteTarget] = useState<'QD' | 'REAL'>('QD');
    const [qdFiles, setQdFiles] = useState<File[]>([]);
    const [realFiles, setRealFiles] = useState<File[]>([]);

    const [isDraggingQD, setIsDraggingQD] = useState<boolean>(false);
    const [isDraggingReal, setIsDraggingReal] = useState<boolean>(false);
    const qdInputRef = useRef<HTMLInputElement>(null);
    const realInputRef = useRef<HTMLInputElement>(null);

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

    // 4. Kết quả danh sách nhân viên bóc tách
    const [extractedRecords, setExtractedRecords] = useState<ParsedEmployeeRevenue[]>([]);
    const [isSavingCloud, setIsSavingCloud] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');

    useEffect(() => {
        fetchAdminGeminiKeyCloud().then(() => {
            setKeyInfo(resolveActiveGeminiKey());
        });
    }, []);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3000);
    };

    // Hỗ trợ dán ảnh bằng phím tắt Ctrl + V trên toàn Modal
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            const pastedFiles: File[] = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        const targetCategory = pasteTarget === 'QD' ? 'DTQD' : 'DTThuc';
                        const renamedFile = new File([file], `${targetCategory}_clipboard_${Date.now()}_${i + 1}.png`, { type: file.type });
                        pastedFiles.push(renamedFile);
                    }
                }
            }

            if (pastedFiles.length > 0) {
                e.preventDefault();
                if (pasteTarget === 'QD') {
                    setQdFiles(prev => [...prev, ...pastedFiles]);
                    showToast(`📋 Đã dán ${pastedFiles.length} ảnh vào mục [DTQĐ & Số lượng]!`);
                } else {
                    setRealFiles(prev => [...prev, ...pastedFiles]);
                    showToast(`📋 Đã dán ${pastedFiles.length} ảnh vào mục [DT Thực & Trả góp]!`);
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [pasteTarget]);

    // Kéo thả ảnh trực tiếp vào từng mục
    const handleDropCategory = (e: React.DragEvent, category: 'QD' | 'REAL') => {
        e.preventDefault();
        if (category === 'QD') setIsDraggingQD(false);
        else setIsDraggingReal(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (dropped.length > 0) {
                if (category === 'QD') {
                    setQdFiles(prev => [...prev, ...dropped]);
                    showToast(`📁 Đã thêm ${dropped.length} ảnh vào [DTQĐ & Số lượng]!`);
                } else {
                    setRealFiles(prev => [...prev, ...dropped]);
                    showToast(`📁 Đã thêm ${dropped.length} ảnh vào [DT Thực & Trả góp]!`);
                }
            }
        }
    };

    // Chọn ảnh từ nút bấm riêng của từng mục (hỗ trợ chọn 1 hoặc nhiều ảnh)
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, category: 'QD' | 'REAL') => {
        if (!e.target.files) return;
        const selected = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
        if (selected.length > 0) {
            if (category === 'QD') {
                setQdFiles(prev => [...prev, ...selected]);
                showToast(`📁 Đã chọn ${selected.length} ảnh DTQĐ & Số lượng!`);
            } else {
                setRealFiles(prev => [...prev, ...selected]);
                showToast(`📁 Đã chọn ${selected.length} ảnh DT Thực & Trả góp!`);
            }
        }
        if (e.target) e.target.value = '';
    };

    const isDragging = pasteTarget === 'QD' ? isDraggingQD : isDraggingReal;
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (pasteTarget === 'QD') setIsDraggingQD(true);
        else setIsDraggingReal(true);
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        if (pasteTarget === 'QD') setIsDraggingQD(false);
        else setIsDraggingReal(false);
    };
    const handleDrop = (e: React.DragEvent) => {
        handleDropCategory(e, pasteTarget);
    };

    const handleClearAllFiles = () => {
        setQdFiles([]);
        setRealFiles([]);
        setExtractedRecords([]);
        setOcrError('');
    };

    // Chạy OCR bóc tách đa ảnh
    const handleRunOcr = async () => {
        const activeKey = keyInfo.key;
        if (!activeKey) {
            setIsKeyModalOpen(true);
            return;
        }

        if (qdFiles.length === 0 && realFiles.length === 0) {
            showToast('⚠️ Vui lòng chọn hoặc dán ít nhất 1 ảnh DTQĐ hoặc DT Thực!');
            return;
        }

        setIsExtracting(true);
        setOcrError('');
        setProgressText('Đang khởi tạo Gemini Vision...');
        setProgressPercent(10);

        try {
            const result = await extractDailyEmployeeRevenueImagesBatch(
                activeKey,
                { qdFiles, realFiles },
                employeesDirectory,
                (msg, pct) => {
                    setProgressText(msg);
                    setProgressPercent(pct);
                }
            );

            if (!result.success || result.records.length === 0) {
                setOcrError(result.errors?.join('; ') || 'Không tìm thấy dòng nhân viên nào trong ảnh. Hãy kiểm tra ảnh có rõ nét không.');
                setIsExtracting(false);
                return;
            }

            // Ghi nhận thời gian cập nhật trên ảnh
            if (result.reportTime || result.reportDate) {
                const timeInfo = [result.reportTime, result.reportDate ? formatDate(result.reportDate) : ''].filter(Boolean).join(' ');
                setDetectedScreenshotTime(timeInfo);
                if (result.reportDate) {
                    setReportDate(result.reportDate);
                }
            } else {
                setDetectedScreenshotTime(`${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${formatDate(reportDate)}`);
            }

            setExtractedRecords(result.records);
            setIsQuotaExceeded(false);
            setProgressPercent(100);
            setProgressText('Trích xuất hoàn tất!');
            showToast(`🎉 Bóc tách & đối chiếu thành công ${result.records.length} nhân viên!`);
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
            const current = { ...updated[index], [field]: value };

            if (field === 'revenue_actual' || field === 'installment_revenue') {
                const act = field === 'revenue_actual' ? cleanBiNumber(value) : current.revenue_actual;
                const inst = field === 'installment_revenue' ? cleanBiNumber(value) : current.installment_revenue;
                current.installment_rate = act > 0 ? Number(((inst / act) * 100).toFixed(1)) : 0;
            }

            updated[index] = current;
            return updated;
        });
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
                installment_rate: 0
            }
        ]);
    };

    // Thống kê tổng hợp kết quả
    const summaryStats = useMemo(() => {
        const totalEmp = extractedRecords.length;
        const totalQd = extractedRecords.reduce((acc, r) => acc + (r.revenue_qd || 0), 0);
        const totalActual = extractedRecords.reduce((acc, r) => acc + (r.revenue_actual || 0), 0);
        const totalInstallment = extractedRecords.reduce((acc, r) => acc + (r.installment_revenue || 0), 0);
        const totalQty = extractedRecords.reduce((acc, r) => acc + (r.quantity || 0), 0);
        const avgInstRate = totalActual > 0 ? Number(((totalInstallment / totalActual) * 100).toFixed(1)) : 0;

        return {
            totalEmp,
            totalQd,
            totalActual,
            totalInstallment,
            totalQty,
            avgInstRate
        };
    }, [extractedRecords]);

    // 1. Áp dụng vào báo cáo trên trang (in-memory)
    const handleApplyOnly = () => {
        if (extractedRecords.length === 0) {
            showToast('⚠️ Chưa có dữ liệu nhân viên để áp dụng!');
            return;
        }

        onApplyToReport(extractedRecords, selectedStore, reportDate, detectedScreenshotTime);
        const storeLabel = selectedStore === 'all' ? 'Toàn Cụm' : getShortStoreName(selectedStore);
        showToast(`✅ Đã áp dụng ${extractedRecords.length} nhân viên (${storeLabel}) vào báo cáo!`);
        onClose();
    };

    // 2. Áp dụng & Lưu trực tiếp lên Supabase Cloud (Hỗ trợ cả 1 siêu thị hoặc Toàn Cụm)
    const handleApplyAndSaveCloud = async () => {
        if (extractedRecords.length === 0) {
            showToast('⚠️ Chưa có dữ liệu nhân viên để lưu!');
            return;
        }

        setIsSavingCloud(true);
        try {
            const sessionRecord: DailyEmployeeRevenueSessionRecord = {
                store_name: selectedStore,
                report_date: reportDate,
                session_time: new Date().toISOString(),
                screenshot_time_str: detectedScreenshotTime || `${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${formatDate(reportDate)}`,
                employee_count: summaryStats.totalEmp,
                total_revenue_qd: summaryStats.totalQd,
                total_revenue_actual: summaryStats.totalActual,
                total_installment: summaryStats.totalInstallment,
                total_quantity: summaryStats.totalQty,
                records: extractedRecords,
                raw_info: {
                    source: 'OCR_BI_MOBILE',
                    qd_files_count: qdFiles.length,
                    real_files_count: realFiles.length
                },
                updated_by: currentUserName
            };

            if (selectedStore === 'all') {
                // Lưu cho Toàn Cụm và tự động phân bổ về các siêu thị trong cụm
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

                onApplyToReport(extractedRecords, 'all', reportDate, detectedScreenshotTime);

                if (onSaveToCloudSuccess) {
                    onSaveToCloudSuccess(sessionRecord);
                }

                const storeCount = clusterRes.affectedStores.length > 1 ? clusterRes.affectedStores.length - 1 : 0;
                showToast(`🎉 Đã lưu phiên Toàn Cụm (${summaryStats.totalEmp} NV) và phân bổ về ${storeCount} siêu thị!`);
            } else {
                // Lưu cho 1 siêu thị cụ thể
                const res = await saveDailyEmployeeSession(sessionRecord, currentUserName);
                if (!res.success) {
                    showToast(`❌ Lỗi lưu Cloud: ${res.error}`);
                    setIsSavingCloud(false);
                    return;
                }

                onApplyToReport(extractedRecords, selectedStore, reportDate, detectedScreenshotTime);

                if (onSaveToCloudSuccess) {
                    onSaveToCloudSuccess(sessionRecord);
                }

                showToast(`🎉 Đã lưu phiên ${summaryStats.totalEmp} nhân viên của ${getShortStoreName(selectedStore)} lên Cloud!`);
            }

            setTimeout(() => {
                setIsSavingCloud(false);
                onClose();
            }, 600);
        } catch (err: any) {
            console.error('Lỗi khi lưu phiên nhân viên lên Cloud:', err);
            showToast('❌ Có lỗi xảy ra khi lưu lên Cloud.');
            setIsSavingCloud(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* 1. HEADER */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-inner shrink-0">
                            <Sparkles className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                                    Quét OCR Doanh Thu Ngày Nhân Viên
                                </h2>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                                    BI Mobile Vision
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5">
                                Hỗ trợ chọn nhiều ảnh cuộn, dán nhanh <kbd className="font-mono bg-white/20 px-1 rounded">Ctrl+V</kbd> &amp; tự động xử lý ảnh mất tiêu đề
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* TOAST THÔNG BÁO NỘI BỘ */}
                {toastMessage && (
                    <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 text-center animate-fade-in shrink-0">
                        {toastMessage}
                    </div>
                )}

                {/* 2. BODY CUỘN */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                    {/* KHỐI THIẾT LẬP SIÊU THỊ & NGÀY CHỐT */}
                    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                                <label className="block text-[11px] font-black uppercase text-slate-600 mb-1 flex items-center gap-1.5">
                                    <Store className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Siêu Thị Cần Nạp Số Liệu</span>
                                    <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={selectedStore}
                                    onChange={(e) => setSelectedStore(e.target.value)}
                                    className="w-full bg-white border border-slate-300 text-slate-800 py-2 px-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                                >
                                    <option value="all">🌐 Toàn Cụm Siêu Thị (Nhập chung 1 lần nhiều siêu thị)</option>
                                    {availableStores.map(st => (
                                        <option key={st.id || st.code || st.name} value={st.name}>
                                            {st.code ? `[${st.code}] ` : ''}{getShortStoreName(st.name)}
                                        </option>
                                    ))}
                                </select>
                                {selectedStore === 'all' && (
                                    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl p-2.5 flex items-start gap-2 text-xs text-blue-900">
                                        <Users className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                        <div>
                                            <strong className="font-bold">Chế độ Nhập liệu Toàn Cụm:</strong> Khi lưu Cloud, hệ thống sẽ lưu 1 phiên Toàn Cụm đồng thời tự động phân bổ số liệu về từng siêu thị thành viên theo danh bạ nhân sự!
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase text-slate-600 mb-1 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Ngày Báo Cáo</span>
                                    <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={reportDate}
                                    onChange={e => setReportDate(e.target.value)}
                                    className="w-full bg-white border border-slate-300 text-slate-800 py-2 px-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-xs">
                            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                <span>🔑 API Key:</span>
                                <strong className="text-slate-700">{Boolean(keyInfo.key) ? (keyInfo.source === 'USER' ? 'Key Cá Nhân' : 'Key Hệ Thống') : 'Chưa có Key'}</strong>
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsKeyModalOpen(true)}
                                className="text-[11px] text-blue-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                                <KeyRound className="w-3 h-3" />
                                <span>Quản lý Key Gemini</span>
                            </button>
                        </div>
                    </div>

                    {/* KHUNG NẠP ẢNH HỢP NHẤT (UNIFIED SINGLE UPLOAD FRAME) */}
                    <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-3.5 space-y-3">
                        {/* Thanh chỉ định mục tiêu dán ảnh Ctrl + V & Nút xóa ảnh */}
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200/80">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                                    <Clipboard className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Mục tiêu phím tắt <kbd className="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 font-bold">Ctrl + V</kbd>:</span>
                                </span>
                                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs font-bold">
                                    <button
                                        type="button"
                                        onClick={() => setPasteTarget('QD')}
                                        className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                                            pasteTarget === 'QD'
                                                ? 'bg-emerald-600 text-white shadow-2xs font-black'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <TrendingUp className="w-3 h-3" />
                                        <span>DTQĐ &amp; Số Lượng ({qdFiles.length})</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPasteTarget('REAL')}
                                        className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                                            pasteTarget === 'REAL'
                                                ? 'bg-purple-600 text-white shadow-2xs font-black'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <CreditCard className="w-3 h-3" />
                                        <span>DT Thực &amp; Trả Góp ({realFiles.length})</span>
                                    </button>
                                </div>
                            </div>

                            {(qdFiles.length > 0 || realFiles.length > 0) && (
                                <button
                                    type="button"
                                    onClick={handleClearAllFiles}
                                    className="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
                                >
                                    Xóa hết ảnh đã nạp
                                </button>
                            )}
                        </div>

                        {/* 2 Khung con tải ảnh riêng biệt hiển thị song song trong 1 khung */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* KHUNG 1: DTQĐ & SỐ LƯỢNG */}
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDraggingQD(true); }}
                                onDragLeave={() => setIsDraggingQD(false)}
                                onDrop={(e) => handleDropCategory(e, 'QD')}
                                className={`border-2 border-dashed rounded-2xl p-3.5 flex flex-col justify-between transition-all bg-white ${
                                    isDraggingQD
                                        ? 'border-emerald-500 bg-emerald-50/70 scale-[0.99]'
                                        : pasteTarget === 'QD'
                                        ? 'border-emerald-300 ring-2 ring-emerald-100'
                                        : 'border-slate-200'
                                }`}
                            >
                                <input
                                    ref={qdInputRef}
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => handleFileInputChange(e, 'QD')}
                                    className="hidden"
                                />

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                                                <TrendingUp className="w-3.5 h-3.5" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-black text-emerald-950 uppercase tracking-tight">
                                                    1. DTQĐ &amp; Số Lượng
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-medium">
                                                    Cột: SỐ LƯỢNG, DOANH THU QĐ
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                            {qdFiles.length} ảnh
                                        </span>
                                    </div>

                                    {/* Nút tải ảnh riêng của DTQĐ (hỗ trợ 1 hoặc nhiều ảnh) */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPasteTarget('QD');
                                            qdInputRef.current?.click();
                                        }}
                                        className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                                    >
                                        <Camera className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>📸 Tải Ảnh DTQĐ (+nhiều ảnh)</span>
                                    </button>

                                    {/* Danh sách ảnh đã chọn */}
                                    <div className="min-h-[50px] max-h-28 overflow-y-auto pt-1">
                                        {qdFiles.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-center p-2 text-[10.5px] text-slate-400 italic">
                                                Kéo thả ảnh hoặc chọn nút trên (Hỗ trợ nhiều ảnh cuộn)
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {qdFiles.map((f, i) => (
                                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-md text-[10.5px] font-medium">
                                                        <span className="truncate max-w-[130px]" title={f.name}>{f.name}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setQdFiles(prev => prev.filter((_, idx) => idx !== i))}
                                                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* KHUNG 2: DT THỰC & TRẢ GÓP */}
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDraggingReal(true); }}
                                onDragLeave={() => setIsDraggingReal(false)}
                                onDrop={(e) => handleDropCategory(e, 'REAL')}
                                className={`border-2 border-dashed rounded-2xl p-3.5 flex flex-col justify-between transition-all bg-white ${
                                    isDraggingReal
                                        ? 'border-purple-500 bg-purple-50/70 scale-[0.99]'
                                        : pasteTarget === 'REAL'
                                        ? 'border-purple-300 ring-2 ring-purple-100'
                                        : 'border-slate-200'
                                }`}
                            >
                                <input
                                    ref={realInputRef}
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => handleFileInputChange(e, 'REAL')}
                                    className="hidden"
                                />

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center">
                                                <CreditCard className="w-3.5 h-3.5" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-black text-purple-950 uppercase tracking-tight">
                                                    2. DT Thực &amp; Trả Góp
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-medium">
                                                    Cột: DOANH THU, DT TRẢ GÓP
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
                                            {realFiles.length} ảnh
                                        </span>
                                    </div>

                                    {/* Nút tải ảnh riêng của DT Thực (hỗ trợ 1 hoặc nhiều ảnh) */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPasteTarget('REAL');
                                            realInputRef.current?.click();
                                        }}
                                        className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                                    >
                                        <Camera className="w-3.5 h-3.5 text-purple-600" />
                                        <span>📸 Tải Ảnh DT Thực (+nhiều ảnh)</span>
                                    </button>

                                    {/* Danh sách ảnh đã chọn */}
                                    <div className="min-h-[50px] max-h-28 overflow-y-auto pt-1">
                                        {realFiles.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-center p-2 text-[10.5px] text-slate-400 italic">
                                                Kéo thả ảnh hoặc chọn nút trên (Hỗ trợ nhiều ảnh cuộn)
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {realFiles.map((f, i) => (
                                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-900 border border-purple-200 rounded-md text-[10.5px] font-medium">
                                                        <span className="truncate max-w-[130px]" title={f.name}>{f.name}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setRealFiles(prev => prev.filter((_, idx) => idx !== i))}
                                                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TIẾN TRÌNH HOẶC NÚT TRÍCH XUẤT */}
                    {isExtracting ? (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-2 text-center animate-pulse">
                            <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                                <span>{progressText}</span>
                                <span>{progressPercent}%</span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-3">
                            {(qdFiles.length > 0 || realFiles.length > 0) && (
                                <button
                                    type="button"
                                    onClick={handleRunOcr}
                                    className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                                >
                                    <Sparkles className="w-4 h-4 text-amber-300" />
                                    <span>✨ Bắt Đầu Bóc Tách &amp; Hợp Nhất {qdFiles.length + realFiles.length} Ảnh Bằng Gemini AI</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* BÁO LỖI NẾU CÓ */}
                    {ocrError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2 text-xs text-rose-800 font-medium">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <span>{ocrError}</span>
                        </div>
                    )}

                    {/* BẢNG XEM TRƯỚC & RÀ SOÁT KẾT QUẢ */}
                    {extractedRecords.length > 0 && (
                        <div className="space-y-3 pt-2">
                            {/* Thẻ thống kê KPI bóc tách */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100 p-2.5 rounded-2xl border border-slate-200 text-xs">
                                <div className="bg-white p-2 rounded-xl border border-slate-200 text-center">
                                    <div className="text-[10px] text-slate-500 font-bold uppercase">Nhân sự</div>
                                    <div className="text-sm font-black text-slate-900">{summaryStats.totalEmp} NV</div>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-emerald-200 text-center">
                                    <div className="text-[10px] text-emerald-700 font-bold uppercase">Tổng DTQĐ</div>
                                    <div className="text-sm font-black text-emerald-700">{formatValue(summaryStats.totalQd)} tr</div>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-blue-200 text-center">
                                    <div className="text-[10px] text-blue-700 font-bold uppercase">Tổng DT Thực</div>
                                    <div className="text-sm font-black text-blue-800">{formatValue(summaryStats.totalActual)} tr</div>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-purple-200 text-center">
                                    <div className="text-[10px] text-purple-700 font-bold uppercase">Trả Góp (%TG)</div>
                                    <div className="text-sm font-black text-purple-700">{formatValue(summaryStats.totalInstallment)} tr ({summaryStats.avgInstRate}%)</div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-800 uppercase">
                                    Danh Sách Nhân Viên ({extractedRecords.length} Bạn)
                                </span>
                                <button
                                    type="button"
                                    onClick={handleAddRecord}
                                    className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-[11px] font-bold rounded-xl shadow-2xs flex items-center gap-1 cursor-pointer"
                                >
                                    <Plus className="w-3 h-3 text-blue-600" />
                                    <span>Thêm dòng</span>
                                </button>
                            </div>

                            {/* Bảng dữ liệu chi tiết */}
                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                                <div className="max-h-72 overflow-y-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="bg-slate-900 text-white font-black text-[10.5px] uppercase sticky top-0 z-10">
                                            <tr>
                                                <th className="px-2 py-2 w-8 text-center">#</th>
                                                <th className="px-2 py-2 w-20">Mã NV</th>
                                                <th className="px-2 py-2 min-w-[140px]">Họ và Tên Chuẩn</th>
                                                {selectedStore === 'all' && (
                                                    <th className="px-2 py-2 min-w-[100px] text-left">Siêu Thị</th>
                                                )}
                                                <th className="px-2 py-2 w-14 text-right">SL</th>
                                                <th className="px-2 py-2 w-20 text-right">DT Thực</th>
                                                <th className="px-2 py-2 w-20 text-right bg-[#005a43] text-[#fde047]">DTQĐ</th>
                                                <th className="px-2 py-2 w-20 text-right">T.Góp</th>
                                                <th className="px-2 py-2 w-14 text-right">% TG</th>
                                                <th className="px-2 py-2 w-8 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {extractedRecords.map((r, idx) => (
                                                <tr key={idx} className="hover:bg-blue-50/40 transition">
                                                    <td className="px-2 py-1.5 text-center text-slate-400 font-bold text-[11px]">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="px-2 py-1.5 font-mono font-bold text-blue-800">
                                                        <input
                                                            type="text"
                                                            value={r.employee_id}
                                                            onChange={e => handleUpdateRecord(idx, 'employee_id', e.target.value)}
                                                            className="w-full bg-transparent border-0 font-mono font-bold text-blue-800 text-xs focus:ring-1 focus:ring-blue-500 rounded px-1"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5 font-bold text-slate-900">
                                                        <input
                                                            type="text"
                                                            value={r.full_name}
                                                            onChange={e => handleUpdateRecord(idx, 'full_name', e.target.value)}
                                                            className="w-full bg-transparent border-0 font-bold text-slate-900 text-xs focus:ring-1 focus:ring-blue-500 rounded px-1"
                                                        />
                                                    </td>
                                                    {selectedStore === 'all' && (
                                                        <td className="px-2 py-1.5 text-slate-600 font-medium text-[11px] whitespace-nowrap">
                                                            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-bold">
                                                                {empStoreMap[r.employee_id?.trim()] ? getShortStoreName(empStoreMap[r.employee_id?.trim()]) : 'Chưa rõ'}
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-700">
                                                        <input
                                                            type="number"
                                                            value={r.quantity || ''}
                                                            onChange={e => handleUpdateRecord(idx, 'quantity', Number(e.target.value) || 0)}
                                                            className="w-full text-right bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-xs font-mono"
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-800">
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            value={r.revenue_actual}
                                                            onChange={e => handleUpdateRecord(idx, 'revenue_actual', e.target.value)}
                                                            className="w-full text-right bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-xs font-mono font-bold"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right font-mono font-black text-emerald-700 bg-emerald-50/50">
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            value={r.revenue_qd}
                                                            onChange={e => handleUpdateRecord(idx, 'revenue_qd', e.target.value)}
                                                            className="w-full text-right bg-white border border-emerald-300 rounded px-1 py-0.5 text-xs font-mono font-black text-emerald-800"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right font-mono font-bold text-purple-700">
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            value={r.installment_revenue}
                                                            onChange={e => handleUpdateRecord(idx, 'installment_revenue', e.target.value)}
                                                            className="w-full text-right bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-xs font-mono"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right font-mono font-bold text-purple-900">
                                                        {r.installment_rate}%
                                                    </td>
                                                    <td className="px-2 py-1.5 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteRecord(idx)}
                                                            className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                                                            title="Xóa dòng này"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. FOOTER HÀNH ĐỘNG */}
                <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <div className="text-xs text-slate-500 font-medium">
                        Đang nạp cho: <strong className="text-blue-700">{getShortStoreName(selectedStore)}</strong> • Ngày <strong className="text-emerald-700">{formatDate(reportDate)}</strong>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                        >
                            Đóng
                        </button>

                        <button
                            type="button"
                            onClick={handleApplyOnly}
                            disabled={extractedRecords.length === 0}
                            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 disabled:opacity-50 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                            title="Áp dụng số liệu vào báo cáo để xem trước mà chưa lưu Cloud"
                        >
                            <span>Áp Dụng Vào Báo Cáo</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleApplyAndSaveCloud}
                            disabled={isSavingCloud || extractedRecords.length === 0}
                            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition cursor-pointer"
                            title="Áp dụng vào báo cáo và lưu vĩnh viễn lên Supabase Cloud"
                        >
                            <Save className={`w-4 h-4 ${isSavingCloud ? 'animate-spin' : ''}`} />
                            <span>{isSavingCloud ? 'Đang lưu Cloud...' : '💾 Áp Dụng & Lưu Cloud Ngay'}</span>
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
        </div>
    );
}

