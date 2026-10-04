import { useState, useMemo } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, X, Trash2 } from 'lucide-react';
import type { EmployeeItem, StoreItem } from '../../../core/lib/storage';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    stores: StoreItem[];
    defaultStoreName: string;
    onImportSuccess: (count: number) => void;
}

export default function QuickPasteEmployeeModal({
    isOpen,
    onClose,
    stores,
    defaultStoreName,
    onImportSuccess
}: Props) {
    const [rawText, setRawText] = useState('');
    const [targetStore, setTargetStore] = useState(defaultStoreName || (stores[0]?.name ?? ''));
    const [targetRole, setTargetRole] = useState('Tư vấn bán hàng');

    if (!isOpen) return null;

    // Phân tích cú pháp văn bản
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
                    // Nếu cột 3 là chức danh
                    role = parts[2];
                } else if (parts.length >= 4) {
                    store = parts[2];
                    role = parts[3];
                }

                results.push({
                    employee_id: empId,
                    full_name: fullName,
                    store_name: store,
                    role: role,
                    is_active: true
                });
            }
        }
        return results;
    }, [rawText, targetStore, targetRole]);

    const handleConfirmImport = () => {
        if (parsedEmployees.length === 0) return;
        onImportSuccess(parsedEmployees.length);
        setRawText('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                            <UploadCloud className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-base leading-tight">Dán Nhanh Danh Sách Nhân Viên</h3>
                            <p className="text-xs text-blue-100">Copy từ file Excel, Google Sheet và dán vào đây</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto space-y-4 flex-1">
                    {/* Cấu hình mặc định */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Siêu thị gán mặc định:</label>
                            <select
                                value={targetStore}
                                onChange={e => setTargetStore(e.target.value)}
                                className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                            >
                                {stores.map(s => (
                                    <option key={s.id || s.code} value={s.name}>
                                        {s.name} ({s.code})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Chức danh mặc định:</label>
                            <select
                                value={targetRole}
                                onChange={e => setTargetRole(e.target.value)}
                                className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                            >
                                <option value="Tư vấn bán hàng">Tư vấn bán hàng</option>
                                <option value="Quản lý siêu thị">Quản lý siêu thị</option>
                                <option value="Trưởng ca bán hàng">Trưởng ca bán hàng</option>
                                <option value="Thu ngân">Thu ngân</option>
                                <option value="Kho / Kỹ thuật">Kho / Kỹ thuật</option>
                                <option value="AIO - TZ">AIO - TZ</option>
                                <option value="AIO - TGD">AIO - TGD</option>
                                <option value="AIO - ĐMX">AIO - ĐMX</option>
                            </select>
                        </div>
                    </div>

                    {/* Vùng nhập Text */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold text-slate-700">
                                Dán danh sách vào đây (Định dạng: Mã NV [tab] Họ và Tên):
                            </label>
                            {rawText && (
                                <button
                                    onClick={() => setRawText('')}
                                    className="text-[11px] text-rose-600 hover:underline flex items-center gap-1"
                                >
                                    <Trash2 className="w-3 h-3" /> Xóa trắng
                                </button>
                            )}
                        </div>
                        <textarea
                            rows={6}
                            value={rawText}
                            onChange={e => setRawText(e.target.value)}
                            placeholder={`Ví dụ copy từ Excel:\n260732\tNguyễn Thị Hồng Loan\n27560\tBùi Minh Lãm\n249041\tNguyễn Phương Nam`}
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
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Hợp lệ
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
                                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                                        <tr>
                                            <th className="p-2 border-b">STT</th>
                                            <th className="p-2 border-b">Mã NV</th>
                                            <th className="p-2 border-b">Họ và Tên</th>
                                            <th className="p-2 border-b">Siêu Thị</th>
                                            <th className="p-2 border-b">Chức Danh</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {parsedEmployees.slice(0, 50).map((emp, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="p-2 text-slate-400 font-mono">{idx + 1}</td>
                                                <td className="p-2 font-mono font-bold text-blue-700">{emp.employee_id}</td>
                                                <td className="p-2 font-semibold text-slate-800">{emp.full_name}</td>
                                                <td className="p-2 text-slate-600 truncate max-w-[150px]">{emp.store_name}</td>
                                                <td className="p-2 text-slate-600">{emp.role}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                        {parsedEmployees.length > 0 ? `Sẵn sàng nạp ${parsedEmployees.length} nhân viên` : 'Chưa có dữ liệu'}
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
                            disabled={parsedEmployees.length === 0}
                            onClick={handleConfirmImport}
                            className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                        >
                            <UploadCloud className="w-4 h-4" />
                            <span>Xác Nhận Nạp Dữ Liệu</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
