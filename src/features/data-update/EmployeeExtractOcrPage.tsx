import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';
import {
    fetchStores,
    fetchEmployees,
    type StoreItem,
    type EmployeeItem
} from '../../core/lib/storage';
import {
    getYesterdayDateString,
    formatDate,
    formatDateTime,
    formatValue,
    getShortStoreName
} from '../../core/lib/formatters';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import OcrUploadZone from './components/OcrUploadZone';
import EmployeeManualDataEntryModule from './components/EmployeeManualDataEntryModule';
import GeminiApiKeyModal from './components/GeminiApiKeyModal';
import {
    extractAndMergeEmployeeImages,
    extractAdditionalEmulationImages,
    convertOcrItemsToSessionRecords,
    convertSessionRecordsToOcrItems,
    type EmployeeOcrParsedItem
} from './services/geminiEmployeeOcrService';
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
import type { OcrEngineType } from './types/ocrTypes';
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
    Clock
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

    // 2. Siêu thị & Danh mục nhân sự
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [selectedStore, setSelectedStore] = useState<string>('');
    const [systemEmployees, setSystemEmployees] = useState<EmployeeItem[]>([]);

    // 3. Tab chuyển đổi
    const [activeTab, setActiveTab] = useState<'ocr' | 'manual'>('ocr');

    // 4. File tải lên
    const [qdFile, setQdFile] = useState<File | null>(null);
    const [realFile, setRealFile] = useState<File | null>(null);
    const [emulationFiles, setEmulationFiles] = useState<File[]>([]);

    // 5. Cấu hình Gemini Key & Engine
    const [engineType, setEngineType] = useState<OcrEngineType>('GEMINI_FLASH');
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
    const [isCheckingDuplicate, setIsCheckingDuplicate] = useState<boolean>(false);

    // 9. Quét bổ sung ảnh thi đua
    const [isScanningAdditional, setIsScanningAdditional] = useState<boolean>(false);
    const [additionalProgressText, setAdditionalProgressText] = useState<string>('');

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
                if (!selectedStore) {
                    setSelectedStore(res.data[0].name);
                }
            }
        });

        fetchEmployees().then(res => {
            if (res.success && res.data) {
                setSystemEmployees(res.data);
            }
        });

        checkSupabaseSessionTable().then(res => {
            setCloudTableReady(res.exists);
        });
    }, []);

    // Tự động kiểm tra xem đã tồn tại phiên dữ liệu cho Siêu thị & Ngày chốt này chưa
    useEffect(() => {
        if (!selectedStore || !reportDate) return;
        let isMounted = true;
        setIsCheckingDuplicate(true);

        findExistingEmployeeSession(selectedStore, reportDate, 'REVENUE_CAMPAIGN')
            .then(found => {
                if (isMounted) {
                    setExistingSession(found);
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
        if (engineType === 'GEMINI_FLASH' && !activeKey) {
            setIsKeyModalOpen(true);
            return;
        }

        if (!qdFile && !realFile && emulationFiles.length === 0) {
            showToast('⚠️ Vui lòng chọn ít nhất 1 ảnh (DT-QĐ, DT-THỰC hoặc Thi đua)!');
            return;
        }

        setIsExtracting(true);
        setOcrError('');
        setProgressText('Đang kết nối Gemini Vision...');
        setProgressPercent(10);

        try {
            const result = await extractAndMergeEmployeeImages(
                activeKey,
                { qdFile, realFile, emulationFiles },
                systemEmployees,
                (msg, pct) => {
                    setProgressText(msg);
                    setProgressPercent(pct);
                },
                keyInfo.source
            );

            if (!result.success || result.employees.length === 0) {
                setOcrError(result.errors?.join('; ') || 'Không thể trích xuất số liệu nhân viên từ ảnh đã chọn.');
                setIsExtracting(false);
                return;
            }

            if (result.screenshotTimestamp) {
                setScreenshotTimestamp(result.screenshotTimestamp);
            }

            setEmployeesData(result.employees);
            setIsQuotaExceeded(false);
            setProgressPercent(100);
            setProgressText('Trích xuất thành công! Đang chuyển sang bảng rà soát...');
            showToast(`✅ Đã bóc tách thành công ${result.employees.length} nhân viên!`);

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
            showToast('⚠️ Vui lòng chọn Siêu thị trước khi lưu phiên!');
            return;
        }

        if (employeesData.length === 0) {
            showToast('⚠️ Chưa có dữ liệu nhân viên để lưu!');
            return;
        }

        setIsSaving(true);
        try {
            const storeShortName = getShortStoreName(selectedStore);
            const totalActual = employeesData.reduce((s, e) => s + (Number(e.revenueReal) || 0), 0);
            const totalQd = employeesData.reduce((s, e) => s + (Number(e.revenueQd) || 0), 0);

            const sessionRecords = convertOcrItemsToSessionRecords(employeesData, selectedStore);

            const sessionPayload = {
                session_type: 'REVENUE_CAMPAIGN' as const,
                session_title: `Phiên Doanh Thu & Thi Đua NV - ${storeShortName} - Ngày ${formatDate(reportDate)}`,
                store_name: selectedStore,
                month: selectedMonth,
                year: selectedYear,
                report_date: reportDate,
                created_by: userDisplayName,
                employee_count: sessionRecords.length,
                total_revenue_actual: totalActual,
                total_revenue_qd: totalQd,
                total_work_hours: 0,
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

            setExistingSession(res.session);
            showToast(isOverwrite
                ? `🔄 Đã ghi đè & cập nhật thành công phiên ${sessionRecords.length} nhân viên!`
                : `🎉 Đã lưu thành công phiên mới ${sessionRecords.length} nhân viên lên Cloud!`
            );
            setIsSaving(false);
        } catch (err: any) {
            console.error('Lỗi khi lưu phiên nhân viên:', err);
            showToast(`⚠️ Lỗi khi lưu: ${err?.message || 'Không thể kết nối'}`);
            setIsSaving(false);
        }
    };

    // Nạp lại dữ liệu từ phiên đã có vào bảng rà soát
    const handleRestoreExistingSession = () => {
        if (!existingSession || !existingSession.records || existingSession.records.length === 0) {
            showToast('⚠️ Phiên này không có bản ghi nhân viên nào!');
            return;
        }
        const items = convertSessionRecordsToOcrItems(existingSession.records);
        setEmployeesData(items);
        setActiveTab('manual');
        showToast(`📥 Đã nạp thành công ${items.length} nhân viên từ phiên ngày ${formatDate(reportDate)}!`);
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
                systemEmployees,
                (msg) => setAdditionalProgressText(msg),
                keyInfo.source
            );

            if (result.success && result.employees.length > 0) {
                setEmployeesData(result.employees);
                showToast(`🎉 Đã quét & bổ sung thành công ${additionalFiles.length} ảnh thi đua!`);
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

    const handleCopySql = () => {
        navigator.clipboard.writeText(EMPLOYEE_DATA_SESSIONS_SQL);
        setIsSqlCopied(true);
        setTimeout(() => setIsSqlCopied(false), 2000);
    };

    return (
        <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-4">
            {/* Toast popup */}
            {toastMessage && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-2xl z-50 animate-bounce">
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
                            Trích xuất số liệu nhân viên từ ảnh chụp BI (DTQĐ, DT Thực, Thi đua) • Lưu phiên lũy kế liên tiếp
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
                        onClick={() => navigate('/quan-ly-phien-nhan-vien')}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
                    >
                        <History className="w-3.5 h-3.5 text-blue-600" />
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

            {/* THANH ĐIỀU KHIỂN & BỘ LỌC (QUY CHUẨN 10: SIÊU THỊ HÀNG ĐẦU TIÊN) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-3">
                {/* Dòng 1: Chọn Siêu Thị Riêng Biệt */}
                <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                        <Store className="w-3.5 h-3.5 text-blue-600" />
                        <span>Đơn Vị / Siêu Thị Áp Dụng</span>
                    </label>
                    <select
                        value={selectedStore}
                        onChange={(e) => setSelectedStore(e.target.value)}
                        className="w-full bg-white border border-slate-300 text-slate-800 py-2 px-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
                    >
                        {stores.map(s => (
                            <option key={s.id || s.code} value={s.name}>{s.name}</option>
                        ))}
                    </select>
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
                                    <span className="font-bold text-amber-900">
                                        Đã có phiên ngày {formatDate(reportDate)} ({existingSession.employee_count} NV • DT Thực: {formatValue(existingSession.total_revenue_actual)} tr)
                                    </span>
                                    <span className="text-[11px] text-amber-700 block">
                                        Nạp bởi: {existingSession.created_by} lúc {formatDateTime(existingSession.created_at)}
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleRestoreExistingSession}
                                className="px-3 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
                            >
                                <RotateCcw className="w-3 h-3 text-amber-600" />
                                <span>Xem Lại Phiên Đang Có</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold py-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Chưa có phiên cho ngày {formatDate(reportDate)} tại {getShortStoreName(selectedStore)} • Sẵn sàng tạo phiên mới.</span>
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
                        qdFile={qdFile}
                        onQdFileChange={setQdFile}
                        realFile={realFile}
                        onRealFileChange={setRealFile}
                        emulationFiles={emulationFiles}
                        onEmulationFilesChange={setEmulationFiles}
                        engineType={engineType}
                        onEngineTypeChange={setEngineType}
                        hasGeminiKey={Boolean(keyInfo.key)}
                        keySource={keyInfo.source}
                        isQuotaExceeded={isQuotaExceeded}
                        onOpenKeyModal={() => setIsKeyModalOpen(true)}
                        onRunOcr={handleRunOcr}
                        isExtracting={isExtracting}
                        progressText={progressText}
                        progressPercent={progressPercent}
                    />
                </div>
            ) : (
                <EmployeeManualDataEntryModule
                    employees={employeesData}
                    onChangeEmployees={setEmployeesData}
                    storeName={selectedStore}
                    reportDate={reportDate}
                    onSaveToSupabase={handleSaveToCloud}
                    isSaving={isSaving}
                    existingSession={existingSession}
                    isCheckingExisting={isCheckingDuplicate}
                    onRestoreExistingSession={handleRestoreExistingSession}
                    onScanAdditionalEmulation={handleScanAdditionalEmulation}
                    isScanningAdditional={isScanningAdditional}
                    additionalProgressText={additionalProgressText}
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
