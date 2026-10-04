import { useState, useEffect, useMemo } from 'react';
import {
    fetchEmployees,
    upsertEmployeesBatch,
    deleteEmployeeById,
    fetchEmployeeTargets,
    upsertEmployeeTargetsBatch,
    fetchClusterStores,
    type EmployeeItem,
    type EmployeeTargetItem
} from '../../core/lib/storage';
import { formatValue, getShortStoreName } from '../../core/lib/formatters';
import {
    Users,
    Save,
    RefreshCw,
    Search,
    Store,
    UploadCloud,
    UserPlus,
    Trash2,
    AlertCircle
} from 'lucide-react';

const ROLE_OPTIONS = [
    'AIO - TGD',
    'AIO - ĐMX',
    'AIO - TZ',
    'AIO - NEW'
];

export default function EmployeeTargetPage() {
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedStore, setSelectedStore] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Danh sách siêu thị trong cụm do Boss quản lý
    const [clusterStores, setClusterStores] = useState<string[]>([]);

    // Danh sách nhân sự
    const [employees, setEmployees] = useState<any[]>([]);
    // Targets Map: { [empId]: { targetRevenue, targetWorkHours } }
    const [targetsMap, setTargetsMap] = useState<Record<string, { targetRevenue: number; targetWorkHours: number }>>({});

    const [loading, setLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');
    const [hasChanges, setHasChanges] = useState<boolean>(false);

    // Modal dán danh sách nhanh
    const [isPasteModalOpen, setIsPasteModalOpen] = useState<boolean>(false);
    const [pasteRawText, setPasteRawText] = useState<string>('');

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3000);
    };

    // Nạp dữ liệu siêu thị, nhân sự và mục tiêu
    const loadData = async () => {
        setLoading(true);

        // 1. Tải danh sách siêu thị cụm thực tế
        const storeRes = await fetchClusterStores();
        let stores: string[] = [];
        if (storeRes.success && storeRes.data.length > 0) {
            stores = storeRes.data;
        } else {
            // Fallback nếu chưa có bản ghi doanh thu nào
            stores = [
                '10335 - AAR_BRV_VTA - 290 Trương Công Định',
                '111 - TGD_BRV_VTA - 290 Trương Công Định'
            ];
        }
        setClusterStores(stores);

        // 2. Tải danh sách nhân sự & Target
        const empRes = await fetchEmployees();
        const targetRes = await fetchEmployeeTargets(selectedMonth, selectedYear);

        if (empRes.success) {
            setEmployees(empRes.data);
        }

        const tMap: Record<string, { targetRevenue: number; targetWorkHours: number }> = {};
        if (targetRes.success && targetRes.data) {
            targetRes.data.forEach((item: any) => {
                tMap[item.employee_id] = {
                    targetRevenue: Number(item.target_revenue || 0),
                    targetWorkHours: Number(item.target_work_hours || 208)
                };
            });
        }
        setTargetsMap(tMap);
        setHasChanges(false);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [selectedMonth, selectedYear]);

    // DANH SÁCH SIÊU THỊ ĐÃ KHỬ TRÙNG (DÙNG CHO SELECT & BỘ LỌC)
    const storeList = useMemo(() => {
        const storeMap = new Map<string, string>();

        // Ưu tiên danh sách siêu thị trong cụm
        clusterStores.forEach(s => {
            const short = getShortStoreName(s.trim());
            if (short) storeMap.set(short, s.trim());
        });

        // Thêm siêu thị từ danh sách nhân viên nếu có phát sinh
        employees.forEach(e => {
            if (e.store_name && e.store_name.trim()) {
                const raw = e.store_name.trim();
                const short = getShortStoreName(raw);
                if (!storeMap.has(short) || raw.length > (storeMap.get(short)?.length || 0)) {
                    storeMap.set(short, raw);
                }
            }
        });

        return Array.from(storeMap.values()).sort((a, b) =>
            getShortStoreName(a).localeCompare(getShortStoreName(b))
        );
    }, [clusterStores, employees]);

    // Bộ lọc danh sách hiển thị
    const filteredEmployees = useMemo(() => {
        return employees.filter(e => {
            const empShort = getShortStoreName(e.store_name);
            const filterShort = selectedStore === 'all' ? 'all' : getShortStoreName(selectedStore);
            const matchStore = filterShort === 'all' || empShort === filterShort;

            const matchSearch = searchQuery.trim() === '' ||
                e.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.store_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (e.role && e.role.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchStore && matchSearch;
        });
    }, [employees, selectedStore, searchQuery]);

    // 1. THÊM 1 NHÂN VIÊN MỚI THỦ CÔNG (CHÈN DÒNG TRỐNG VÀO ĐẦU BẢNG)
    const handleAddNewEmployeeRow = () => {
        const defaultStore = storeList.length > 0 ? storeList[0] : '10335 - AAR_BRV_VTA - 290 Trương Công Định';
        const tempEmpId = `NV_${Date.now().toString().slice(-4)}`; // Tạo ID tạm thời, người dùng sửa lại

        const newEmp = {
            employee_id: tempEmpId,
            full_name: '',
            store_name: defaultStore,
            role: 'Tư vấn bán hàng',
            isNew: true
        };

        setEmployees(prev => [newEmp, ...prev]);
        setTargetsMap(prev => ({
            ...prev,
            [tempEmpId]: { targetRevenue: 0, targetWorkHours: 208 }
        }));
        setHasChanges(true);
        showToast('✨ Đã thêm 1 dòng trống ở đầu bảng. Vui lòng nhập thông tin!');
    };

    // Cập nhật thông tin cơ bản
    const handleEmployeeFieldChange = (oldEmpId: string, field: 'employee_id' | 'store_name' | 'role' | 'full_name', value: string) => {
        setEmployees(prev => prev.map(item => {
            if (item.employee_id === oldEmpId) {
                return { ...item, [field]: value };
            }
            return item;
        }));

        // Nếu đổi mã nhân viên, cập nhật key tương ứng trong targetsMap
        if (field === 'employee_id' && value !== oldEmpId) {
            setTargetsMap(prev => {
                const copy = { ...prev };
                if (copy[oldEmpId]) {
                    copy[value] = copy[oldEmpId];
                    delete copy[oldEmpId];
                }
                return copy;
            });
        }

        setHasChanges(true);
    };

    // Cập nhật mục tiêu
    const handleTargetChange = (empId: string, field: 'targetRevenue' | 'targetWorkHours', val: number) => {
        setTargetsMap(prev => ({
            ...prev,
            [empId]: {
                targetRevenue: field === 'targetRevenue' ? val : (prev[empId]?.targetRevenue || 0),
                targetWorkHours: field === 'targetWorkHours' ? val : (prev[empId]?.targetWorkHours || 208)
            }
        }));
        setHasChanges(true);
    };

    // THAO TÁC LƯU THEO ĐỢT (BATCH SAVE)
    const handleBatchSaveAll = async () => {
        // Kiểm tra tính hợp lệ
        for (const emp of employees) {
            if (!emp.employee_id || !emp.employee_id.trim()) {
                showToast('⚠️ Có nhân viên chưa nhập Mã NV!');
                return;
            }
            if (!emp.full_name || !emp.full_name.trim()) {
                showToast(`⚠️ Vui lòng nhập Họ Tên cho nhân viên [${emp.employee_id}]!`);
                return;
            }
        }

        setIsSaving(true);

        const empPayloads: EmployeeItem[] = employees.map(e => ({
            employeeId: e.employee_id.trim(),
            fullName: e.full_name.trim(),
            storeName: e.store_name.trim(),
            role: e.role || 'Tư vấn bán hàng'
        }));

        const targetPayloads: EmployeeTargetItem[] = employees.map(e => ({
            employeeId: e.employee_id.trim(),
            month: selectedMonth,
            year: selectedYear,
            targetRevenue: targetsMap[e.employee_id]?.targetRevenue || 0,
            targetWorkHours: targetsMap[e.employee_id]?.targetWorkHours || 208
        }));

        const [empRes, targetRes] = await Promise.all([
            upsertEmployeesBatch(empPayloads),
            upsertEmployeeTargetsBatch(targetPayloads)
        ]);

        setIsSaving(false);

        if (empRes.success && targetRes.success) {
            setHasChanges(false);
            showToast(`💾 Đã lưu thành công ${employees.length} nhân sự & mục tiêu Tháng ${selectedMonth}!`);
            loadData();
        } else {
            showToast('⚠️ Lỗi khi đồng bộ dữ liệu lên Supabase!');
        }
    };

    // Xóa nhân viên
    const handleDeleteEmployee = async (empId: string, name: string) => {
        if (window.confirm(`Xác nhận xóa nhân viên [${name || empId}]?`)) {
            const res = await deleteEmployeeById(empId);
            if (res.success) {
                showToast(`🗑️ Đã xóa nhân viên!`);
                setEmployees(prev => prev.filter(e => e.employee_id !== empId));
            } else {
                showToast('Lỗi khi xóa nhân viên!');
            }
        }
    };

    // Xử lý dán danh sách nhanh
    const handleProcessPastedData = async () => {
        if (!pasteRawText.trim()) return;

        const lines = pasteRawText.split('\n').map(l => l.trim()).filter(Boolean);
        const newEmployees: EmployeeItem[] = [];
        const newTargets: EmployeeTargetItem[] = [];
        const defaultStore = storeList[0] || '10335 - AAR_BRV_VTA - 290 Trương Công Định';

        lines.forEach(line => {
            const p = line.split(/\t|\s{2,}/).map(x => x.trim()).filter(Boolean);
            if (p.length >= 2) {
                const empId = p[0];
                const fullName = p[1];
                const storeName = p[2] || defaultStore;
                const role = p[3] && isNaN(Number(p[3])) ? p[3] : 'Tư vấn bán hàng';
                const targetVal = parseFloat(String(p[4] || (p[3] && !isNaN(Number(p[3])) ? p[3] : '0')).replace(/,/g, '')) || 0;

                newEmployees.push({
                    employeeId: empId,
                    fullName,
                    storeName,
                    role
                });

                newTargets.push({
                    employeeId: empId,
                    month: selectedMonth,
                    year: selectedYear,
                    targetRevenue: targetVal,
                    targetWorkHours: 208
                });
            }
        });

        if (newEmployees.length > 0) {
            const empRes = await upsertEmployeesBatch(newEmployees);
            const tarRes = await upsertEmployeeTargetsBatch(newTargets);

            if (empRes.success && tarRes.success) {
                showToast(`✅ Đã nạp thành công ${newEmployees.length} nhân sự mới!`);
                setIsPasteModalOpen(false);
                setPasteRawText('');
                loadData();
            } else {
                showToast('Lỗi khi lưu dữ liệu import!');
            }
        } else {
            showToast('⚠️ Dữ liệu dán không đúng cấu trúc!');
        }
    };

    // Tính tổng target
    const totalTargetSum = useMemo(() => {
        return filteredEmployees.reduce((sum, emp) => {
            return sum + (targetsMap[emp.employee_id]?.targetRevenue || 0);
        }, 0);
    }, [filteredEmployees, targetsMap]);

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-[1350px] mx-auto w-full">
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2">
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600" />
                        <span>Quản Lý Nhân Sự & Mục Tiêu Tháng</span>
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Phân bổ chỉ tiêu cho nhân viên thuộc {storeList.length} siêu thị trong cụm. Cho phép thêm thủ công, dán hàng loạt và lưu theo đợt.
                    </p>
                </div>

                {/* Thanh công cụ nút bấm */}
                <div className="flex items-center gap-2 flex-wrap">
                    {hasChanges && (
                        <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl flex items-center gap-1 animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5" /> Có thay đổi chưa lưu!
                        </span>
                    )}

                    {/* Nút 1: Thêm dòng thủ công */}
                    <button
                        onClick={handleAddNewEmployeeRow}
                        className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                    >
                        <UserPlus className="w-4 h-4 text-indigo-600" />
                        <span>+ Thêm nhân sự</span>
                    </button>

                    {/* Nút 2: Dán danh sách nhanh */}
                    <button
                        onClick={() => setIsPasteModalOpen(true)}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                    >
                        <UploadCloud className="w-4 h-4 text-slate-600" />
                        <span>Dán danh sách</span>
                    </button>

                    {/* Nút 3: Lưu theo đợt */}
                    <button
                        onClick={handleBatchSaveAll}
                        disabled={isSaving}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50 ${hasChanges
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400'
                            : 'bg-slate-800 hover:bg-slate-900 text-white'
                            }`}
                    >
                        <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                        <span>{isSaving ? 'ĐANG LƯU TẤT CẢ...' : '💾 LƯU THAY ĐỔI & MỤC TIÊU'}</span>
                    </button>
                </div>
            </div>

            {/* Bộ lọc tháng & tìm kiếm */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* Tìm kiếm */}
                <div className="relative sm:col-span-2">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                        type="text"
                        placeholder="Tìm theo Mã NV, Họ Tên, Vị trí hoặc Siêu thị..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {/* Lọc Siêu thị trong cụm */}
                <div>
                    <select
                        value={selectedStore}
                        onChange={(e) => setSelectedStore(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                        <option value="all">🏪 Tất cả siêu thị trong cụm ({storeList.length})</option>
                        {storeList.map(s => <option key={s} value={s}>{getShortStoreName(s)}</option>)}
                    </select>
                </div>

                {/* Lọc Tháng */}
                <div className="flex items-center gap-2">
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <option key={m} value={m}>Tháng {m}/{selectedYear}</option>
                        ))}
                    </select>

                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                        title="Làm mới"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Thẻ Thống kê */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-xl border-l-4 border-indigo-500 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">TỔNG NHÂN SỰ ĐANG QUẢN LÝ</span>
                    <div className="text-xl font-black text-slate-800 mt-1">{filteredEmployees.length} nhân viên</div>
                    <span className="text-[11px] text-slate-400 font-medium">Thuộc {storeList.length} siêu thị cụm</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border-l-4 border-emerald-500 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">TỔNG TARGET DOANH THU THÁNG {selectedMonth}</span>
                    <div className="text-xl font-black text-emerald-600 mt-1">{formatValue(totalTargetSum)}</div>
                    <span className="text-[11px] text-slate-400 font-medium">
                        Bình quân: {formatValue(filteredEmployees.length ? totalTargetSum / filteredEmployees.length : 0)} / NV
                    </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border-l-4 border-amber-500 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">ĐỊNH MỨC GIỜ CÔNG KHOÁN</span>
                    <div className="text-xl font-black text-amber-600 mt-1">208 giờ / tháng</div>
                    <span className="text-[11px] text-slate-400 font-medium">Định mức 26 công chuẩn (8h/ngày)</span>
                </div>
            </div>

            {/* Bảng Danh sách - Chỉnh sửa trực tiếp */}
            <div data-report-table="true" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs font-avo">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-xs text-left min-w-[950px] font-avo report-table">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-black tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="py-3 px-3 w-12 text-center">#</th>
                                <th className="py-3 px-3 w-32">MÃ NV</th>
                                <th className="py-3 px-3 w-48">HỌ VÀ TÊN</th>
                                <th className="py-3 px-3 w-56">SIÊU THỊ TRỰC THUỘC (CỤM)</th>
                                <th className="py-3 px-3 w-44">VỊ TRÍ / CHỨC DANH</th>
                                <th className="py-3 px-3 w-36">TARGET DT (TR.Đ)</th>
                                <th className="py-3 px-3 w-28">GIỜ CÔNG</th>
                                <th className="py-3 px-3 w-14 text-center">XÓA</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400 font-semibold">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                                        Đang nạp dữ liệu nhân sự...
                                    </td>
                                </tr>
                            ) : filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400 font-semibold">
                                        Chưa có nhân viên nào. Bấm <b>"+ Thêm nhân sự"</b> để nhập dòng mới!
                                    </td>
                                </tr>
                            ) : (
                                filteredEmployees.map((emp, idx) => {
                                    const curTargetRev = targetsMap[emp.employee_id]?.targetRevenue || 0;
                                    const curTargetHours = targetsMap[emp.employee_id]?.targetWorkHours || 208;

                                    return (
                                        <tr key={emp.employee_id || idx} className={`hover:bg-indigo-50/30 transition ${emp.isNew ? 'bg-amber-50/50' : ''}`}>
                                            <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>

                                            {/* Mã NV: Nhập trực tiếp */}
                                            <td className="py-2 px-3">
                                                <input
                                                    type="text"
                                                    value={emp.employee_id}
                                                    placeholder="Mã NV..."
                                                    onChange={(e) => handleEmployeeFieldChange(emp.employee_id, 'employee_id', e.target.value)}
                                                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-indigo-500 rounded-lg px-2 py-1 font-mono font-bold text-indigo-600 outline-none"
                                                />
                                            </td>

                                            {/* Họ và Tên: Nhập trực tiếp */}
                                            <td className="py-2 px-3">
                                                <input
                                                    type="text"
                                                    value={emp.full_name}
                                                    placeholder="Nhập họ và tên..."
                                                    onChange={(e) => handleEmployeeFieldChange(emp.employee_id, 'full_name', e.target.value)}
                                                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-indigo-500 rounded-lg px-2 py-1 font-bold text-slate-800 outline-none"
                                                />
                                            </td>

                                            {/* Chọn Siêu thị (Chỉ gồm các siêu thị trong cụm) */}
                                            <td className="py-2 px-3">
                                                <select
                                                    value={emp.store_name}
                                                    onChange={(e) => handleEmployeeFieldChange(emp.employee_id, 'store_name', e.target.value)}
                                                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                >
                                                    {storeList.map(s => (
                                                        <option key={s} value={s}>{getShortStoreName(s)}</option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Chọn Vị trí */}
                                            <td className="py-2 px-3">
                                                <select
                                                    value={emp.role || 'Tư vấn bán hàng'}
                                                    onChange={(e) => handleEmployeeFieldChange(emp.employee_id, 'role', e.target.value)}
                                                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                >
                                                    {ROLE_OPTIONS.map(r => (
                                                        <option key={r} value={r}>{r}</option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Target Doanh thu */}
                                            <td className="py-2 px-3">
                                                <input
                                                    type="number"
                                                    value={curTargetRev || ''}
                                                    placeholder="0"
                                                    onChange={(e) => handleTargetChange(emp.employee_id, 'targetRevenue', parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500"
                                                />
                                            </td>

                                            {/* Giờ công khoán */}
                                            <td className="py-2 px-3">
                                                <input
                                                    type="number"
                                                    value={curTargetHours || ''}
                                                    placeholder="208"
                                                    onChange={(e) => handleTargetChange(emp.employee_id, 'targetWorkHours', parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs font-mono font-medium text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </td>

                                            <td className="py-2 px-3 text-center">
                                                <button
                                                    onClick={() => handleDeleteEmployee(emp.employee_id, emp.full_name)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                                                    title="Xóa nhân viên này"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal dán danh sách */}
            {isPasteModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-[650px] w-full p-5 space-y-4 shadow-2xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2">
                                <UploadCloud className="w-5 h-5 text-indigo-600" />
                                <h3 className="font-extrabold text-sm text-slate-800 uppercase">Dán danh sách nhân sự & Target</h3>
                            </div>
                            <button
                                onClick={() => setIsPasteModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="text-[11px] text-slate-500 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <p className="font-bold text-slate-700">📌 Định dạng cột copy từ Excel (Cách nhau bằng Tab):</p>
                            <p className="font-mono text-indigo-700">Mã NV [tab] Họ và Tên [tab] Tên Siêu Thị [tab] Vị trí [tab] Target DT</p>
                        </div>

                        <textarea
                            rows={8}
                            value={pasteRawText}
                            onChange={(e) => setPasteRawText(e.target.value)}
                            placeholder={`26479\tĐào Bá Linh\t10335 - AAR_BRV_VTA - 290 Trương Công Định\tTư vấn bán hàng\t250\n10582\tNguyễn Văn A\t111 - TGD_BRV_VTA - 290 Trương Công Định\tKho / Hỗ trợ kỹ thuật\t180`}
                            className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-slate-800"
                        />

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                            <button
                                onClick={() => setIsPasteModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                                HỦY BỎ
                            </button>
                            <button
                                onClick={handleProcessPastedData}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                            >
                                <UserPlus className="w-4 h-4" />
                                <span>NẠP VÀO HỆ THỐNG</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}