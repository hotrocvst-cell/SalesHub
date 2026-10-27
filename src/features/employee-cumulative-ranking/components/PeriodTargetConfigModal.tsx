import React, { useState, useEffect } from 'react';
import {
    Target,
    Save,
    Trash2,
    X,
    Sparkles,
    Calendar,
    Store as StoreIcon,
    Database,
    Copy,
    CheckCircle2,
    AlertTriangle,
    FileSpreadsheet,
    RefreshCw,
    Calculator
} from 'lucide-react';
import { formatValue, normalizeToMillion, cleanEmployeeName, getShortenedEmployeeName } from '../../../core/lib/formatters';
import { useAuth } from '../../../shared/contexts/AuthContext';
import type { PeriodTargetConfig } from '../types';
import {
    EMPLOYEE_PERIOD_TARGETS_SQL,
    checkSupabasePeriodTargetTable,
    fetchPeriodTarget,
    savePeriodTarget,
    deletePeriodTarget,
    buildPeriodTargetId
} from '../services/periodTargetStorage';

interface EmployeeOption {
    employee_id: string;
    full_name: string;
    store_name?: string;
    job_title?: string;
}

interface PeriodTargetConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    fromDate: string;
    toDate: string;
    selectedStore: string;
    employees: EmployeeOption[];
    onSaved: () => void;
}

export default function PeriodTargetConfigModal({
    isOpen,
    onClose,
    fromDate,
    toDate,
    selectedStore,
    employees,
    onSaved
}: PeriodTargetConfigModalProps) {
    const { isAdmin } = useAuth();
    // Chiều rộng badge mã nhân viên tự động thích ứng theo mã dài nhất trong bảng để thẳng cột thẳng lề
    const maxIdLength = React.useMemo(() => {
        if (!employees || employees.length === 0) return 6;
        return Math.max(6, ...employees.map(e => String(e.employee_id || '').trim().length));
    }, [employees]);

    const [periodTitle, setPeriodTitle] = useState<string>(
        `Giai đoạn ${fromDate} - ${toDate}`
    );
    const [storeTargetInMillion, setStoreTargetInMillion] = useState<string>('');
    const [empTargets, setEmpTargets] = useState<Record<string, number>>({});
    
    // Status
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [tableExists, setTableExists] = useState<boolean>(true);
    const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
    const [sqlCopied, setSqlCopied] = useState<boolean>(false);
    const [existingId, setExistingId] = useState<string | null>(null);
    const [toastMsg, setToastMsg] = useState<string>('');
    const [quickPasteText, setQuickPasteText] = useState<string>('');
    const [isPasting, setIsPasting] = useState<boolean>(false);

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 3000);
    };

    // Nạp dữ liệu cấu hình đã có (nếu có)
    useEffect(() => {
        if (!isOpen) return;

        const loadConfig = async () => {
            setLoading(true);
            const check = await checkSupabasePeriodTargetTable();
            setTableExists(check.exists);

            const existing = await fetchPeriodTarget(selectedStore, fromDate, toDate);
            if (existing) {
                setExistingId(existing.id);
                setPeriodTitle(existing.periodTitle);
                setStoreTargetInMillion(
                    existing.storeTarget > 0 ? normalizeToMillion(existing.storeTarget).toString() : ''
                );
                // Đơn vị Triệu đồng chuẩn hóa
                const millionMap: Record<string, number> = {};
                Object.entries(existing.targets || {}).forEach(([empId, val]) => {
                    millionMap[empId] = normalizeToMillion(val);
                });
                setEmpTargets(millionMap);
            } else {
                setExistingId(null);
                setPeriodTitle(`Giai đoạn ${fromDate} - ${toDate}`);
                setStoreTargetInMillion('');
                setEmpTargets({});
            }
            setLoading(false);
        };

        loadConfig();
    }, [isOpen, fromDate, toDate, selectedStore]);

    // Thay đổi target của 1 nhân viên
    const handleEmpTargetChange = (empId: string, valStr: string) => {
        const num = parseFloat(valStr) || 0;
        setEmpTargets(prev => ({
            ...prev,
            [empId]: num
        }));
    };

    // Tiện ích: Phân bổ đều từ Target siêu thị
    const handleDistributeEvenly = () => {
        const storeTargetMillion = parseFloat(storeTargetInMillion) || 0;
        if (storeTargetMillion <= 0 || employees.length === 0) {
            showToast('⚠️ Vui lòng nhập Target Siêu thị trước khi phân bổ');
            return;
        }

        const avg = Math.round((storeTargetMillion / employees.length) * 10) / 10;
        const newMap: Record<string, number> = {};
        employees.forEach(emp => {
            newMap[emp.employee_id] = avg;
        });
        setEmpTargets(newMap);
        showToast(`⚡ Đã phân bổ đều ~${avg} tr cho ${employees.length} nhân sự`);
    };

    // Tiện ích: Đặt lại tất cả về 0
    const handleClearAll = () => {
        setEmpTargets({});
        setStoreTargetInMillion('');
        showToast('🧹 Đã xóa toàn bộ chỉ tiêu');
    };

    // Tiện ích: Dán nhanh từ Excel (Mã NV [tab] Target)
    const handleApplyQuickPaste = () => {
        if (!quickPasteText.trim()) return;
        const lines = quickPasteText.split('\n');
        const newMap: Record<string, number> = { ...empTargets };
        let count = 0;

        lines.forEach(l => {
            const parts = l.trim().split(/\t|\s{2,}|,/);
            if (parts.length >= 2) {
                const empId = parts[0].trim();
                let val = parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0;
                if (val >= 100_000) val = val / 1_000_000; // nếu dán số tiền VNĐ đầy đủ thì chuyển sang triệu
                if (empId) {
                    newMap[empId] = val;
                    count++;
                }
            }
        });

        setEmpTargets(newMap);
        setIsPasting(false);
        setQuickPasteText('');
        showToast(`📋 Đã áp dụng thành công ${count} nhân sự từ nội dung dán`);
    };

    // Tổng Target nhân viên hiện tại
    const totalEmpTargetMillion = Object.values(empTargets).reduce((a, b) => a + (Number(b) || 0), 0);

    // Lưu cấu hình
    const handleSave = async () => {
        setSaving(true);
        // Chuẩn hóa và lưu theo đơn vị Triệu đồng (đồng nhất toàn hệ thống)
        const targetsMillion: Record<string, number> = {};
        Object.entries(empTargets).forEach(([empId, val]) => {
            const num = normalizeToMillion(Number(val) || 0);
            if (num > 0) {
                targetsMillion[empId] = num;
            }
        });

        const storeTargetMillion = normalizeToMillion(parseFloat(storeTargetInMillion) || totalEmpTargetMillion);

        const config: PeriodTargetConfig = {
            id: existingId || buildPeriodTargetId(selectedStore, fromDate, toDate),
            periodTitle: periodTitle.trim() || `Giai đoạn ${fromDate} - ${toDate}`,
            storeName: selectedStore,
            fromDate,
            toDate,
            storeTarget: storeTargetMillion,
            targets: targetsMillion
        };

        const res = await savePeriodTarget(config);
        setSaving(false);

        if (res.success) {
            showToast('✅ Đã lưu Target giai đoạn lên Supabase Cloud thành công!');
            setTimeout(() => {
                onSaved();
                onClose();
            }, 800);
        } else {
            showToast(`⚠️ ${res.error || 'Lỗi khi lưu cấu hình'}`);
        }
    };

    // Xóa cấu hình đợt này
    const handleDelete = async () => {
        if (!existingId) return;
        if (!window.confirm('Bạn có chắc muốn xóa cấu hình Target riêng cho giai đoạn này không?')) return;

        setSaving(true);
        const res = await deletePeriodTarget(existingId);
        setSaving(false);

        if (res.success) {
            showToast('🗑️ Đã xóa cấu hình Target giai đoạn');
            setTimeout(() => {
                onSaved();
                onClose();
            }, 800);
        } else {
            showToast(`⚠️ ${res.error || 'Lỗi khi xóa'}`);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 animate-fade-in font-avo">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
                {/* HEADER MODAL */}
                <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/30">
                            <Target className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                                CẤU HÌNH TARGET GIAI ĐOẠN RIÊNG BIỆT
                            </h2>
                            <p className="text-[11px] text-slate-300">
                                Áp dụng chỉ tiêu riêng theo mốc {fromDate} đến {toDate} (khác kỳ tháng nguyên)
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* TOAST MESSAGE */}
                {toastMsg && (
                    <div className="bg-slate-900 text-white px-3 py-2 text-xs font-bold flex items-center gap-2 border-b border-slate-800 animate-fade-in">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{toastMsg}</span>
                    </div>
                )}

                {/* NỘI DUNG CUỘN */}
                <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1">
                    {/* KHỐI THÔNG TIN CHUNG */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        {/* TÊN ĐỢT / CHIẾN DỊCH */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Tên đợt thi đua / Giai đoạn:
                            </label>
                            <input
                                type="text"
                                value={periodTitle}
                                onChange={(e) => setPeriodTitle(e.target.value)}
                                placeholder="Ví dụ: Thi đua 10 ngày đầu tháng 10"
                                className="w-full bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500"
                            />
                        </div>

                        {/* TARGET SIÊU THỊ TRONG GIAI ĐOẠN */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                                <span>Target Siêu thị (Triệu VNĐ):</span>
                                <span className="text-[10px] text-indigo-600 font-medium">
                                    Tổng NV: {totalEmpTargetMillion.toFixed(1)} tr
                                </span>
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                value={storeTargetInMillion}
                                onChange={(e) => setStoreTargetInMillion(e.target.value)}
                                placeholder="Ví dụ: 150 (Triệu VNĐ)"
                                className="w-full bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-700 focus:outline-hidden focus:border-indigo-500"
                            />
                        </div>

                        {/* MỐC NGÀY VÀ SHOP */}
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span>Mốc: <strong>{fromDate}</strong> đến <strong>{toDate}</strong></span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                            <StoreIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>Siêu thị: <strong>{selectedStore === 'all' ? 'Tất cả siêu thị' : selectedStore}</strong></span>
                        </div>
                    </div>

                    {/* THANH CÔNG CỤ NHANH */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                                type="button"
                                onClick={handleDistributeEvenly}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                                <span>⚡ Chia đều target shop</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsPasting(!isPasting)}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                                <span>📋 Dán từ Excel</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                                <span>Đặt về 0</span>
                            </button>
                        </div>

                        {/* TRẠNG THÁI CLOUD */}
                        <div className="flex items-center gap-1.5 text-[11px]">
                            {tableExists ? (
                                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Cloud Sẵn Sàng
                                </span>
                            ) : isAdmin ? (
                                <button
                                    type="button"
                                    onClick={() => setShowSqlModal(true)}
                                    className="text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 hover:bg-amber-100 cursor-pointer"
                                >
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    Chưa tạo bảng (Xem SQL)
                                </button>
                            ) : (
                                <span className="text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    Chưa tạo bảng Cloud
                                </span>
                            )}
                        </div>
                    </div>

                    {/* HỘP DÁN NHANH TỪ EXCEL */}
                    {isPasting && (
                        <div className="p-3 bg-slate-100 rounded-xl border border-slate-300 animate-fade-in space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800">
                                    Dán 2 cột: [Mã NV] và [Target (Triệu/VNĐ)]
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsPasting(false)}
                                    className="text-[11px] text-slate-500 hover:text-slate-800"
                                >
                                    Đóng
                                </button>
                            </div>
                            <textarea
                                rows={4}
                                value={quickPasteText}
                                onChange={(e) => setQuickPasteText(e.target.value)}
                                placeholder="Ví dụ:&#10;NV001    15&#10;NV002    20.5"
                                className="w-full bg-white border border-slate-300 p-2 rounded-lg text-xs font-mono"
                            />
                            <button
                                type="button"
                                onClick={handleApplyQuickPaste}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
                            >
                                Áp dụng dữ liệu dán
                            </button>
                        </div>
                    )}

                    {/* BẢNG NHẬP TARGET TỪNG NHÂN VIÊN */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="px-2.5 py-2 w-10 text-center">STT</th>
                                    <th className="px-2.5 py-2 min-w-[180px]">Nhân viên</th>
                                    <th className="px-2.5 py-2 text-right min-w-[140px]">Target (Triệu VNĐ)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {employees.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-3 py-6 text-center text-slate-400 italic">
                                            Không có danh sách nhân sự của siêu thị này.
                                        </td>
                                    </tr>
                                ) : (
                                    employees.map((emp, idx) => {
                                        const currentVal = empTargets[emp.employee_id] ?? '';
                                        return (
                                            <tr key={emp.employee_id || idx} className="hover:bg-slate-50">
                                                <td className="px-2.5 py-1.5 text-center text-slate-400 font-mono text-[11px]">
                                                    {idx + 1}
                                                </td>
                                                <td className="px-2.5 py-1.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-2 whitespace-nowrap">
                                                        <span
                                                            style={{ minWidth: `${maxIdLength + 2.2}ch`, width: `${maxIdLength + 2.2}ch` }}
                                                            className="font-mono font-bold text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal shrink-0"
                                                        >
                                                            {emp.employee_id}
                                                        </span>
                                                        <span
                                                            className="font-bold text-xs text-slate-900"
                                                            title={`Mã NV: ${emp.employee_id} - ${cleanEmployeeName(emp.full_name)}`}
                                                        >
                                                            {getShortenedEmployeeName(emp.full_name)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-2.5 py-1.5 text-right">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            min="0"
                                                            value={currentVal}
                                                            onChange={(e) => handleEmpTargetChange(emp.employee_id, e.target.value)}
                                                            placeholder="0"
                                                            className="w-24 text-right bg-white border border-slate-300 px-2 py-1 rounded-md text-xs font-bold text-indigo-700 focus:outline-hidden focus:border-indigo-500"
                                                        />
                                                        <span className="text-[10px] text-slate-400 font-bold">tr</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FOOTER MODAL */}
                <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                    <div>
                        {existingId && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={saving}
                                className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa cấu hình đợt</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            <span>{saving ? 'Đang lưu...' : 'Lưu Target Giai Đoạn'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAL XEM & SAO CHÉP SQL DDL (RULE 5 GEMINI.MD - CHỈ ADMIN) */}
            {showSqlModal && isAdmin && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
                    <div className="bg-slate-900 text-white rounded-2xl max-w-xl w-full p-4 border border-slate-700 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <Database className="w-4 h-4 text-amber-400" />
                                SQL DDL: Bảng employee_period_targets
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowSqlModal(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-300">
                            Chạy câu lệnh SQL này 1 lần trong Supabase SQL Editor để bật lưu trữ Cloud:
                        </p>
                        <pre className="bg-black/50 p-3 rounded-xl text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-48 border border-slate-800">
                            {EMPLOYEE_PERIOD_TARGETS_SQL}
                        </pre>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(EMPLOYEE_PERIOD_TARGETS_SQL);
                                    setSqlCopied(true);
                                    setTimeout(() => setSqlCopied(false), 2000);
                                }}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                <span>{sqlCopied ? 'Đã sao chép SQL!' : 'Sao chép SQL'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
