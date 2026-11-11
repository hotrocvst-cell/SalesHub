import React, { useMemo, useState } from 'react';
import { Plus, Trash2, AlertTriangle, UserCheck } from 'lucide-react';
import type { EmployeeItem } from '../../../core/lib/storage';
import {
    formatValue,
    getShortStoreName,
    getShortenedEmployeeName,
    cleanEmployeeName
} from '../../../core/lib/formatters';
import type { ParsedEmployeeRevenue } from '../../employee-cumulative/utils/employeeParsers';
import type { DailyEmployeeOcrRecord } from '../services/geminiDailyEmployeeOcrService';

interface Props {
    records: DailyEmployeeOcrRecord[];
    selectedStore: string;
    employeesDirectory: EmployeeItem[];
    empStoreMap: Record<string, string>;
    summaryStats: {
        totalEmp: number;
        totalQd: number;
        totalInstallment: number;
        totalQty: number;
        avgInstRate: number;
    };
    onAddRecord: () => void;
    onUpdateRecord: (index: number, field: keyof ParsedEmployeeRevenue, value: any) => void;
    onDeleteRecord: (index: number) => void;
    onRemapEmployeeId: (sourceIndex: number, targetEmpId: string) => void;
}

export default function DailyOcrPreviewTable({
    records,
    selectedStore,
    employeesDirectory,
    empStoreMap,
    summaryStats,
    onAddRecord,
    onUpdateRecord,
    onDeleteRecord,
    onRemapEmployeeId
}: Props) {
    const [editingMappingIdx, setEditingMappingIdx] = useState<number | null>(null);

    const maxIdLength = useMemo(() => {
        if (!records || records.length === 0) return 6;
        const validLengths = records
            .filter(r => !r.isUnmappedName && !String(r.employee_id || '').startsWith('UNMAPPED::'))
            .map(r => String(r.employee_id || '').trim().length);
        return Math.max(6, ...validLengths);
    }, [records]);

    const mappingStats = useMemo(() => {
        let unmappedCount = 0;
        let nameMatchedCount = 0;
        records.forEach(r => {
            if (r.isUnmappedName || String(r.employee_id || '').startsWith('UNMAPPED::')) {
                unmappedCount++;
            } else if (r.mappingSource === 'NAME_EXACT' || r.mappingSource === 'NAME_FUZZY') {
                nameMatchedCount++;
            }
        });
        return { unmappedCount, nameMatchedCount };
    }, [records]);

    const existingEmpIdSet = useMemo(
        () =>
            new Set(
                records
                    .filter(r => !r.isUnmappedName && !String(r.employee_id || '').startsWith('UNMAPPED::'))
                    .map(r => String(r.employee_id || '').trim().toLowerCase())
            ),
        [records]
    );

    if (records.length === 0) return null;

    return (
        <div className="space-y-3 pt-2">
            {/* Thẻ thống kê KPI bóc tách (Không có DT Thực) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-100 p-2.5 rounded-2xl border border-slate-200 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                    <div className="text-[10px] text-slate-600 font-bold uppercase">Nhân sự</div>
                    <div className="text-sm font-black text-slate-900 tabular-nums">{summaryStats.totalEmp} NV</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200 text-center">
                    <div className="text-[10px] text-emerald-800 font-bold uppercase">Tổng DTQĐ</div>
                    <div className="text-sm font-black text-emerald-800 tabular-nums">{formatValue(summaryStats.totalQd)} tr</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-purple-200 text-center">
                    <div className="text-[10px] text-purple-800 font-bold uppercase">Trả Góp QĐ (%TG)</div>
                    <div className="text-sm font-black text-purple-800 tabular-nums">
                        {formatValue(summaryStats.totalInstallment)} tr ({summaryStats.avgInstRate}%)
                    </div>
                </div>
            </div>

            {/* Banner rà soát mapping khi ảnh % Tỷ trọng trả góp không có Mã NV */}
            {(mappingStats.unmappedCount > 0 || mappingStats.nameMatchedCount > 0) && (
                <div
                    className={`rounded-2xl p-3 border text-xs flex items-start gap-2.5 ${
                        mappingStats.unmappedCount > 0
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                >
                    {mappingStats.unmappedCount > 0 ? (
                        <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                        <UserCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <div className="space-y-1 flex-1">
                        {mappingStats.unmappedCount > 0 && (
                            <p className="font-bold leading-snug">
                                Có <span className="font-black tabular-nums">{mappingStats.unmappedCount}</span> dòng nhân viên từ ảnh % Tỷ trọng trả góp chưa có Mã NV và chưa khớp được tự động. Vui lòng chọn đúng Mã NV trong danh bạ (hoặc xóa dòng thừa) trước khi áp dụng / lưu Cloud.
                            </p>
                        )}
                        {mappingStats.nameMatchedCount > 0 && (
                            <p className="font-medium leading-snug">
                                Có <span className="font-bold tabular-nums">{mappingStats.nameMatchedCount}</span> nhân sự được tự động đối chiếu theo tên — vui lòng kiểm tra lại và bấm &quot;Khớp tên · Đổi&quot; nếu cần sửa.
                            </p>
                        )}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase">
                    Danh Sách Nhân Viên ({records.length} Bạn)
                </span>
                <button
                    type="button"
                    onClick={onAddRecord}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-[11px] font-bold rounded-xl shadow-sm flex items-center gap-1 cursor-pointer"
                >
                    <Plus className="w-3 h-3 text-blue-700" aria-hidden="true" />
                    <span>Thêm dòng</span>
                </button>
            </div>

            {/* Bảng dữ liệu chi tiết theo Quy chuẩn 11: gộp 1 cột NHÂN VIÊN */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="max-h-80 overflow-y-auto overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-900 text-white font-black text-[10.5px] uppercase sticky top-0 z-10">
                            <tr>
                                <th className="px-2 py-2 w-8 text-center">#</th>
                                <th className="px-2.5 py-2 min-w-[180px]">NHÂN VIÊN</th>
                                {selectedStore === 'all' && (
                                    <th className="px-2 py-2 min-w-[95px] text-left">ST</th>
                                )}
                                <th className="px-2 py-2 w-14 text-right">SL</th>
                                <th className="px-2 py-2 w-20 text-right bg-[#005a43] text-[#fde047]">DTQĐ</th>
                                <th className="px-2 py-2 w-24 text-right">DT Trả Góp QĐ</th>
                                <th className="px-2 py-2 w-20 text-right">% Tỷ Trọng TG</th>
                                <th className="px-2 py-2 w-8 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {records.map((r, idx) => {
                                const isUnmapped = Boolean(r.isUnmappedName) || String(r.employee_id || '').startsWith('UNMAPPED::');
                                const isNameMatched = !isUnmapped && (r.mappingSource === 'NAME_EXACT' || r.mappingSource === 'NAME_FUZZY');
                                const isEditingMapping = editingMappingIdx === idx;
                                const isBlankNew = !isUnmapped && !r.employee_id?.trim();

                                return (
                                    <tr key={`${r.employee_id}-${idx}`} className={`transition ${isUnmapped ? 'bg-rose-50/70 hover:bg-rose-50' : 'hover:bg-blue-50/40'}`}>
                                        <td className="px-2 py-1.5 text-center text-slate-600 font-bold text-[11px] tabular-nums">
                                            {idx + 1}
                                        </td>

                                        {/* CỘT GỘP NHÂN VIÊN */}
                                        <td className="px-2.5 py-1.5">
                                            {isUnmapped ? (
                                                <div className="space-y-1 min-w-[170px]">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 shrink-0">
                                                            Chưa có Mã NV
                                                        </span>
                                                        <span
                                                            title={`Tên đọc từ ảnh: ${r.ocrSourceName || r.full_name}`}
                                                            className="font-extrabold text-rose-950 text-xs"
                                                        >
                                                            {r.ocrSourceName || r.full_name}
                                                        </span>
                                                    </div>
                                                    {employeesDirectory.length > 0 && (
                                                        <select
                                                            value=""
                                                            aria-label={`Chọn Mã NV cho ${r.ocrSourceName || r.full_name}`}
                                                            onChange={(e) => {
                                                                onRemapEmployeeId(idx, e.target.value);
                                                                setEditingMappingIdx(null);
                                                            }}
                                                            className="w-full max-w-[230px] text-[11px] font-bold text-slate-800 bg-white border border-rose-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                                                        >
                                                            <option value="">-- Chọn Mã NV danh bạ --</option>
                                                            {employeesDirectory.map(se => {
                                                                const seId = String(se.employee_id || '').trim();
                                                                const hasExisting = existingEmpIdSet.has(seId.toLowerCase());
                                                                return (
                                                                    <option key={seId} value={seId}>
                                                                        [{seId}] {se.full_name}{hasExisting ? ' (Gộp số liệu)' : ''}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    )}
                                                </div>
                                            ) : isBlankNew ? (
                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        aria-label={`Mã nhân viên dòng ${idx + 1}`}
                                                        name={`empId_${idx}`}
                                                        type="text"
                                                        value={r.employee_id}
                                                        placeholder="Mã NV..."
                                                        onChange={e => onUpdateRecord(idx, 'employee_id', e.target.value)}
                                                        className="w-20 font-mono font-bold text-blue-800 text-xs bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                                    />
                                                    <input
                                                        aria-label={`Họ và tên dòng ${idx + 1}`}
                                                        name={`empName_${idx}`}
                                                        type="text"
                                                        value={r.full_name}
                                                        onChange={e => onUpdateRecord(idx, 'full_name', e.target.value)}
                                                        className="flex-1 min-w-[100px] font-bold text-slate-900 text-xs bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                                                        <span
                                                            style={{
                                                                minWidth: `${maxIdLength + 2.2}ch`,
                                                                width: `${maxIdLength + 2.2}ch`
                                                            }}
                                                            className="font-mono font-bold text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal shrink-0"
                                                        >
                                                            {r.employee_id}
                                                        </span>
                                                        <span
                                                            title={`Mã NV: ${r.employee_id} - ${cleanEmployeeName(r.full_name)}${r.ocrSourceName ? ` (Ảnh: ${r.ocrSourceName})` : ''}`}
                                                            className="font-extrabold text-slate-900 text-xs truncate max-w-[150px] sm:max-w-none"
                                                        >
                                                            {getShortenedEmployeeName(r.full_name)}
                                                        </span>
                                                        {isNameMatched && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingMappingIdx(isEditingMapping ? null : idx)}
                                                                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition cursor-pointer shrink-0"
                                                            >
                                                                {isEditingMapping ? 'Đóng' : 'Khớp tên · Đổi'}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {isEditingMapping && employeesDirectory.length > 0 && (
                                                        <select
                                                            value={r.employee_id}
                                                            aria-label={`Đổi Mã NV cho ${r.full_name}`}
                                                            onChange={(e) => {
                                                                onRemapEmployeeId(idx, e.target.value);
                                                                setEditingMappingIdx(null);
                                                            }}
                                                            className="w-full max-w-[230px] text-[11px] font-bold text-slate-800 bg-white border border-amber-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                                                        >
                                                            {employeesDirectory.map(se => {
                                                                const seId = String(se.employee_id || '').trim();
                                                                const isCurrent = seId.toLowerCase() === r.employee_id.trim().toLowerCase();
                                                                const hasExisting = !isCurrent && existingEmpIdSet.has(seId.toLowerCase());
                                                                return (
                                                                    <option key={seId} value={seId}>
                                                                        [{seId}] {se.full_name}{hasExisting ? ' (Gộp số liệu)' : ''}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        {selectedStore === 'all' && (
                                            <td className="px-2 py-1.5 text-slate-700 font-medium text-[11px] whitespace-nowrap">
                                                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-bold">
                                                    {empStoreMap[r.employee_id?.trim()] ? getShortStoreName(empStoreMap[r.employee_id?.trim()]) : 'Chưa rõ'}
                                                </span>
                                            </td>
                                        )}

                                        {/* Số lượng */}
                                        <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-800">
                                            <input
                                                aria-label={`Số lượng dòng ${idx + 1}`}
                                                name={`qty_${idx}`}
                                                type="number"
                                                value={r.quantity || ''}
                                                onChange={e => onUpdateRecord(idx, 'quantity', Number(e.target.value) || 0)}
                                                className="w-full text-right bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-xs font-mono tabular-nums"
                                                placeholder="0"
                                            />
                                        </td>

                                        {/* DTQĐ */}
                                        <td className="px-2 py-1.5 text-right font-mono font-black text-emerald-800 bg-emerald-50/50">
                                            <input
                                                aria-label={`DTQĐ dòng ${idx + 1}`}
                                                name={`qd_${idx}`}
                                                type="number"
                                                step="any"
                                                value={r.revenue_qd}
                                                onChange={e => onUpdateRecord(idx, 'revenue_qd', e.target.value)}
                                                className="w-full text-right bg-white border border-emerald-300 rounded px-1 py-0.5 text-xs font-mono tabular-nums font-black text-emerald-800"
                                            />
                                        </td>

                                        {/* DT Trả góp QĐ */}
                                        <td className="px-2 py-1.5 text-right font-mono font-bold text-purple-800">
                                            <input
                                                aria-label={`DT Trả góp QĐ dòng ${idx + 1}`}
                                                name={`installment_${idx}`}
                                                type="number"
                                                step="any"
                                                value={r.installment_revenue}
                                                onChange={e => onUpdateRecord(idx, 'installment_revenue', e.target.value)}
                                                className="w-full text-right bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-xs font-mono tabular-nums"
                                            />
                                        </td>

                                        {/* % Tỷ trọng trả góp */}
                                        <td className="px-2 py-1.5 text-right font-mono font-bold text-purple-900">
                                            <div className="flex items-center justify-end gap-0.5">
                                                <input
                                                    aria-label={`Phần trăm tỷ trọng trả góp dòng ${idx + 1}`}
                                                    name={`instRate_${idx}`}
                                                    type="number"
                                                    step="any"
                                                    min={0}
                                                    value={r.installment_rate}
                                                    onChange={e => onUpdateRecord(idx, 'installment_rate', e.target.value)}
                                                    className="w-14 text-right bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-xs font-mono tabular-nums font-bold text-purple-900"
                                                />
                                                <span className="text-[10.5px] text-slate-600">%</span>
                                            </div>
                                        </td>

                                        {/* Xóa */}
                                        <td className="px-2 py-1.5 text-center">
                                            <button
                                                type="button"
                                                aria-label={`Xóa nhân viên dòng ${idx + 1}`}
                                                onClick={() => onDeleteRecord(idx)}
                                                className="text-slate-600 hover:text-rose-700 p-1 rounded cursor-pointer"
                                                title="Xóa dòng này"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

