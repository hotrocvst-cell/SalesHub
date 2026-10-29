import React, { useMemo } from 'react';
import type { CampaignOffsetItem } from '../services/campaignOffsetService';
import type { EmployeeItem, CampaignDictItem } from '../../../core/lib/storage';
import { cleanEmployeeName, getShortenedEmployeeName } from '../../../core/lib/formatters';
import { ArrowRight, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
    offsets: CampaignOffsetItem[];
    employees: EmployeeItem[];
    campaigns: CampaignDictItem[];
    onDelete: (id: string) => void;
}

export default function CampaignOffsetTable({
    offsets,
    employees,
    campaigns,
    onDelete
}: Props) {
    // Map tra cứu nhanh tên nhân viên & tên ngành hàng
    const empMap = useMemo(() => {
        const map = new Map<string, string>();
        employees.forEach(e => {
            if (e.employee_id) map.set(e.employee_id.trim(), e.full_name || e.employee_id);
        });
        return map;
    }, [employees]);

    const campMap = useMemo(() => {
        const map = new Map<string, string>();
        campaigns.forEach(c => {
            if (c.raw_key) map.set(c.raw_key.trim(), c.display_name || c.raw_key);
        });
        return map;
    }, [campaigns]);

    // Chiều rộng badge mã nhân viên tự động thích ứng chuẩn Quy chuẩn 11
    const maxIdLength = useMemo(() => {
        if (!offsets || offsets.length === 0) return 6;
        return Math.max(6, ...offsets.map(r => String(r.employee_id || '').trim().length));
    }, [offsets]);

    const totalQuantity = useMemo(() => {
        return offsets.reduce((sum, o) => sum + (Number(o.offset_quantity) || 0), 0);
    }, [offsets]);

    return (
        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs bg-white">
            <div className="overflow-x-auto no-scrollbar">
                <table
                    data-report-table="true"
                    className="w-full text-xs text-left border-collapse font-avo report-table"
                    style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}
                >
                    <thead>
                        <tr className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <th className="py-2.5 px-2 text-center w-10 border-r border-slate-800">STT</th>
                            <th className="py-2.5 px-2.5 border-r border-slate-800 min-w-[140px] sm:w-56">NHÂN VIÊN</th>
                            <th className="py-2.5 px-2 bg-emerald-950/80 text-emerald-200 text-left border-r border-emerald-900/60 min-w-[150px]">
                                NGÀNH HÀNG NGUỒN (DƯ)
                            </th>
                            <th className="py-2.5 px-2 bg-rose-950/80 text-rose-200 text-left border-r border-rose-900/60 min-w-[150px]">
                                NGÀNH HÀNG ĐÍCH (THIẾU)
                            </th>
                            <th className="py-2.5 px-2 text-center bg-purple-950/80 text-purple-200 border-r border-purple-900/60 w-28">
                                SỐ LƯỢNG (1 ĐỔI 1)
                            </th>
                            <th className="py-2.5 px-2 border-r border-slate-800 min-w-[160px]">GHI CHÚ / TRẠNG THÁI</th>
                            <th className="py-2.5 px-2 text-center w-16" data-export-ignore="true">THAO TÁC</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 font-bold text-slate-800 text-[11px] sm:text-xs">
                        {offsets.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-10 text-center text-slate-400 italic font-medium">
                                    <div className="flex flex-col items-center justify-center gap-1.5">
                                        <AlertCircle className="w-5 h-5 text-slate-300" />
                                        <span>Chưa có bản ghi cấn trừ nào trong kỳ này. Bấm "Gợi ý tự động" hoặc "Thêm thủ công" để bắt đầu.</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            offsets.map((item, idx) => {
                                const fullName = empMap.get(item.employee_id.trim()) || item.employee_id;
                                const shortName = getShortenedEmployeeName(fullName);
                                const fromName = campMap.get(item.from_campaign_key.trim()) || item.from_campaign_key;
                                const toName = campMap.get(item.to_campaign_key.trim()) || item.to_campaign_key;

                                return (
                                    <tr
                                        key={item.id || idx}
                                        className={`hover:bg-purple-50/20 transition group ${
                                            idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                                        }`}
                                    >
                                        {/* STT */}
                                        <td className="py-2 px-2 text-center text-slate-400 font-normal border-r border-slate-100">
                                            {idx + 1}
                                        </td>

                                        {/* NHÂN VIÊN */}
                                        <td className="py-2 px-2.5 border-r border-slate-100 text-left">
                                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                <span
                                                    style={{
                                                        minWidth: `${maxIdLength + 2.2}ch`,
                                                        width: `${maxIdLength + 2.2}ch`
                                                    }}
                                                    className="font-mono font-bold text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal shrink-0"
                                                >
                                                    {item.employee_id}
                                                </span>
                                                <span
                                                    className="font-black text-slate-900 group-hover:text-purple-700 transition"
                                                    title={`Mã NV: ${item.employee_id} - ${cleanEmployeeName(fullName)}`}
                                                >
                                                    {shortName}
                                                </span>
                                            </div>
                                        </td>

                                        {/* NGÀNH HÀNG NGUỒN */}
                                        <td className="py-2 px-2 text-left border-r border-slate-100">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                {fromName}
                                            </span>
                                        </td>

                                        {/* NGÀNH HÀNG ĐÍCH */}
                                        <td className="py-2 px-2 text-left border-r border-slate-100">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                                {toName}
                                            </span>
                                        </td>

                                        {/* SỐ LƯỢNG */}
                                        <td className="py-2 px-2 text-center border-r border-slate-100 font-mono font-black text-purple-900">
                                            <div className="flex items-center justify-center gap-1">
                                                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                                                    {item.offset_quantity} sp
                                                </span>
                                            </div>
                                        </td>

                                        {/* GHI CHÚ / TRẠNG THÁI */}
                                        <td className="py-2 px-2 border-r border-slate-100 text-slate-600 font-medium text-[11px]">
                                            <div className="flex items-center gap-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                <span className="truncate max-w-[200px]" title={item.note || 'Đã phê duyệt'}>
                                                    {item.note || 'Đã áp dụng'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* THAO TÁC */}
                                        <td className="py-2 px-2 text-center" data-export-ignore="true">
                                            <button
                                                onClick={() => onDelete(item.id)}
                                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                                title="Xóa bản ghi cấn trừ này"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>

                    {offsets.length > 0 && (
                        <tfoot>
                            <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-700">
                                <td colSpan={4} className="py-2.5 px-3 uppercase tracking-wider border-r border-slate-800 text-slate-200">
                                    TỔNG CỘNG ({offsets.length} CẶP CẤN TRỪ)
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono font-black text-purple-300 border-r border-slate-800">
                                    {totalQuantity} sp
                                </td>
                                <td colSpan={2} className="py-2.5 px-2 text-slate-400 font-normal italic text-[10.5px]">
                                    Áp dụng quy tắc 1 đổi 1 theo số lượng sản phẩm thực tế
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}

