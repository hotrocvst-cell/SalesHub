import { useState, useMemo } from 'react';
import type { ParsedEmployeeRevenue, ParsedCampaignBlock } from '../utils/employeeParsers';
import type { EmployeeItem } from '../../../core/lib/storage';
import { Download, Search, Clock, Store } from 'lucide-react';
import ExcelJS from 'exceljs';

interface Props {
    employees: EmployeeItem[];
    revenueData: ParsedEmployeeRevenue[];
    campaignBlocks: ParsedCampaignBlock[];
    campaignMatrix: Record<string, Record<string, number>>;
    workHoursMap: Record<string, number>;
    onOpenStoreConfirm: () => void;
    onSaveWorkHoursOnly: () => Promise<void>;
    isSaving: boolean;
}

export default function CumulativeSummaryTab({
    employees,
    revenueData,
    campaignBlocks,
    campaignMatrix,
    workHoursMap,
    onOpenStoreConfirm,
    onSaveWorkHoursOnly,
    isSaving
}: Props) {
    const [searchQuery, setSearchQuery] = useState('');

    // Bản đồ nhân viên theo employee_id (hỗ trợ cả mã có khoảng trắng hoặc khác hoa thường)
    const empMap = useMemo(() => {
        const map = new Map<string, EmployeeItem>();
        employees.forEach(e => {
            if (e.employee_id) {
                map.set(e.employee_id.trim().toLowerCase(), e);
            }
        });
        return map;
    }, [employees]);

    // Danh sách mã nhân viên hiển thị:
    // BẮT BUỘC hiển thị TẤT CẢ nhân viên có trong dữ liệu doanh thu bóc tách,
    // cùng các nhân viên có dữ liệu thi đua, giờ công, và nhân viên đã cấu hình của siêu thị.
    const allEmpIds = useMemo(() => {
        const idSet = new Set<string>();
        // 1. Luôn đưa tất cả nhân viên có dữ liệu doanh thu bóc tách vào
        revenueData.forEach(r => {
            const clean = r.employee_id?.trim();
            if (clean) idSet.add(clean);
        });
        // 2. Bổ sung nhân viên có dữ liệu thi đua
        Object.keys(campaignMatrix).forEach(id => {
            const clean = id?.trim();
            if (clean) idSet.add(clean);
        });
        // 3. Bổ sung nhân viên có giờ công
        Object.keys(workHoursMap).forEach(id => {
            const clean = id?.trim();
            if (clean) idSet.add(clean);
        });
        // 4. Bổ sung danh sách nhân viên cấu hình siêu thị (nếu có)
        employees.forEach(e => {
            const clean = e.employee_id?.trim();
            if (clean) idSet.add(clean);
        });
        return Array.from(idSet);
    }, [employees, revenueData, campaignMatrix, workHoursMap]);

    // Hợp nhất dữ liệu từng nhân viên
    const unifiedRows = useMemo(() => {
        return allEmpIds.map(empId => {
            const cleanEmpId = empId.toLowerCase();
            const empInfo = empMap.get(cleanEmpId);
            // Tìm doanh thu khớp chính xác mã hoặc không phân biệt hoa thường
            const rev = revenueData.find(r => r.employee_id?.trim().toLowerCase() === cleanEmpId);
            const hours = workHoursMap[empId] ?? workHoursMap[cleanEmpId] ?? 0;
            const camps = campaignMatrix[empId] ?? campaignMatrix[cleanEmpId] ?? {};

            const revActual = rev ? rev.revenue_actual : 0;
            const revQd = rev ? rev.revenue_qd : 0;
            const productivity = hours > 0 ? Number((revActual / hours).toFixed(2)) : 0;

            return {
                employee_id: empId,
                full_name: rev?.full_name || empInfo?.full_name || `NV ${empId}`,
                store_name: empInfo?.store_name || (rev ? 'Theo báo cáo DT' : '—'),
                quantity: rev?.quantity || 0,
                revenue_qd: revQd,
                revenue_actual: revActual,
                installment_revenue: rev?.installment_revenue || 0,
                installment_rate: rev?.installment_rate || 0,
                work_hours: hours,
                productivity,
                campaigns: camps
            };
        });
    }, [allEmpIds, empMap, revenueData, campaignMatrix, workHoursMap]);

    // Lọc theo tìm kiếm
    const filteredRows = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return unifiedRows;
        return unifiedRows.filter(
            r =>
                r.employee_id.toLowerCase().includes(q) ||
                r.full_name.toLowerCase().includes(q) ||
                r.store_name.toLowerCase().includes(q)
        );
    }, [unifiedRows, searchQuery]);

    // Tính tổng cộng
    const totals = useMemo(() => {
        let revActual = 0;
        let revQd = 0;
        let hours = 0;
        const campTotals: Record<string, number> = {};
        campaignBlocks.forEach(c => { campTotals[c.campaign_name] = 0; });

        filteredRows.forEach(r => {
            revActual += r.revenue_actual;
            revQd += r.revenue_qd;
            hours += r.work_hours;
            campaignBlocks.forEach(c => {
                campTotals[c.campaign_name] += (r.campaigns[c.campaign_name] || 0);
            });
        });

        return {
            revActual: Number(revActual.toFixed(2)),
            revQd: Number(revQd.toFixed(2)),
            hours: Number(hours.toFixed(2)),
            campTotals
        };
    }, [filteredRows, campaignBlocks]);

    // Xuất Excel bảng đối soát
    const handleExportExcel = async () => {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Tong_Hop_Luy_Ke');

        const headers = [
            'Mã NV', 'Họ và tên', 'Siêu thị', 'Số Lượng', 'DT Thực (Tr.đ)', 'DT QĐ (Tr.đ)',
            'DT Trả Góp (Tr.đ)', '% Trả Góp', 'Giờ Công (h)', 'Năng Suất (Tr/h)',
            ...campaignBlocks.map(c => `${c.campaign_name} (${c.unit_type})`)
        ];

        ws.addRow(headers);
        filteredRows.forEach(r => {
            const row = [
                r.employee_id, r.full_name, r.store_name, r.quantity, r.revenue_actual, r.revenue_qd,
                r.installment_revenue, `${r.installment_rate}%`, r.work_hours, r.productivity
            ];
            campaignBlocks.forEach(c => {
                row.push(r.campaigns[c.campaign_name] ?? 0);
            });
            ws.addRow(row);
        });

        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Bang_Doi_Soat_Luy_Ke_Nhan_Vien_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const hasRevenueOrCampaign = revenueData.length > 0 || campaignBlocks.length > 0;
    const hasWorkHours = Object.keys(workHoursMap).length > 0;

    return (
        <div className="space-y-4">
            {/* Header hành động */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm nhân viên, mã số, siêu thị..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-800"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleExportExcel}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                        <Download className="w-4 h-4 text-emerald-600" />
                        <span>Xuất Excel</span>
                    </button>

                    {/* Nút 1: Lưu Giờ Công (Toàn cụm hỗn hợp - KHÔNG CẦN POPUP) */}
                    <button
                        type="button"
                        disabled={isSaving || !hasWorkHours}
                        onClick={onSaveWorkHoursOnly}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                        title="Lưu trực tiếp giờ công hỗn hợp cho tất cả siêu thị trong cụm (không cần popup)"
                    >
                        <Clock className="w-4 h-4" />
                        <span>Lưu Giờ Công Toàn Cụm</span>
                    </button>

                    {/* Nút 2: Lưu Doanh Thu & Thi Đua (Theo Siêu Thị - BẬT POPUP XÁC NHẬN) */}
                    <button
                        type="button"
                        disabled={isSaving || !hasRevenueOrCampaign}
                        onClick={onOpenStoreConfirm}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                        title="Bắt buộc xác nhận tên siêu thị trước khi cập nhật doanh thu & thi đua"
                    >
                        <Store className="w-4 h-4" />
                        <span>Lưu DT & Thi Đua (Xác Nhận ST)</span>
                    </button>
                </div>
            </div>

            {/* Thanh trạng thái tổng quan các nguồn dữ liệu */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                    {revenueData.length > 0 ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-bold">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                            <span>Doanh thu: {revenueData.length} NV (Tổng DT thực: {totals.revActual.toLocaleString('vi-VN')} tr)</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold">
                            <span>⚠️ Chưa có dữ liệu Doanh thu (Hãy sang Tab 1 dán báo cáo)</span>
                        </div>
                    )}

                    {campaignBlocks.length > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-bold">
                            <span>🏆 Thi đua: {campaignBlocks.length} mục</span>
                        </div>
                    )}

                    {hasWorkHours && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                            <span>Giờ công: {Object.keys(workHoursMap).length} NV ({totals.hours.toLocaleString('vi-VN')}h)</span>
                        </div>
                    )}
                </div>

                <div className="text-[11px] font-bold text-slate-500">
                    Bảng đối soát: <strong className="text-slate-800">{filteredRows.length}</strong> nhân sự
                </div>
            </div>

            {/* Bảng tổng hợp đối soát */}
            <div data-report-table="true" className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden font-avo">
                <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse font-avo report-table">
                        <thead className="bg-slate-900 text-white sticky top-0 z-10 text-[11px] uppercase tracking-wider font-extrabold">
                            <tr>
                                <th className="p-2.5 w-12 text-center border-r border-slate-800">STT</th>
                                <th className="p-2.5 w-24 border-r border-slate-800">Mã NV</th>
                                <th className="p-2.5 min-w-[160px] border-r border-slate-800">Họ và Tên</th>
                                <th className="p-2.5 text-right bg-blue-950 border-r border-blue-900">DT Thực (Tr)</th>
                                <th className="p-2.5 text-right bg-blue-900 border-r border-blue-800">DT QĐ (Tr)</th>
                                <th className="p-2.5 text-right bg-emerald-950 border-r border-emerald-900">Giờ Công (h)</th>
                                <th className="p-2.5 text-right bg-emerald-900 border-r border-emerald-800">Năng Suất</th>
                                {campaignBlocks.map(c => (
                                    <th key={c.campaign_name} className="p-2.5 text-right min-w-[120px] border-r border-slate-800 truncate" title={c.campaign_name}>
                                        {c.campaign_name}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 font-medium">
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={7 + campaignBlocks.length} className="p-10 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <p className="font-bold text-slate-600 text-sm">Chưa có số liệu nhân sự nào được tải lên!</p>
                                            <p className="text-xs text-slate-400">
                                                Vui lòng chuyển sang <strong>Tab 1 (Lũy Kế Doanh Thu)</strong> để dán nội dung báo cáo và nhấn <strong>Áp Dụng Doanh Thu</strong>.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((r, idx) => (
                                <tr key={r.employee_id} className="hover:bg-slate-50 transition">
                                    <td className="p-2 text-center text-slate-400 font-mono border-r border-slate-100">{idx + 1}</td>
                                    <td className="p-2 font-mono font-bold text-blue-700 border-r border-slate-100">{r.employee_id}</td>
                                    <td className="p-2 font-bold text-slate-800 border-r border-slate-100">
                                        <div>
                                            <span>{r.full_name}</span>
                                            <span className="block text-[10px] text-slate-400 font-normal truncate max-w-[150px]">{r.store_name}</span>
                                        </div>
                                    </td>
                                    <td className="p-2 text-right font-mono font-extrabold text-blue-700 bg-blue-50/20 border-r border-slate-100">
                                        {r.revenue_actual ? r.revenue_actual.toLocaleString('vi-VN') : '—'}
                                    </td>
                                    <td className="p-2 text-right font-mono font-bold text-slate-800 bg-blue-50/30 border-r border-slate-100">
                                        {r.revenue_qd ? r.revenue_qd.toLocaleString('vi-VN') : '—'}
                                    </td>
                                    <td className="p-2 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20 border-r border-slate-100">
                                        {r.work_hours ? `${r.work_hours}h` : '—'}
                                    </td>
                                    <td className="p-2 text-right font-mono font-extrabold text-emerald-800 bg-emerald-50/30 border-r border-slate-100">
                                        {r.productivity ? `${r.productivity} tr/h` : '—'}
                                    </td>
                                    {campaignBlocks.map(c => (
                                        <td key={c.campaign_name} className="p-2 text-right font-mono text-slate-700 border-r border-slate-100">
                                            {r.campaigns[c.campaign_name] !== undefined
                                                ? r.campaigns[c.campaign_name].toLocaleString('vi-VN')
                                                : '—'}
                                        </td>
                                    ))}
                                </tr>
                            )))}
                        </tbody>

                        {/* Footer tổng cộng */}
                        <tfoot className="sticky bottom-0 z-10 bg-slate-900 text-white font-extrabold text-xs shadow-lg">
                            <tr>
                                <td colSpan={3} className="p-2.5 text-right uppercase tracking-wider border-r border-slate-800">
                                    Tổng cộng ({filteredRows.length} NV):
                                </td>
                                <td className="p-2.5 text-right font-mono text-amber-300 bg-blue-950 border-r border-blue-900">
                                    {totals.revActual.toLocaleString('vi-VN')} tr
                                </td>
                                <td className="p-2.5 text-right font-mono text-amber-300 bg-blue-900 border-r border-blue-800">
                                    {totals.revQd.toLocaleString('vi-VN')} tr
                                </td>
                                <td className="p-2.5 text-right font-mono text-emerald-300 bg-emerald-950 border-r border-emerald-900">
                                    {totals.hours.toLocaleString('vi-VN')}h
                                </td>
                                <td className="p-2.5 text-right font-mono text-emerald-300 bg-emerald-900 border-r border-emerald-800">
                                    {totals.hours > 0 ? `${(totals.revActual / totals.hours).toFixed(2)} tr/h` : '—'}
                                </td>
                                {campaignBlocks.map(c => (
                                    <td key={c.campaign_name} className="p-2.5 text-right font-mono text-amber-200 border-r border-slate-800">
                                        {(totals.campTotals[c.campaign_name] || 0).toLocaleString('vi-VN')}
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
