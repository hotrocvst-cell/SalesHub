import { useState, useMemo, useEffect } from 'react';
import { parseWorkHoursLogs, type WorkShiftLog } from '../utils/employeeParsers';
import { formatWorkHoursToRawText } from '../utils/sessionStorage';
import { Clock, CheckCircle2, AlertCircle, Plus, Trash2, ArrowRight, RotateCcw } from 'lucide-react';

interface BatchInfo {
    batchId: string;
    timestamp: string;
    lineCount: number;
    hoursAdded: number;
    duplicateCount: number;
    logs: WorkShiftLog[];
}

interface Props {
    onApply: (hoursMap: Record<string, number>) => void;
    initialHoursMap?: Record<string, number>;
}

export default function WorkHoursPasteTab({ onApply, initialHoursMap = {} }: Props) {
    const [rawText, setRawText] = useState('');
    const [batches, setBatches] = useState<BatchInfo[]>([]);
    const [manualAdjustMap, setManualAdjustMap] = useState<Record<string, number>>(initialHoursMap);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (initialHoursMap && Object.keys(initialHoursMap).length > 0) {
            setManualAdjustMap(initialHoursMap);
            if (!rawText) {
                setRawText(formatWorkHoursToRawText(initialHoursMap));
            }
        }
    }, [initialHoursMap]);

    // Khởi tạo set các khóa ca đã nạp để chống trùng
    const shiftKeysSet = useMemo(() => {
        const s = new Set<string>();
        batches.forEach(b => {
            b.logs.forEach(log => {
                s.add(`${log.date}_${log.employee_id}_${log.shift_name}`);
            });
        });
        return s;
    }, [batches]);

    // Tổng hợp giờ công từ tất cả các đợt nạp
    const cumulativeHoursMap = useMemo(() => {
        const map: Record<string, { full_name: string; store_name: string; shift_count: number; hours: number }> = {};

        batches.forEach(b => {
            b.logs.forEach(log => {
                if (!map[log.employee_id]) {
                    map[log.employee_id] = {
                        full_name: log.full_name,
                        store_name: log.store_name,
                        shift_count: 0,
                        hours: 0
                    };
                }
                map[log.employee_id].shift_count += 1;
                map[log.employee_id].hours = Number((map[log.employee_id].hours + log.hours).toFixed(2));
            });
        });

        // Hợp nhất với các điều chỉnh tay nếu có
        Object.entries(manualAdjustMap).forEach(([empId, h]) => {
            if (map[empId]) {
                map[empId].hours = h;
            } else {
                map[empId] = {
                    full_name: `NV ${empId}`,
                    store_name: '—',
                    shift_count: 0,
                    hours: h
                };
            }
        });

        return map;
    }, [batches, manualAdjustMap]);

    // Thêm một đợt dữ liệu dán mới (>500 dòng)
    const handleAddBatch = () => {
        if (!rawText.trim()) return;
        setErrorMsg('');

        const currentKeys = new Set<string>(shiftKeysSet);
        const { newShiftLogs, totalHoursByEmp, duplicateCount } = parseWorkHoursLogs(rawText, currentKeys);

        if (newShiftLogs.length === 0) {
            setErrorMsg('Không tìm thấy dòng log ca làm việc hợp lệ hoặc toàn bộ dữ liệu đã bị trùng lặp!');
            return;
        }

        const hoursAdded = Number(
            Object.values(totalHoursByEmp).reduce((a, b) => a + b, 0).toFixed(2)
        );

        const newBatch: BatchInfo = {
            batchId: `batch_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            lineCount: newShiftLogs.length,
            hoursAdded,
            duplicateCount,
            logs: newShiftLogs
        };

        setBatches(prev => [...prev, newBatch]);
        setRawText('');
    };

    // Xóa 1 đợt nạp
    const handleRemoveBatch = (batchId: string) => {
        setBatches(prev => prev.filter(b => b.batchId !== batchId));
    };

    // Xóa tất cả các đợt
    const handleResetAll = () => {
        if (window.confirm('Bạn có chắc muốn xóa tất cả các đợt giờ công đã nạp?')) {
            setBatches([]);
            setManualAdjustMap({});
            setRawText('');
        }
    };

    // Cập nhật giờ thủ công
    const handleManualHoursChange = (empId: string, val: number) => {
        setManualAdjustMap(prev => ({ ...prev, [empId]: val }));
    };

    const handleConfirmApply = () => {
        const finalMap: Record<string, number> = {};
        Object.entries(cumulativeHoursMap).forEach(([empId, data]) => {
            finalMap[empId] = data.hours;
        });
        onApply(finalMap);
    };

    const totalAllHours = Number(
        Object.values(cumulativeHoursMap).reduce((sum, item) => sum + item.hours, 0).toFixed(2)
    );

    return (
        <div className="space-y-4">
            {/* Header giải thích giải pháp */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-emerald-900 text-sm">
                            Nạp Giờ Công Đa Giai Đoạn (Cộng Dồn & Khử Trùng Lặp)
                        </h3>
                        <p className="text-xs text-emerald-700/80">
                            Dán nhiều đợt (&gt;500 dòng/lần). Hệ thống tự động khử trùng lặp theo <code>Ngày + Ca + Mã NV</code> và cộng dồn lũy kế.
                        </p>
                    </div>
                </div>

                {Object.keys(cumulativeHoursMap).length > 0 && (
                    <button
                        type="button"
                        onClick={handleConfirmApply}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                        <span>Áp Dụng Giờ Công ({Object.keys(cumulativeHoursMap).length} NV)</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Vùng dán dữ liệu cho từng đợt */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span>Dán dữ liệu đợt mới vào đây (Mỗi đợt có thể dán 500 - 2000 dòng):</span>
                    {batches.length > 0 && (
                        <button
                            type="button"
                            onClick={handleResetAll}
                            className="text-rose-600 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> Xóa tất cả các đợt
                        </button>
                    )}
                </div>

                <textarea
                    rows={4}
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    placeholder="Ví dụ dán log ca làm việc:&#10;2026/09/26&#9;2026/T09&#9;10335 - AAR_BRV_VTA...&#9;22838 - Trần Thị Sáu&#9;Sáu&#9;BP All In One...&#9;Nhân Viên&#9;Ca 1&#9;0.97...&#10;2026/09/26&#9;2026/T09&#9;10335 - AAR_BRV_VTA...&#9;22838 - Trần Thị Sáu&#9;Sáu&#9;BP All In One...&#9;Nhân Viên&#9;Ca 2&#9;3..."
                    className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800"
                />

                <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">
                        {rawText ? `Đang có nội dung chờ nạp (${rawText.split('\n').length} dòng)` : 'Chưa nhập dữ liệu'}
                    </span>
                    <button
                        type="button"
                        disabled={!rawText.trim()}
                        onClick={handleAddBatch}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>+ Nạp Thêm Đợt Này (Cộng Dồn)</span>
                    </button>
                </div>
            </div>

            {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* Danh sách các đợt đã nạp */}
            {batches.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                    <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>Lịch sử các đợt nạp đã cộng dồn ({batches.length} đợt):</span>
                        <span className="text-emerald-700 font-extrabold">Tổng giờ công: {totalAllHours} giờ</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {batches.map((b, idx) => (
                            <div key={b.batchId} className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                                <div>
                                    <span className="font-extrabold text-slate-800 block">
                                        Đợt {idx + 1} ({b.timestamp})
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                        {b.lineCount} ca · <strong className="text-emerald-700">+{b.hoursAdded}h</strong>
                                        {b.duplicateCount > 0 && ` (bỏ qua ${b.duplicateCount} ca trùng)`}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveBatch(b.batchId)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                    title="Xóa đợt này"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bảng xem trước tổng hợp giờ công của nhân viên */}
            {Object.keys(cumulativeHoursMap).length > 0 && (
                <div data-report-table="true" className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden font-avo">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Tổng hợp giờ công: {Object.keys(cumulativeHoursMap).length} nhân sự</span>
                        </span>
                        <span className="text-xs font-bold text-emerald-800">
                            Có thể sửa trực tiếp số giờ nếu cần chốt nhanh
                        </span>
                    </div>

                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse font-avo report-table">
                            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                                <tr>
                                    <th className="p-2.5 text-center w-12 border-b">STT</th>
                                    <th className="p-2.5 w-24 border-b">Mã NV</th>
                                    <th className="p-2.5 border-b">Họ và tên</th>
                                    <th className="p-2.5 border-b">Siêu thị</th>
                                    <th className="p-2.5 text-center border-b">Số Ca Làm</th>
                                    <th className="p-2.5 text-right border-b w-36">Tổng Giờ Công (Giờ)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {Object.entries(cumulativeHoursMap).map(([empId, data], idx) => (
                                    <tr key={empId} className="hover:bg-slate-50">
                                        <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                                        <td className="p-2 font-mono font-bold text-blue-700">{empId}</td>
                                        <td className="p-2 font-bold text-slate-800">{data.full_name}</td>
                                        <td className="p-2 text-slate-600 truncate max-w-[200px]">{data.store_name}</td>
                                        <td className="p-2 text-center font-mono text-slate-600">{data.shift_count} ca</td>
                                        <td className="p-1.5 text-right">
                                            <input
                                                type="number"
                                                step={0.1}
                                                value={data.hours || ''}
                                                onChange={e => handleManualHoursChange(empId, Number(e.target.value) || 0)}
                                                className="w-28 text-right font-mono font-extrabold text-emerald-700 bg-white border border-slate-200 focus:border-emerald-500 px-2 py-1 rounded-lg text-xs outline-hidden shadow-2xs"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
