import { useState, useMemo } from 'react';
import {
    UploadCloud,
    CheckCircle2,
    AlertCircle,
    X,
    Trash2,
    Store,
    Briefcase,
    RefreshCw
} from 'lucide-react';
import {
    type EmployeeItem,
    type StoreItem,
    upsertEmployeesBatch
} from '../../../core/lib/storage';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    stores: StoreItem[];
    defaultStoreName: string;
    onImportSuccess: (count: number) => void;
}

const COMMON_ROLES = [
    { value: 'Nhân viên', label: 'Nhân Viên', icon: '👤' },
    { value: 'Trưởng ca', label: 'Trưởng Ca', icon: '⭐' },
    { value: 'Quản lý', label: 'Quản Lý', icon: '👑' },
    { value: 'AIO', label: 'AIO', icon: '📱' },
    { value: 'AIO - TZ', label: 'AIO - TZ', icon: '📱' },
    { value: 'AIO - TGD', label: 'AIO - TGD', icon: '📱' },
    { value: 'AIO - ĐMX', label: 'AIO - ĐMX', icon: '📱' },
    { value: 'Tư vấn bán hàng', label: 'Tư vấn bán hàng', icon: '👥' },
    { value: 'Thu ngân', label: 'Thu ngân', icon: '💳' },
    { value: 'Kho / Kỹ thuật', label: 'Kho / Kỹ thuật', icon: '📦' }
];

export default function QuickPasteEmployeeModal({
    isOpen,
    onClose,
    stores,
    defaultStoreName,
    onImportSuccess
}: Props) {
    const [rawText, setRawText] = useState('');
    const [targetStore, setTargetStore] = useState(defaultStoreName || (stores[0]?.name ?? ''));
    const [targetRole, setTargetRole] = useState('Nhân viên');
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState('');

    if (!isOpen) return null;

    // Phân tích cú pháp văn bản: Vai trò cũng là bộ phận
    const parsedEmployees = useMemo(() => {
        if (!rawText.trim()) return [];
        const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const results: Partial<EmployeeItem>[] = [];

        for (const line of lines) {
            // Bỏ qua dòng tiêu đề nếu có
            const lower = line.toLowerCase();
            if (lower.includes('mã nv') || lower.includes('họ tên') || lower.includes('employee_id')) {
                continue;
            }

            // Tách bằng tab, dấu phẩy hoặc dấu chấm phẩy
            let parts = line.split('\t');
            if (parts.length === 1) {
                parts = line.split(/[,;]/);
            }
            parts = parts.map(p => p.trim()).filter(Boolean);

            if (parts.length >= 2) {
                const empId = parts[0];
                const fullName = parts[1];
                let store = targetStore;
                let role = targetRole;

                if (parts.length === 3) {
                    // Dòng có: Mã NV, Họ tên, Vai trò
                    role = parts[2].trim() || targetRole;
                } else if (parts.length >= 4) {
                    // Dòng có: Mã NV, Họ tên, Siêu thị, Vai trò
                    store = parts[2].trim() || targetStore;
                    role = parts[3].trim() || targetRole;
                }

                results.push({
                    employee_id: empId,
                    full_name: fullName,
                    store_name: store,
                    role: role,
                    job_title: role,
                    is_active: true
                });
            }
        }
        return results;
    }, [rawText, targetStore, targetRole]);

    const handleConfirmImport = async () => {
        if (parsedEmployees.length === 0) return;
        setIsImporting(true);
        setImportError('');
        try {
            const res = await upsertEmployeesBatch(parsedEmployees as EmployeeItem[]);
            if (res.success) {
                onImportSuccess(parsedEmployees.length);
                setRawText('');
                onClose();
            } else {
                setImportError(res.error || 'Có lỗi xảy ra khi lưu nhân viên vào CLOUD');
            }
        } catch (err: unknown) {
            setImportError((err as Error).message || 'Lỗi kết nối khi nạp danh sách nhân viên');
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
                            <UploadCloud className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <h3 className="font-black text-base leading-tight">Dán Nhanh Danh Sách Nhân Viên</h3>
                            <p className="text-xs text-blue-200">Vai trò vận hành: Quản Lý • Trưởng Ca • Nhân Viên (AIO)</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                    {/* Cấu hình mặc định */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1 flex items-center gap-1">
                                <Store className="w-3.5 h-3.5 text-blue-600" />
                                <span>Siêu thị gán mặc định:</span>
                            </label>
                            <select
                                value={targetStore}
                                onChange={e => setTargetStore(e.target.value)}
                                className="w-full text-xs font-semibold px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-800"
                            >
                                {stores.map(s => (
                                    <option key={s.id || s.code} value={s.name}>
                                        {s.name} ({s.code})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1 flex items-center gap-1">
                                <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Vai trò gán mặc định:</span>
                            </label>
                            <select
                                value={targetRole}
                                onChange={e => setTargetRole(e.target.value)}
                                className="w-full text-xs font-semibold px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-800"
                            >
                                {COMMON_ROLES.map(r => (
                                    <option key={r.value} value={r.value}>
                                        {r.icon} {r.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Vùng nhập Text */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold text-slate-700">
                                Dán danh sách vào đây (Định dạng: Mã NV [tab] Họ và Tên [tab] Vai trò):
                            </label>
                            {rawText && (
                                <button
                                    onClick={() => setRawText('')}
                                    className="text-[11px] text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <Trash2 className="w-3 h-3" /> Xóa trắng
                                </button>
                            )}
                        </div>
                        <textarea
                            rows={5}
                            value={rawText}
                            onChange={e => setRawText(e.target.value)}
                            placeholder={`Ví dụ copy từ Excel:\n260732\tNguyễn Thị Hồng Loan\tAIO\n27560\tBùi Minh Lãm\tTư vấn bán hàng\n249041\tNguyễn Phương Nam\tQuản Lý`}
                            className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                        />
                    </div>

                    {/* Xem trước kết quả parse */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-700">
                                Xem trước danh sách nhận diện ({parsedEmployees.length} nhân viên):
                            </span>
                            {parsedEmployees.length > 0 ? (
                                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Hợp lệ ({parsedEmployees.length} NV)
                                </span>
                            ) : rawText ? (
                                <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5" /> Chưa nhận diện được dòng nào
                                </span>
                            ) : null}
                        </div>

                        {parsedEmployees.length > 0 ? (
                            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 text-[11px]">
                                        <tr>
                                            <th className="p-2 border-b w-10 text-center">STT</th>
                                            <th className="p-2 border-b w-24">Mã NV</th>
                                            <th className="p-2 border-b">Họ và Tên</th>
                                            <th className="p-2 border-b">Siêu Thị</th>
                                            <th className="p-2 border-b w-36">Vai Trò</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {parsedEmployees.map((emp, idx) => {
                                            const roleStr = emp.role || 'Nhân viên';
                                            const isAIO = roleStr.toUpperCase().startsWith('AIO');
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="p-2 text-slate-400 font-mono text-center">{idx + 1}</td>
                                                    <td className="p-2 font-mono font-bold text-blue-700">{emp.employee_id}</td>
                                                    <td className="p-2 font-semibold text-slate-800">{emp.full_name}</td>
                                                    <td className="p-2 text-slate-600 truncate max-w-[150px]">{emp.store_name}</td>
                                                    <td className="p-2">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                                            isAIO
                                                                ? 'bg-purple-100 text-purple-800'
                                                                : 'bg-slate-100 text-slate-800'
                                                        }`}>
                                                            {isAIO && '📱 '}{roleStr}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : null}
                    </div>

                    {importError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{importError}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                    <span className="text-xs text-slate-500">
                        {parsedEmployees.length > 0 ? `Sẵn sàng nạp ${parsedEmployees.length} nhân viên lên Cloud` : 'Chưa có dữ liệu'}
                    </span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="button"
                            disabled={parsedEmployees.length === 0 || isImporting}
                            onClick={handleConfirmImport}
                            className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                        >
                            {isImporting ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Đang đồng bộ Cloud...</span>
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="w-4 h-4" />
                                    <span>Xác Nhận Nạp Dữ Liệu</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
