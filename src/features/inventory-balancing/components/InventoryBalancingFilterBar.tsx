import React, { useRef, useState, useMemo } from 'react';
import {
    Store,
    UploadCloud,
    FileSpreadsheet,
    RefreshCw,
    Camera,
    Download,
    CheckCircle2,
    Sparkles,
    AlertCircle,
    ArrowRight,
    Search,
    Clock,
    Flame,
    TrendingUp,
    X
} from 'lucide-react';

interface InventoryBalancingFilterBarProps {
    storesList: string[];
    targetStore: string;
    onTargetStoreChange: (store: string) => void;
    activeStep: 1 | 2 | 3;
    onStepChange: (step: 1 | 2 | 3) => void;
    onFileUpload: (file: File) => void;
    onResetData: () => void;
    onExportImage: () => void;
    onExportExcel?: () => void;
    onOpenHistory?: () => void;
    savedOrdersCount?: number;
    canExportExcel?: boolean;
    isExportingImage?: boolean;
    isLoadingData?: boolean;
    totalRows: number;
    shortageCount: number;
    selectedShortageCount: number;
    matchingSourcesCount: number;
    matchedSuggestionsCount: number;
    totalMasterProductsCount?: number;
    totalFileStoresCount?: number;
    currentUserStoreNotice?: string;
    onSalesFileUpload?: (file: File) => void;
    salesVelocityCount?: number;
    totalSalesQty?: number;
    salesVelocityFileName?: string;
    onClearSalesVelocity?: () => void;
    isParsingSales?: boolean;
}

export default function InventoryBalancingFilterBar({
    storesList,
    targetStore,
    onTargetStoreChange,
    activeStep,
    onStepChange,
    onFileUpload,
    onResetData,
    onExportImage,
    onExportExcel,
    onOpenHistory,
    savedOrdersCount = 0,
    canExportExcel = false,
    isExportingImage = false,
    isLoadingData = false,
    totalRows,
    shortageCount,
    selectedShortageCount,
    matchingSourcesCount,
    matchedSuggestionsCount,
    totalMasterProductsCount = 0,
    totalFileStoresCount = 0,
    currentUserStoreNotice,
    onSalesFileUpload,
    salesVelocityCount = 0,
    totalSalesQty = 0,
    salesVelocityFileName,
    onClearSalesVelocity,
    isParsingSales = false
}: InventoryBalancingFilterBarProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const salesFileInputRef = useRef<HTMLInputElement>(null);
    const [storeSearch, setStoreSearch] = useState<string>('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onFileUpload(file);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleSalesFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onSalesFileUpload) {
            onSalesFileUpload(file);
            if (salesFileInputRef.current) {
                salesFileInputRef.current.value = '';
            }
        }
    };

    const filteredStores = useMemo(() => {
        if (!storeSearch.trim()) return storesList;
        const norm = storeSearch.toLowerCase().trim();
        return storesList.filter(s => s.toLowerCase().includes(norm));
    }, [storesList, storeSearch]);

    return (
        <div className="space-y-3 mb-4" data-export-ignore="true" data-html2canvas-ignore="true">
            {/* Ẩn input file tồn kho */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Ẩn input file sức bán */}
            <input
                ref={salesFileInputRef}
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleSalesFileChange}
            />

            {/* DÒNG 1 ĐỘC LẬP THEO QUY CHUẨN RULE 10: SIÊU THỊ ĐANG PHỤ TRÁCH ĐẦU TIÊN VÀ RIÊNG LẺ */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* BỘ LỌC SIÊU THỊ PHỤ TRÁCH */}
                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="p-2 rounded-lg bg-blue-100 text-blue-700">
                                <Store className="w-5 h-5" />
                            </span>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Siêu thị phụ trách (Xin hàng)
                                </label>
                                <span className="text-[11px] text-slate-500">
                                    {storesList.length > 0 ? (
                                        <span>
                                            <b>{storesList.length}</b> kho phụ trách
                                            {totalFileStoresCount > storesList.length ? ` (từ ${totalFileStoresCount} kho)` : ''}
                                            {totalRows === 0 && <span className="text-blue-600 font-semibold"> • Chọn để xem cấu hình/lệnh đã lưu</span>}
                                        </span>
                                    ) : (
                                        totalRows > 0 ? 'Không khớp siêu thị' : 'Chưa có siêu thị phụ trách'
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 max-w-xl">
                            {storesList.length > 0 ? (
                                <div className="flex flex-col sm:flex-row gap-1.5 w-full">
                                    {storesList.length > 6 && (
                                        <div className="relative w-full sm:w-44 shrink-0">
                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                value={storeSearch}
                                                onChange={(e) => setStoreSearch(e.target.value)}
                                                placeholder="Lọc nhanh ST..."
                                                className="w-full h-10 pl-7 pr-2 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    )}
                                    <select
                                        value={targetStore}
                                        onChange={(e) => onTargetStoreChange(e.target.value)}
                                        className="w-full h-10 px-3 text-xs sm:text-sm font-semibold rounded-lg border border-slate-300 bg-slate-50 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    >
                                        <option value="" disabled>-- Chọn siêu thị đang phụ trách --</option>
                                        {filteredStores.map(st => (
                                            <option key={st} value={st}>
                                                {st}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : totalRows > 0 ? (
                                <div className="text-xs text-rose-700 bg-rose-50 px-3 py-2 rounded-lg border border-rose-200 flex items-center gap-1.5">
                                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                                    <span>
                                        {currentUserStoreNotice || `Tài khoản của bạn không được phân quyền phụ trách siêu thị nào trong ${totalFileStoresCount} kho của file này.`}
                                    </span>
                                </div>
                            ) : (
                                <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 flex items-center gap-1.5">
                                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                                    <span>Vui lòng tải lên file Excel tồn kho để bắt đầu</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* HÀNG NÚT HÀNH ĐỘNG GÓC PHẢI */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Nút Lịch sử các phiên xin hàng */}
                        {onOpenHistory && (
                            <button
                                type="button"
                                onClick={onOpenHistory}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors cursor-pointer"
                                title="Xem lịch sử các phiên xin hàng đã lưu & khôi phục phiên cũ"
                            >
                                <Clock className="w-4 h-4 text-amber-700" />
                                <span className="hidden sm:inline">Lịch sử phiên</span>
                                <span className="sm:hidden">Lịch sử</span>
                                {savedOrdersCount > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black">
                                        {savedOrdersCount}
                                    </span>
                                )}
                            </button>
                        )}

                        {/* Nút Upload file Sức Bán */}
                        {onSalesFileUpload && (
                            <div className="inline-flex items-center">
                                {salesVelocityCount > 0 ? (
                                    <div className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 shadow-2xs overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => salesFileInputRef.current?.click()}
                                            disabled={isParsingSales}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
                                            title={`File sức bán: ${salesVelocityFileName || ''} (${salesVelocityCount} mã có sức bán). Bấm để tải lại file mới`}
                                        >
                                            <Flame className="w-4 h-4 text-amber-600 fill-amber-500" />
                                            <span>Sức Bán: <b>{salesVelocityCount}</b> mã</span>
                                        </button>
                                        {onClearSalesVelocity && (
                                            <button
                                                type="button"
                                                onClick={onClearSalesVelocity}
                                                className="px-1.5 py-2 text-amber-600 hover:text-rose-600 hover:bg-amber-100 border-l border-amber-200 transition-colors cursor-pointer"
                                                title="Hủy nạp dữ liệu sức bán"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => salesFileInputRef.current?.click()}
                                        disabled={isParsingSales}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-900 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-300 shadow-xs rounded-lg transition-all cursor-pointer"
                                        title="Tải lên file Excel phân tích sức bán sản phẩm (filemau_sucban.xlsx)"
                                    >
                                        <Flame className="w-4 h-4 text-amber-600" />
                                        <span>{isParsingSales ? 'Đang đọc...' : 'Tải File Sức Bán'}</span>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Nút Upload file tồn kho */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoadingData}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs rounded-lg transition-colors cursor-pointer"
                            title="Tải lên file Excel tồn kho (.xlsx, .xls)"
                        >
                            <UploadCloud className="w-4 h-4 text-white" />
                            <span>Tải Excel Tồn Kho</span>
                        </button>


                        {/* Nút Xuất Excel (Chỉ hiển thị nếu được phân quyền) */}
                        {canExportExcel && (
                            <button
                                type="button"
                                onClick={onExportExcel}
                                disabled={totalRows === 0}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                                title="Xuất toàn bộ bảng gợi ý ra file Excel"
                            >
                                <Download className="w-4 h-4 text-emerald-600" />
                                <span>Excel</span>
                            </button>
                        )}

                        {/* Nút Làm mới */}
                        <button
                            type="button"
                            onClick={onResetData}
                            disabled={isLoadingData || totalRows === 0}
                            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors disabled:opacity-40 cursor-pointer"
                            title="Xóa dữ liệu & làm mới"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* THÔNG TIN FILE NẠP */}
                {(totalRows > 0 || salesVelocityCount > 0) && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            {totalRows > 0 && (
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Đã nạp {totalRows.toLocaleString('vi-VN')} dòng tồn
                                </span>
                            )}
                            {totalMasterProductsCount > 0 && (
                                <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                    {totalMasterProductsCount.toLocaleString('vi-VN')} mã SP (đã lọc duy nhất)
                                </span>
                            )}
                            {salesVelocityCount > 0 && (
                                <span className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300">
                                    <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                                    Sức bán: {salesVelocityCount.toLocaleString('vi-VN')} mã ({totalSalesQty.toLocaleString('vi-VN')} máy)
                                </span>
                            )}
                            {storesList.length > 0 && (
                                <span>• {storesList.length} kho phụ trách {totalFileStoresCount > storesList.length ? `(từ ${totalFileStoresCount} kho)` : ''}</span>
                            )}
                        </div>
                        <div className="text-slate-400 italic">
                            Tồn kho: Tên ST, Mã SP, Tên SP, Ngành, Nhóm • Sức bán: Cột N='Đã xuất' & AS='Chưa trả' (Tổng AJ)
                        </div>
                    </div>
                )}
            </div>

            {/* DÒNG 2: THANH ĐIỀU HƯỚNG 3 BƯỚC QUY TRÌNH (STEP INDICATOR TỐI ƯU SMARTPHONE) */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {/* BƯỚC 1 */}
                <button
                    type="button"
                    onClick={() => onStepChange(1)}
                    className={`flex flex-col sm:flex-row items-center sm:items-center justify-center sm:justify-start gap-1 sm:gap-2.5 p-2 sm:px-3 sm:py-2.5 rounded-xl border text-left transition-all cursor-pointer ${activeStep === 1
                            ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${activeStep === 1 ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                        1
                    </span>
                    <div className="text-center sm:text-left min-w-0">
                        <div className={`text-[11px] sm:text-xs font-bold truncate ${activeStep === 1 ? 'text-white' : 'text-slate-800'
                            }`}>
                            Hàng thiếu (&lt; 1)
                        </div>
                        <div className={`text-[10px] hidden sm:block truncate ${activeStep === 1 ? 'text-blue-100' : 'text-slate-500'
                            }`}>
                            Đã chọn: <b className="font-bold">{selectedShortageCount}</b> / {shortageCount} mã
                        </div>
                    </div>
                </button>

                {/* BƯỚC 2 */}
                <button
                    type="button"
                    onClick={() => onStepChange(2)}
                    className={`flex flex-col sm:flex-row items-center sm:items-center justify-center sm:justify-start gap-1 sm:gap-2.5 p-2 sm:px-3 sm:py-2.5 rounded-xl border text-left transition-all cursor-pointer ${activeStep === 2
                            ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${activeStep === 2 ? 'bg-white text-blue-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                        2
                    </span>
                    <div className="text-center sm:text-left min-w-0">
                        <div className={`text-[11px] sm:text-xs font-bold truncate ${activeStep === 2 ? 'text-white' : 'text-slate-800'
                            }`}>
                            Kho có hàng (≥ 2)
                        </div>
                        <div className={`text-[10px] hidden sm:block truncate ${activeStep === 2 ? 'text-blue-100' : 'text-slate-500'
                            }`}>
                            Khớp <b className="font-bold">{matchingSourcesCount}</b> siêu thị
                        </div>
                    </div>
                </button>

                {/* BƯỚC 3 */}
                <button
                    type="button"
                    onClick={() => onStepChange(3)}
                    className={`flex flex-col sm:flex-row items-center sm:items-center justify-center sm:justify-start gap-1 sm:gap-2.5 p-2 sm:px-3 sm:py-2.5 rounded-xl border text-left transition-all cursor-pointer ${activeStep === 3
                            ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${activeStep === 3 ? 'bg-white text-blue-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                        3
                    </span>
                    <div className="text-center sm:text-left min-w-0">
                        <div className={`text-[11px] sm:text-xs font-bold truncate ${activeStep === 3 ? 'text-white' : 'text-slate-800'
                            }`}>
                            Gợi ý xin hàng
                        </div>
                        <div className={`text-[10px] hidden sm:block truncate ${activeStep === 3 ? 'text-blue-100' : 'text-slate-500'
                            }`}>
                            Có nguồn: <b className="font-bold text-amber-300">{matchedSuggestionsCount}</b> mã
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );
}
