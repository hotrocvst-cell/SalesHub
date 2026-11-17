import React, { useMemo } from 'react';
import type { EmployeePerformanceRow, StorePerformanceSummary } from '../../../employee-performance/types';
import PerformanceKpiCards from '../../../employee-performance/components/PerformanceKpiCards';
import PerformanceTable from '../../../employee-performance/components/PerformanceTable';
import { getShortStoreName, formatDate } from '../../../../core/lib/formatters';

interface Props {
    rows: EmployeePerformanceRow[];
    summary: StorePerformanceSummary | null;
    selectedStore: string;
    selectedMonth: number;
    selectedYear: number;
    showWorkHours?: boolean;
    sortBy?: 'forecast' | 'revenue_qd' | 'actual' | 'installment';
}

export default function EmployeePerformanceExportCard({
    rows,
    summary,
    selectedStore,
    selectedMonth,
    selectedYear,
    showWorkHours = false,
    sortBy = 'forecast'
}: Props) {
    const storeLabel = getShortStoreName(selectedStore);

    // Sắp xếp danh sách theo tùy chọn của người dùng
    const sortedRows = useMemo(() => {
        if (!rows || rows.length === 0) return [];
        const copy = [...rows];
        switch (sortBy) {
            case 'forecast':
                return copy.sort((a, b) => b.forecast_completion_rate - a.forecast_completion_rate);
            case 'revenue_qd':
                return copy.sort((a, b) => b.revenue_qd - a.revenue_qd);
            case 'actual':
                return copy.sort((a, b) => b.revenue_actual - a.revenue_actual);
            case 'installment':
                return copy.sort((a, b) => b.installment_revenue - a.installment_revenue);
            default:
                return copy;
        }
    }, [rows, sortBy]);

    if (!rows || rows.length === 0) {
        return (
            <div className="w-[880px] bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2 font-avo">
                <h3 className="text-base font-black text-slate-800 uppercase">
                    Báo Cáo Hiệu Quả Nhân Viên • ST {storeLabel}
                </h3>
                <p className="text-xs text-slate-500">
                    Chưa có phiên dữ liệu nhân sự được nạp cho ST này trong tháng {selectedMonth}/{selectedYear}.
                </p>
            </div>
        );
    }

    return (
        <div
            data-report-table="true"
            className="w-[880px] bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 font-avo text-slate-800"
        >
            {/* Header Báo Cáo */}
            <div className="text-center pb-3 border-b-2 border-indigo-600">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-black uppercase tracking-wider">
                        BÁO CÁO HIỆU QUẢ NHÂN VIÊN LŨY KẾ
                    </div>
                </div>
                <h2 className="text-xl font-black text-indigo-800 uppercase tracking-wide">
                    ST: {storeLabel}
                </h2>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Kỳ tháng: Tháng {selectedMonth}/{selectedYear} • Quy mô: {rows.length} nhân sự
                    {showWorkHours ? ' • Bao gồm giờ công & năng suất' : ''}
                </p>
            </div>

            {/* Thẻ Vinh Danh Thành Tích Cá Nhân Xuất Sắc (Thẻ năng suất ẩn/hiện theo toggle showWorkHours) */}
            {summary && (
                <div className="font-avo">
                    <PerformanceKpiCards summary={summary} showWorkHours={showWorkHours} />
                </div>
            )}

            {/* Bảng Xếp Hạng & Năng Suất Chi Tiết (Chuẩn PerformanceTable của phân hệ nhân sự) */}
            <div className="font-avo">
                <PerformanceTable
                    rows={sortedRows}
                    showStoreName={false}
                    showWorkHours={showWorkHours}
                />
            </div>
        </div>
    );
}
