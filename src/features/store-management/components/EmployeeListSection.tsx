import { useState, useMemo } from 'react';
import type { EmployeeItem, StoreItem } from '../../../core/lib/storage';
import { formatCapitalizeWords } from '../../../core/lib/formatters';
import {
    Users,
    Plus,
    Search,
    Edit2,
    Trash2,
    UploadCloud,
    Download,
    CheckCircle2,
    XCircle,
    X,
    Save,
    AlertCircle,
    Store,
    Briefcase
} from 'lucide-react';

interface Props {
    employees: EmployeeItem[];
    stores: StoreItem[];
    canConfigure: boolean;
    onSaveEmployee: (emp: Partial<EmployeeItem>) => Promise<boolean>;
    onDeleteEmployee: (id: string, name: string) => Promise<boolean>;
    onOpenQuickPaste: () => void;
    onOpenRoleModal: () => void;
}

// DANH MỤC VAI TRÒ (VAI TRÒ CŨNG LÀ BỘ PHẬN)
const COMMON_ROLES = [
    { value: 'Quản lý', label: 'Quản Lý', icon: '👑' },
    { value: 'Trưởng ca', label: 'Trưởng Ca', icon: '⭐' },
    { value: 'Nhân viên', label: 'Nhân Viên', icon: '👤' },
    { value: 'AIO', label: 'AIO', icon: '📱' },
    { value: 'AIO - TZ', label: 'AIO - TZ', icon: '📱' },
    { value: 'AIO - TGD', label: 'AIO - TGD', icon: '📱' },
    { value: 'AIO - ĐMX', label: 'AIO - ĐMX', icon: '📱' },
    { value: 'Tư vấn bán hàng', label: 'Tư vấn bán hàng', icon: '👥' },
    { value: 'Thu ngân', label: 'Thu ngân', icon: '💳' },
    { value: 'Kho / Kỹ thuật', label: 'Kho / Kỹ thuật', icon: '📦' }
];

export default function EmployeeListSection({
    employees,
    stores,
    canConfigure,
    onSaveEmployee,
    onDeleteEmployee,
    onOpenQuickPaste,
    onOpenRoleModal
}: Props) {
    const [selectedStoreFilter, setSelectedStoreFilter] = useState('all');
    const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmp, setEditingEmp] = useState<Partial<EmployeeItem> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Lọc danh sách nhân viên theo Siêu thị và Vai trò (Vai trò cũng là bộ phận)
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const roleStr = (emp.role || emp.job_title || '').toLowerCase();
            const matchStore = selectedStoreFilter === 'all' || emp.store_name === selectedStoreFilter;
            
            let matchRole = true;
            if (selectedRoleFilter !== 'all') {
                const target = selectedRoleFilter.toLowerCase();
                if (target === 'aio') {
                    matchRole = roleStr.includes('aio');
                } else if (target === 'quản lý') {
                    matchRole = roleStr.includes('quản lý') || roleStr.includes('quan_ly');
                } else if (target === 'trưởng ca') {
                    matchRole = roleStr.includes('trưởng ca') || roleStr.includes('truong_ca');
                } else if (target === 'nhân viên') {
                    matchRole = !roleStr.includes('quản lý') && !roleStr.includes('quan_ly') && !roleStr.includes('trưởng ca') && !roleStr.includes('truong_ca');
                } else {
                    matchRole = roleStr.includes(target);
                }
            }

            const q = searchQuery.toLowerCase().trim();
            const matchSearch =
                !q ||
                emp.employee_id.toLowerCase().includes(q) ||
                emp.full_name.toLowerCase().includes(q) ||
                emp.store_name.toLowerCase().includes(q) ||
                roleStr.includes(q);

            return matchStore && matchRole && matchSearch;
        });
    }, [employees, selectedStoreFilter, selectedRoleFilter, searchQuery]);

    const handleOpenAdd = () => {
        if (!canConfigure) {
            onOpenRoleModal();
            return;
        }
        setEditingEmp({
            employee_id: '',
            full_name: '',
            store_name: selectedStoreFilter !== 'all' ? selectedStoreFilter : (stores[0]?.name || ''),
            role: 'Nhân viên',
            is_active: true
        });
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (emp: EmployeeItem) => {
        if (!canConfigure) {
            onOpenRoleModal();
            return;
        }
        setEditingEmp({
            ...emp,
            role: emp.role || emp.job_title || 'Nhân viên'
        });
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingEmp?.employee_id?.trim() || !editingEmp?.full_name?.trim()) {
            setErrorMsg('Vui lòng nhập đầy đủ Mã nhân viên và Họ tên!');
            return;
        }
        setIsSaving(true);
        setErrorMsg('');
        const chosenRole = editingEmp.role?.trim() || 'Nhân viên';
        const payload: Partial<EmployeeItem> = {
            ...editingEmp,
            full_name: formatCapitalizeWords(editingEmp.full_name.trim()),
            role: chosenRole,
            job_title: chosenRole
        };
        const ok = await onSaveEmployee(payload);
        setIsSaving(false);
        if (ok) {
            setIsModalOpen(false);
            setEditingEmp(null);
        } else {
            setErrorMsg('Lưu thất bại! Vui lòng kiểm tra lại kết nối mạng hoặc dữ liệu nhập.');
        }
    };

    const handleDelete = async (emp: EmployeeItem) => {
        if (!canConfigure) {
            onOpenRoleModal();
            return;
        }
        if (window.confirm(`Bạn có chắc chắn muốn xóa nhân viên [${emp.full_name} - ${emp.employee_id}]?`)) {
            await onDeleteEmployee(emp.id!, emp.full_name);
        }
    };

    const handleToggleActive = async (emp: EmployeeItem) => {
        if (!canConfigure) {
            onOpenRoleModal();
            return;
        }
        await onSaveEmployee({
            ...emp,
            is_active: !emp.is_active
        });
    };

    const handleExportCsv = () => {
        if (filteredEmployees.length === 0) return;
        const headers = ['STT,Mã NV,Họ và Tên,Siêu Thị,Vai Trò,Trạng Thái'];
        const rows = filteredEmployees.map((e, idx) => {
            const role = e.role || e.job_title || 'Nhân viên';
            return `${idx + 1},"${e.employee_id}","${e.full_name}","${e.store_name}","${role}","${e.is_active !== false ? 'Đang làm việc' : 'Nghỉ việc'}"`;
        });
        const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Danh_sach_nhan_vien_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-4">
            {/* Toolbar Bộ lọc & Thao tác */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Filter Siêu thị và Vai trò (Vai trò cũng là bộ phận) */}
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            <Store className="w-4 h-4 text-blue-600" />
                            <span>Siêu thị:</span>
                        </div>
                        <select
                            value={selectedStoreFilter}
                            onChange={e => setSelectedStoreFilter(e.target.value)}
                            className="text-xs font-semibold px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-800"
                        >
                            <option value="all">🏢 Tất cả siêu thị ({stores.length})</option>
                            {stores.map(s => (
                                <option key={s.id || s.code} value={s.name}>
                                    {s.name} ({s.code})
                                </option>
                            ))}
                        </select>

                        {/* Filter Vai trò */}
                        <div className="flex items-center gap-1 text-xs font-bold text-slate-700 ml-1">
                            <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Vai trò:</span>
                        </div>
                        <select
                            value={selectedRoleFilter}
                            onChange={e => setSelectedRoleFilter(e.target.value)}
                            className="text-xs font-semibold px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-800"
                        >
                            <option value="all">Mọi vai trò</option>
                            <option value="quản lý">👑 Quản Lý</option>
                            <option value="trưởng ca">⭐ Trưởng Ca</option>
                            <option value="nhân viên">👤 Nhân Viên</option>
                            <option value="aio">📱 AIO (Tất cả)</option>
                        </select>
                    </div>

                    {/* Nút hành động */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleExportCsv}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                            title="Xuất file CSV"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Xuất Excel</span>
                        </button>
                        <button
                            onClick={() => {
                                if (!canConfigure) onOpenRoleModal();
                                else onOpenQuickPaste();
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>Dán Nhanh</span>
                        </button>
                        <button
                            onClick={handleOpenAdd}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Thêm Nhân Viên</span>
                        </button>
                    </div>
                </div>

                {/* Tìm kiếm */}
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo mã NV, họ tên, vai trò (AIO, Quản lý, Nhân viên...)..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                </div>
            </div>

            {/* Bảng Danh sách nhân viên */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-blue-600" />
                        <span>Tổng số nhân sự: {filteredEmployees.length} nhân viên</span>
                    </span>
                    <span className="text-slate-400 text-[11px]">
                        Hệ thống vận hành theo 3 vai trò: Quản Lý • Trưởng Ca • Nhân Viên
                    </span>
                </div>

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-200 sticky top-0 z-10 text-[11px]">
                            <tr>
                                <th className="py-2 px-2.5 w-10 text-center">STT</th>
                                <th className="py-2 px-2.5 w-20">Mã NV</th>
                                <th className="py-2 px-2.5">Họ và Tên</th>
                                <th className="py-2 px-2.5">Siêu Thị</th>
                                <th className="py-2 px-2.5 w-36">Vai Trò</th>
                                <th className="py-2 px-2.5 w-24 text-center">Trạng Thái</th>
                                <th className="py-2 px-2.5 w-20 text-right">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                                        Không tìm thấy nhân viên nào phù hợp.
                                    </td>
                                </tr>
                            ) : (
                                filteredEmployees.map((emp, index) => {
                                    const roleStr = emp.role || emp.job_title || 'Nhân viên';
                                    const lower = roleStr.toLowerCase();
                                    const isAIO = lower.includes('aio');
                                    const isManager = lower.includes('quản lý') || lower.includes('quan_ly');
                                    const isShiftLeader = lower.includes('trưởng ca') || lower.includes('truong_ca');

                                    return (
                                        <tr key={emp.id || emp.employee_id} className="hover:bg-slate-50/80 transition">
                                            <td className="py-2 px-2.5 text-center font-mono text-slate-400 font-semibold">
                                                {index + 1}
                                            </td>
                                            <td className="py-2 px-2.5 font-mono font-bold text-blue-700">
                                                {emp.employee_id}
                                            </td>
                                            <td className="py-2 px-2.5 font-extrabold text-slate-800">
                                                {emp.full_name}
                                            </td>
                                            <td className="py-2 px-2.5 text-slate-600 font-medium max-w-[150px] truncate" title={emp.store_name}>
                                                {emp.store_name}
                                            </td>
                                            <td className="py-2 px-2.5">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                                                    isAIO
                                                        ? 'bg-purple-50 text-purple-700 border border-purple-200 font-extrabold'
                                                        : isManager
                                                        ? 'bg-amber-50 text-amber-800 border border-amber-200 font-extrabold'
                                                        : isShiftLeader
                                                        ? 'bg-blue-50 text-blue-800 border border-blue-200 font-extrabold'
                                                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                }`}>
                                                    <span>{isAIO ? '📱' : isManager ? '👑' : isShiftLeader ? '⭐' : '👤'}</span>
                                                    <span>{roleStr}</span>
                                                </span>
                                            </td>
                                            <td className="py-2 px-2.5 text-center">
                                                <button
                                                    onClick={() => handleToggleActive(emp)}
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition ${
                                                        emp.is_active !== false
                                                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {emp.is_active !== false ? (
                                                        <>
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                            <span>Làm việc</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="w-3 h-3 text-slate-400" />
                                                            <span>Nghỉ</span>
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                            <td className="py-2 px-2.5 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleOpenEdit(emp)}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                                        title="Sửa nhân viên"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(emp)}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                                        title="Xóa nhân viên"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
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

            {/* Modal Thêm / Sửa nhân viên */}
            {isModalOpen && editingEmp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-4 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-amber-300" />
                                <div>
                                    <h3 className="font-extrabold text-sm">
                                        {editingEmp.id ? 'Chỉnh Sửa Nhân Viên' : 'Thêm Nhân Viên Mới'}
                                    </h3>
                                    <p className="text-[11px] text-blue-200">Vai trò vận hành: Quản Lý • Trưởng Ca • Nhân Viên (AIO)</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-5 space-y-3.5">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                    Mã Nhân Viên <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ví dụ: 260732, 27560..."
                                    value={editingEmp.employee_id || ''}
                                    onChange={e => setEditingEmp({ ...editingEmp, employee_id: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono font-bold text-slate-900"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                    Họ và Tên Nhân Viên <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ví dụ: Nguyễn Thị Hồng Loan"
                                    value={editingEmp.full_name || ''}
                                    onChange={e => setEditingEmp({ ...editingEmp, full_name: e.target.value })}
                                    onBlur={() => setEditingEmp(prev => prev ? { ...prev, full_name: formatCapitalizeWords(prev.full_name || '') } : prev)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                    Siêu Thị Trực Thuộc <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={editingEmp.store_name || ''}
                                    onChange={e => setEditingEmp({ ...editingEmp, store_name: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900"
                                    required
                                >
                                    {stores.map(s => (
                                        <option key={s.id || s.code} value={s.name}>
                                            {s.name} ({s.code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* VAI TRÒ (VAI TRÒ CŨNG LÀ BỘ PHẬN) */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1 flex items-center gap-1">
                                    <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Vai Trò Nhân Sự:</span>
                                </label>
                                <select
                                    value={editingEmp.role || 'Nhân viên'}
                                    onChange={e => setEditingEmp({ ...editingEmp, role: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                                >
                                    {COMMON_ROLES.map(r => (
                                        <option key={r.value} value={r.value}>
                                            {r.icon} {r.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="empActiveCheck"
                                    checked={editingEmp.is_active !== false}
                                    onChange={e => setEditingEmp({ ...editingEmp, is_active: e.target.checked })}
                                    className="rounded-sm text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                                <label htmlFor="empActiveCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
                                    Đang làm việc (Kích hoạt chấm công & chỉ tiêu)
                                </label>
                            </div>

                            {errorMsg && (
                                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            <div className="flex gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" />
                                    <span>{isSaving ? 'Đang lưu...' : 'Lưu Nhân Viên'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
