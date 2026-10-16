import React from 'react';
import {
    Sparkles,
    Plus,
    FileSpreadsheet,
    Camera,
    Copy,
    LayoutGrid,
    Table as TableIcon,
    Database,
    CheckCircle2,
    Layers,
    Target
} from 'lucide-react';
import type { ViewMode } from '../types';
import ReportActionButtons, { type AssessmentTemplate } from '../../../shared/components/report/ReportActionButtons';

interface Props {
    totalPrograms: number;
    activeCount: number;
    groupCount: number;
    selectedCount: number;
    viewMode: ViewMode;
    onToggleViewMode: (mode: ViewMode) => void;
    onOpenAddModal: () => void;
    onOpenPasteModal: () => void;
    onExportSelectedImage: () => void;
    onCopySelectedImage?: () => void;
    onCopyAllZaloText: () => void;
    onOpenSqlModal: () => void;
    isCloudReady: boolean;
    cloudSource: 'cloud' | 'local';
    canManage: boolean;
    isExporting: boolean;
    isCopyingImage?: boolean;
    copySuccess?: boolean;
    assessmentTemplates?: AssessmentTemplate[];
    periodLabel?: string;
    storeName?: string;
}

export default function CampaignDirectoryHeader({
    totalPrograms,
    activeCount,
    groupCount,
    selectedCount,
    viewMode,
    onToggleViewMode,
    onOpenAddModal,
    onOpenPasteModal,
    onExportSelectedImage,
    onCopySelectedImage,
    onCopyAllZaloText,
    onOpenSqlModal,
    isCloudReady,
    cloudSource,
    canManage,
    isExporting,
    isCopyingImage = false,
    copySuccess = false,
    assessmentTemplates,
    periodLabel = '',
    storeName = ''
}: Props) {
    return (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4 font-avo">
            {/* Hàng 1: Tiêu đề & Nút thao tác chính */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-lg text-[10.5px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xs flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>TRA CỨU THI ĐUA</span>
                        </span>

                        <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            Thể lệ & Định hướng
                        </span>

                        {/* Cloud Status Pill */}
                        <button
                            type="button"
                            onClick={onOpenSqlModal}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-bold border transition cursor-pointer ${
                                isCloudReady && cloudSource === 'cloud'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                            }`}
                            title="Bấm để xem trạng thái kết nối Cloud và mã SQL DDL"
                        >
                            <Database className="w-3 h-3 shrink-0" />
                            <span>{isCloudReady && cloudSource === 'cloud' ? '🟢 Supabase Cloud' : '🟡 Local Cache (SQL)'}</span>
                        </button>
                    </div>

                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        Cẩm Nang & Tra Cứu Chương Trình Thi Đua
                    </h1>
                    <p className="text-xs text-slate-500 font-medium">
                        Tra cứu thể lệ, định hướng, cách tính và các cơ hội khuyến mãi (CTKM) áp dụng cho siêu thị và nhân viên.
                    </p>
                </div>

                {/* Các nút hành động chính */}
                <div className="flex items-center gap-2 flex-wrap" data-export-ignore="true">
                    {/* Toggle Chế độ xem */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                        <button
                            type="button"
                            onClick={() => onToggleViewMode('CARD')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                viewMode === 'CARD'
                                    ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Xem dạng thẻ trực quan"
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Dạng thẻ</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onToggleViewMode('TABLE')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                viewMode === 'TABLE'
                                    ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Xem dạng bảng co gọn"
                        >
                            <TableIcon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Dạng bảng</span>
                        </button>
                    </div>

                    {/* Cụm button hành động chuẩn dùng chung: Xuất ảnh, Copy ảnh, Nhận xét 3 mẫu, Copy text */}
                    <ReportActionButtons
                        onExportImage={onExportSelectedImage}
                        onCopyImage={onCopySelectedImage}
                        onCopyText={onCopyAllZaloText}
                        isExporting={isExporting}
                        isCopyingImage={isCopyingImage}
                        copySuccess={copySuccess}
                        assessmentTemplates={assessmentTemplates}
                        reportTitle="Cẩm Nang & Tra Cứu Chương Trình Thi Đua"
                        periodLabel={periodLabel}
                        storeName={storeName}
                        exportLabel={isExporting ? 'Đang xuất...' : `Xuất Ảnh (${selectedCount || totalPrograms})`}
                        copyLabel="Copy Ảnh"
                        copyTextLabel="Chép Text Zalo"
                    />

                    {/* Dán Nhanh Excel & Thêm Mới (Cho Admin / Quản lý) */}
                    {canManage && (
                        <>
                            <button
                                type="button"
                                onClick={onOpenPasteModal}
                                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                title="Dán nhanh hàng loạt từ bảng Excel"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
                                <span className="hidden sm:inline">Dán Excel</span>
                            </button>

                            <button
                                type="button"
                                onClick={onOpenAddModal}
                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                title="Thêm chương trình thi đua mới"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Thêm Mới</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Hàng 2: Thẻ KPI Mini Tổng Quan */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 sm:p-3">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng chương trình</div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5">{totalPrograms}</div>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-2.5 sm:p-3">
                    <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Đang áp dụng</div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono mt-0.5">{activeCount}</div>
                </div>

                <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-2.5 sm:p-3">
                    <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Nhóm ngành hàng</div>
                    <div className="text-xl sm:text-2xl font-black text-blue-800 font-mono mt-0.5">{groupCount} nhóm</div>
                </div>

                <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-2.5 sm:p-3">
                    <div className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Đang chọn để xuất</div>
                    <div className="text-xl sm:text-2xl font-black text-indigo-800 font-mono mt-0.5">{selectedCount} CT</div>
                </div>
            </div>
        </div>
    );
}
