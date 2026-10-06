import React from 'react';
import { Store, Calendar, RefreshCw, Camera, Layers, Clock } from 'lucide-react';
import type { StoreItem } from '../../../core/lib/storage';
import type { EmployeeDataSession } from '../../employee-cumulative/utils/sessionStorage';
import { useUserStoreFilter } from '../../../shared/hooks/useUserStoreFilter';
import { formatDate } from '../../../core/lib/formatters';

interface Props {
    selectedMonth: number;
    setSelectedMonth: (m: number) => void;
    selectedYear: number;
    setSelectedYear: (y: number) => void;
    selectedStore: string;
    setSelectedStore: (s: string) => void;
    stores: StoreItem[];
    sessions: EmployeeDataSession[];
    selectedSessionId: string;
    setSelectedSessionId: (id: string) => void;
    activeSession?: EmployeeDataSession;
    operatingConfig: {
        passedDays: number;
        operatingDays: number;
    };
    loading: boolean;
    onRefresh: () => void;
    onExportImage: () => void;
    isExporting: boolean;
    totalTablesCount?: number;
}

export default function CampaignProgressHeader({
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    selectedStore,
    setSelectedStore,
    stores,
    sessions,
    selectedSessionId,
    setSelectedSessionId,
    activeSession,
    operatingConfig,
    loading,
    onRefresh,
    onExportImage,
    isExporting,
    totalTablesCount = 0
}: Props) {
    const { allowedStores } = useUserStoreFilter(stores, selectedStore, setSelectedStore);

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-2xs space-y-3">
            {/* Hàng 1: Tiêu đề và nút Tác vụ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                            <Clock className="w-4 h-4" />
                        </span>
                        <h1 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                            BÁO CÁO TIẾN ĐỘ THI ĐUA NHÂN VIÊN
                        </h1>
                    </div>
                    <p className="text-xs text-slate-500">
                        Theo dõi chỉ tiêu, tiến độ hoàn thành và dự kiến về đích các chương trình thi đua theo nhân sự
                    </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={loading}
                        className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
                        title="Tải lại dữ liệu"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
                    </button>

                    <button
                        type="button"
                        onClick={onExportImage}
                        disabled={isExporting || loading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
                        title="Xuất tất cả các bảng thi đua đang được chọn xem thành 1 ảnh dài gửi Zalo"
                    >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{isExporting ? 'Đang xuất toàn bộ...' : `Xuất tất cả (${totalTablesCount} bảng)`}</span>
                    </button>
                </div>
            </div>

            {/* Hàng 2: Bộ lọc Tháng/Năm, Siêu thị, Phiên dữ liệu */}
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-0.5 text-xs">
                {/* 1. Chọn Tháng & Năm */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-500">Tháng:</span>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <option key={m} value={m}>T{m}</option>
                        ))}
                    </select>
                    <span className="text-slate-300">/</span>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                    >
                        {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <span className="ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        {operatingConfig.passedDays}/{operatingConfig.operatingDays}N
                    </span>
                </div>

                {/* 2. Chọn Siêu thị */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                    <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-500">Shop:</span>
                    <select
                        value={selectedStore}
                        onChange={(e) => setSelectedStore(e.target.value)}
                        className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer flex-1 truncate"
                    >
                        <option value="all">🏢 Toàn Cụm Siêu Thị</option>
                        {allowedStores.map(s => (
                            <option key={s.id || s.name} value={s.name}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 3. Chọn Phiên dữ liệu */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 sm:col-span-1 lg:col-span-2">
                    <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-500">Phiên:</span>
                    <select
                        value={selectedSessionId || activeSession?.id || ''}
                        onChange={(e) => setSelectedSessionId(e.target.value)}
                        className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer flex-1 truncate"
                    >
                        {sessions.length === 0 ? (
                            <option value="">Chưa có phiên dữ liệu thi đua</option>
                        ) : (
                            sessions.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.session_title || `Phiên ngày ${formatDate(s.report_date)} (${s.store_name})`}
                                </option>
                            ))
                        )}
                    </select>
                </div>
            </div>
        </div>
    );
}
