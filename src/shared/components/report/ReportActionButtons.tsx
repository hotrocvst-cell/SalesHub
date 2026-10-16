import React, { useState } from 'react';
import {
    Camera,
    Copy,
    Download,
    RefreshCw,
    MessageSquareText,
    Eye,
    EyeOff,
    Check,
    FileText,
    FileSpreadsheet
} from 'lucide-react';
import ReportAssessmentModal, { type AssessmentTemplate } from './ReportAssessmentModal';

export type { AssessmentTemplate };

export interface ReportActionButtonsProps {
    // 1. Chức năng Xuất Ảnh (Download PNG)
    onExportImage?: () => void | Promise<void>;
    isExporting?: boolean;
    exportButtonLabel?: string;
    exportLabel?: string; // alias

    // 2. Chức năng Copy Ảnh (Copy PNG vào Clipboard)
    onCopyImage?: () => void | Promise<void>;
    isCopying?: boolean;
    isCopyingImage?: boolean; // alias
    copyImageButtonLabel?: string;
    copyLabel?: string; // alias
    copySuccess?: boolean;

    // 3. Chức năng Nhận Xét Báo Cáo (1 - 3 mẫu tạo sẵn)
    hasAssessment?: boolean;
    onOpenAssessment?: () => void; // Nếu trang tự điều khiển modal riêng
    assessmentButtonLabel?: string;
    assessmentTemplates?: AssessmentTemplate[]; // Mảng 1-3 mẫu tạo sẵn
    currentComment?: string;
    showAssessmentOnReport?: boolean;
    onToggleShowAssessment?: (show: boolean) => void;
    hasAssessmentToggle?: boolean; // Hiển thị nút con HIỆN/ẨN kế bên nút Nhận Xét
    onSaveComment?: (comment: string, showOnReport: boolean) => void | Promise<boolean | void>;
    isSavingAssessment?: boolean;

    // 4. Các chức năng bổ sung (nếu có)
    onCopyText?: () => void;
    copyTextLabel?: string;
    onExportExcel?: () => void;
    canExportExcel?: boolean;

    // Thông tin ngữ cảnh báo cáo
    reportTitle?: string;
    periodLabel?: string;
    storeName?: string;
    className?: string;
}

export default function ReportActionButtons({
    onExportImage,
    isExporting = false,
    exportButtonLabel,
    exportLabel,
    onCopyImage,
    isCopying = false,
    isCopyingImage = false,
    copyImageButtonLabel,
    copyLabel,
    copySuccess,
    hasAssessment = true,
    onOpenAssessment,
    assessmentButtonLabel = 'NHẬN XÉT',
    assessmentTemplates,
    currentComment = '',
    showAssessmentOnReport = false,
    onToggleShowAssessment,
    hasAssessmentToggle = false,
    onSaveComment,
    isSavingAssessment = false,
    onCopyText,
    copyTextLabel = 'COPY CHỮ',
    onExportExcel,
    canExportExcel = false,
    reportTitle,
    periodLabel,
    storeName,
    className = ''
}: ReportActionButtonsProps) {
    const finalExportLabel = exportLabel || exportButtonLabel || 'TẢI ẢNH';
    const finalCopyLabel = copyLabel || copyImageButtonLabel || 'COPY ẢNH';
    const finalIsCopying = isCopying || isCopyingImage;
    const [isInternalModalOpen, setIsInternalModalOpen] = useState<boolean>(false);
    const [internalCopySuccess, setInternalCopySuccess] = useState<boolean>(false);

    // Xử lý mở Modal nhận xét
    const handleOpenAssessment = () => {
        if (onOpenAssessment) {
            onOpenAssessment();
        } else {
            setIsInternalModalOpen(true);
        }
    };

    // Xử lý wrap Copy ảnh có hiệu ứng phản hồi
    const handleCopyImageWrapped = async () => {
        if (!onCopyImage || isExporting || finalIsCopying) return;
        try {
            await onCopyImage();
            setInternalCopySuccess(true);
            setTimeout(() => setInternalCopySuccess(false), 2500);
        } catch (e) {
            console.error('Lỗi sao chép ảnh:', e);
        }
    };

    const templateCount = assessmentTemplates ? Math.min(assessmentTemplates.length, 3) : 3;

    return (
        <div
            data-export-ignore="true"
            data-html2canvas-ignore="true"
            className={`flex items-center gap-2 flex-wrap font-avo antialiased ${className}`}
        >
            {/* 1. BUTTON NHẬN XÉT & TÓM TẮT (TÙY CHỌN 1-3 MẪU TẠO SẴN) */}
            {hasAssessment && (
                <div className="flex items-center rounded-2xl border border-blue-200 bg-blue-50/80 shadow-2xs overflow-hidden">
                    <button
                        type="button"
                        onClick={handleOpenAssessment}
                        className="px-3.5 py-2 hover:bg-blue-100 text-blue-900 text-xs font-black flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                        title="Mở bảng Nhận xét và Tóm tắt báo cáo (Tùy chọn 1 đến 3 mẫu tạo sẵn)"
                    >
                        <MessageSquareText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>{assessmentButtonLabel}</span>
                        <span className="px-1.5 py-0.2 rounded-md bg-blue-200/90 text-blue-900 text-[10px] font-extrabold shrink-0">
                            {templateCount} mẫu
                        </span>
                    </button>

                    {/* Nút con bật tắt hiển thị nhận xét trên báo cáo (nếu kích hoạt) */}
                    {hasAssessmentToggle && onToggleShowAssessment && (
                        <button
                            type="button"
                            onClick={() => onToggleShowAssessment(!showAssessmentOnReport)}
                            className={`px-2.5 py-2 border-l border-blue-200 hover:bg-blue-200/70 transition cursor-pointer flex items-center gap-1 text-[11px] font-black ${
                                showAssessmentOnReport
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title={
                                showAssessmentOnReport
                                    ? 'Đang BẬT hiển thị nhận xét trên báo cáo & ảnh xuất'
                                    : 'Đang ẨN nhận xét khỏi báo cáo (mặc định)'
                            }
                        >
                            {showAssessmentOnReport ? (
                                <Eye className="w-3.5 h-3.5 text-white" />
                            ) : (
                                <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span>{showAssessmentOnReport ? 'HIỆN' : 'ẨN'}</span>
                        </button>
                    )}
                </div>
            )}

            {/* 2. CỤM NÚT XUẤT ẢNH & COPY ẢNH BÁO CÁO (CHUẨN HÓA DỌC SMARTPHONE) */}
            {(onExportImage || onCopyImage) && (
                <div className="flex items-center rounded-2xl shadow-sm overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                    {/* Nút Xuất ảnh (Tải PNG) */}
                    {onExportImage && (
                        <button
                            type="button"
                            onClick={onExportImage}
                            disabled={isExporting || finalIsCopying}
                            className="px-3.5 py-2 hover:from-emerald-700 hover:to-teal-700 text-xs font-black flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 active:scale-95"
                            title="Tải ảnh báo cáo về máy (Chuẩn kích thước dọc smartphone, không watermark)"
                        >
                            {isExporting ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-amber-200" />
                            ) : (
                                <Camera className="w-4 h-4 text-emerald-100" />
                            )}
                            <span>{isExporting ? 'ĐANG XUẤT...' : finalExportLabel}</span>
                        </button>
                    )}

                    {/* Nút Copy ảnh vào Clipboard */}
                    {onCopyImage && (
                        <button
                            type="button"
                            onClick={handleCopyImageWrapped}
                            disabled={isExporting || finalIsCopying}
                            className={`px-3 py-2 border-l border-emerald-500 hover:bg-emerald-700 text-xs font-black flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 active:scale-95 ${
                                (copySuccess ?? internalCopySuccess) ? 'bg-emerald-800 text-white' : ''
                            }`}
                            title="Sao chép ảnh báo cáo vào Clipboard để dán nhanh (Ctrl+V) vào Zalo"
                        >
                            {finalIsCopying ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-amber-200" />
                            ) : (copySuccess ?? internalCopySuccess) ? (
                                <Check className="w-4 h-4 text-amber-300" />
                            ) : (
                                <Copy className="w-4 h-4 text-emerald-100" />
                            )}
                            <span>{(copySuccess ?? internalCopySuccess) ? 'ĐÃ COPY!' : finalCopyLabel}</span>
                        </button>
                    )}
                </div>
            )}

            {/* 3. NÚT COPY CHỮ / COPY ZALO TEXT (NẾU CÓ) */}
            {onCopyText && (
                <button
                    type="button"
                    onClick={onCopyText}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-2xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-95"
                    title="Sao chép toàn bộ văn bản tóm tắt vào bộ nhớ tạm"
                >
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>{copyTextLabel}</span>
                </button>
            )}

            {/* 4. NÚT XUẤT EXCEL (CHỈ HIỆN KHI ĐƯỢC CẤP QUYỀN THEO QUY CHUẨN MỤC 9) */}
            {canExportExcel && onExportExcel && (
                <button
                    type="button"
                    onClick={onExportExcel}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-2xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-95"
                    title="Xuất file Excel báo cáo chi tiết"
                >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    <span>EXCEL</span>
                </button>
            )}

            {/* MODAL NHẬN XÉT DÙNG CHUNG TÍCH HỢP */}
            {!onOpenAssessment && (
                <ReportAssessmentModal
                    isOpen={isInternalModalOpen}
                    onClose={() => setIsInternalModalOpen(false)}
                    reportTitle={reportTitle}
                    periodLabel={periodLabel}
                    templates={assessmentTemplates}
                    initialComment={currentComment}
                    showAssessmentOnReport={showAssessmentOnReport}
                    onToggleShowAssessment={onToggleShowAssessment}
                    onSaveComment={onSaveComment}
                    isSaving={isSavingAssessment}
                />
            )}
        </div>
    );
}
