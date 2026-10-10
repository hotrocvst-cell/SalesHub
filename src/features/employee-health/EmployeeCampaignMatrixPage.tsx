import { useState, useEffect, useMemo } from 'react';
import {
    fetchEmployees,
    fetchCampaignDictionary,
    fetchEmployeeCampaignTargets,
    upsertEmployeeCampaignTargetsBatch,
    fetchClusterStores,
    type EmployeeCampaignTargetItem
} from '../../core/lib/storage';
import { getShortStoreName } from '../../core/lib/formatters';
import {
    Trophy,
    Save,
    RefreshCw,
    Search,
    UploadCloud,
    AlertCircle,
    Calendar,
    Grid,
    Store
} from 'lucide-react';

export default function EmployeeCampaignMatrixPage() {
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedStore, setSelectedStore] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [employees, setEmployees] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    // matrixTargets: { [empId]: { [rawKey]: targetValue } }
    const [matrixTargets, setMatrixTargets] = useState<Record<string, Record<string, number>>>({});

    const [loading, setLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [hasChanges, setHasChanges] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');

    // Modal dán dữ liệu ma trận từ Excel
    const [isPasteModalOpen, setIsPasteModalOpen] = useState<boolean>(false);
    const [pasteRawText, setPasteRawText] = useState<string>('');

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3000);
    };

    const loadData = async () => {
        setLoading(true);
        const [empRes, campRes, targetRes] = await Promise.all([
            fetchEmployees(),
            fetchCampaignDictionary(),
            fetchEmployeeCampaignTargets(selectedMonth, selectedYear)
        ]);

        if (empRes.success) setEmployees(empRes.data);

        // Chỉ lấy các NHÓM thi đua đang kích hoạt (is_active)
        const activeCamps = (campRes.data || []).filter((c: any) => c.is_active);
        setCampaigns(activeCamps);

        // Xây dựng ma trận mục tiêu
        const matrix: Record<string, Record<string, number>> = {};
        if (targetRes.success && targetRes.data) {
            targetRes.data.forEach((row: any) => {
                if (!matrix[row.employee_id]) {
                    matrix[row.employee_id] = {};
                }
                matrix[row.employee_id][row.raw_key] = Number(row.target_value || 0);
            });
        }
        setMatrixTargets(matrix);
        setHasChanges(false);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [selectedMonth, selectedYear]);

    // Danh sách siêu thị trong cụm
    const storeList = useMemo(() => {
        const s = new Set<string>();
        employees.forEach(e => {
            if (e.store_name) s.add(getShortStoreName(e.store_name));
        });
        return Array.from(s).sort();
    }, [employees]);

    // Bộ lọc danh sách nhân viên
    const filteredEmployees = useMemo(() => {
        return employees.filter(e => {
            const sName = getShortStoreName(e.store_name);
            const matchStore = selectedStore === 'all' || sName === selectedStore;
            const matchSearch = searchQuery.trim() === '' ||
                e.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.store_name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchStore && matchSearch;
        });
    }, [employees, selectedStore, searchQuery]);

    // Cập nhật giá trị một ô ma trận
    const handleCellChange = (empId: string, rawKey: string, val: number) => {
        setMatrixTargets(prev => ({
            ...prev,
            [empId]: {
                ...(prev[empId] || {}),
                [rawKey]: val
            }
        }));
        setHasChanges(true);
    };

    // Lưu theo đợt toàn bộ Ma Trận
    const handleBatchSaveMatrix = async () => {
        setIsSaving(true);
        const payloads: EmployeeCampaignTargetItem[] = [];

        employees.forEach(emp => {
            const empTargets = matrixTargets[emp.employee_id] || {};
            campaigns.forEach(camp => {
                const val = empTargets[camp.raw_key];
                // Chỉ lưu các ô có nhập số liệu hoặc đã từng có giá trị
                if (val !== undefined && val !== null) {
                    payloads.push({
                        employeeId: emp.employee_id,
                        rawKey: camp.raw_key,
                        month: selectedMonth,
                        year: selectedYear,
                        targetValue: Number(val) || 0
                    });
                }
            });
        });

        const res = await upsertEmployeeCampaignTargetsBatch(payloads);
        setIsSaving(false);

        if (res.success) {
            setHasChanges(false);
            showToast(`💾 Đã lưu thành công ${payloads.length} chỉ tiêu thi đua Tháng ${selectedMonth}/${selectedYear}!`);
        } else {
            showToast('⚠️ Lỗi khi lưu chỉ tiêu thi đua!');
        }
    };

    // Dán bảng Ma trận từ Excel
    // Định dạng copy từ Excel: Cột 1 = Mã NV, các cột tiếp theo = Target của từng chương trình theo đúng thứ tự hiển thị
    const handleProcessPastedMatrix = () => {
        if (!pasteRawText.trim() || campaigns.length === 0) return;

        const lines = pasteRawText.split('\n').map(l => l.trim()).filter(Boolean);
        const newMatrix = { ...matrixTargets };
        let rowCount = 0;

        lines.forEach(line => {
            const cols = line.split(/\t|\s{2,}/).map(c => c.trim());
            if (cols.length >= 2) {
                const empId = cols[0];
                if (!newMatrix[empId]) newMatrix[empId] = {};

                // Các cột kế tiếp tương ứng với danh sách campaigns đang hiển thị
                campaigns.forEach((camp, idx) => {
                    const rawVal = cols[idx + 1];
                    if (rawVal !== undefined && rawVal !== '') {
                        const num = parseFloat(rawVal.replace(/,/g, '')) || 0;
                        newMatrix[empId][camp.raw_key] = num;
                    }
                });
                rowCount++;
            }
        });

        if (rowCount > 0) {
            setMatrixTargets(newMatrix);
            setHasChanges(true);
            setIsPasteModalOpen(false);
            setPasteRawText('');
            showToast(`✅ Đã nạp dữ liệu target cho ${rowCount} nhân sự! Nhớ bấm "LƯU MA TRẬN".`);
        } else {
            showToast('⚠️ Dữ liệu dán không khớp định dạng!');
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-full mx-auto w-full">
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2">
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Grid className="w-5 h-5 text-indigo-600" />
                        <span>Ma Trận Chỉ Tiêu Thi Đua Nhân Viên</span>
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Cấu hình số lượng khoán cho từng chương trình thi đua (Bảo hiểm, Thẻ, Sim, Phụ kiện...) trong Tháng {selectedMonth}/{selectedYear}.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {hasChanges && (
                        <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl flex items-center gap-1 animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5" /> Có thay đổi chưa lưu!
                        </span>
                    )}

                    <button
                        onClick={() => setIsPasteModalOpen(true)}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                    >
                        <UploadCloud className="w-4 h-4 text-indigo-600" />
                        <span>Dán ma trận Excel</span>
                    </button>

                    <button
                        onClick={handleBatchSaveMatrix}
                        disabled={isSaving}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50 ${hasChanges
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400'
                            : 'bg-slate-800 hover:bg-slate-900 text-white'
                            }`}
                    >
                        <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                        <span>{isSaving ? 'ĐANG LƯU MA TRẬN...' : '💾 LƯU MA TRẬN THI ĐUA'}</span>
                    </button>
                </div>
            </div>

            {/* Bộ lọc */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="relative sm:col-span-2">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                        type="text"
                        placeholder="Tìm theo Mã NV, Họ Tên hoặc Siêu thị..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div>
                    <select
                        value={selectedStore}
                        onChange={(e) => setSelectedStore(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                        <option value="all">🏪 Tất cả siêu thị ({storeList.length})</option>
                        {storeList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

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

            {/* BẢNG MA TRẬN TARGET (MATRIX GRID) */}
            <div data-report-table="true" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs font-avo">
                <div className="overflow-x-auto no-scrollbar max-h-[70vh]">
                    <table className="w-full text-xs text-left border-collapse font-avo report-table">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-black tracking-wider sticky top-0 z-10 border-b border-slate-200">
                            <tr>
                                <th className="py-3 px-3 w-10 text-center bg-slate-100 sticky left-0 z-20">#</th>
                                <th className="py-3 px-3 w-24 bg-slate-100 sticky left-10 z-20">MÃ NV</th>
                                <th className="py-3 px-3 w-40 bg-slate-100 sticky left-34 z-20">HỌ VÀ TÊN</th>
                                <th className="py-3 px-3 w-44">SIÊU THỊ</th>

                                {/* CÁC CỘT THI ĐUA ĐỘNG TỪ TỪ ĐIỂN */}
                                {campaigns.map(c => (
                                    <th key={c.raw_key} className="py-3 px-3 text-center min-w-[110px] bg-slate-50 border-l border-slate-200">
                                        <div className="truncate text-indigo-700 font-extrabold">{c.display_name}</div>
                                        <span className="text-[9px] font-semibold text-slate-400 lowercase">({c.unit || 'cái'})</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={4 + campaigns.length} className="py-12 text-center text-slate-400 font-semibold">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                                        Đang nạp ma trận thi đua...
                                    </td>
                                </tr>
                            ) : filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={4 + campaigns.length} className="py-12 text-center text-slate-400 font-semibold">
                                        Không tìm thấy nhân viên nào!
                                    </td>
                                </tr>
                            ) : (
                                filteredEmployees.map((emp, idx) => (
                                    <tr key={emp.employee_id} className="hover:bg-indigo-50/20 transition">
                                        <td className="py-2 px-3 text-center text-slate-400 font-bold bg-white sticky left-0 z-10">{idx + 1}</td>
                                        <td className="py-2 px-3 font-mono font-bold text-indigo-600 bg-white sticky left-10 z-10">{emp.employee_id}</td>
                                        <td className="py-2 px-3 font-bold text-slate-800 bg-white sticky left-34 z-10 truncate max-w-[160px]">{emp.full_name}</td>
                                        <td className="py-2 px-3 text-slate-500 text-[11px] truncate max-w-[160px]">{getShortStoreName(emp.store_name)}</td>

                                        {/* CÁC Ô NHẬP TARGET THEO TỪNG CHƯƠNG TRÌNH */}
                                        {campaigns.map(camp => {
                                            const val = matrixTargets[emp.employee_id]?.[camp.raw_key] || '';
                                            return (
                                                <td key={camp.raw_key} className="py-1.5 px-2 border-l border-slate-100">
                                                    <input
                                                        type="number"
                                                        value={val}
                                                        placeholder="0"
                                                        onChange={(e) => handleCellChange(emp.employee_id, camp.raw_key, parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded-lg px-2 py-1 text-center font-mono font-bold text-xs text-slate-800 outline-none"
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DÁN MA TRẬN NHANH TỪ EXCEL */}
            {isPasteModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-[700px] w-full p-5 space-y-4 shadow-2xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2">
                                <UploadCloud className="w-5 h-5 text-indigo-600" />
                                <h3 className="font-extrabold text-sm text-slate-800 uppercase">Dán ma trận chỉ tiêu từ Excel</h3>
                            </div>
                            <button
                                onClick={() => setIsPasteModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="text-[11px] text-slate-500 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <p className="font-bold text-slate-700">📌 Thứ tự các cột copy từ Excel (Cách nhau bằng Tab):</p>
                            <p className="font-mono text-indigo-700 truncate">
                                Mã NV [tab] {campaigns.map(c => c.display_name).join(' [tab] ')}
                            </p>
                            <p className="italic text-[10px] text-slate-400">* Số lượng cột chỉ tiêu cần trùng khớp với thứ tự các chương trình đang hiển thị trên bảng.</p>
                        </div>

                        <textarea
                            rows={8}
                            value={pasteRawText}
                            onChange={(e) => setPasteRawText(e.target.value)}
                            placeholder={`26479\t15\t5\t30\t10\n10582\t10\t4\t20\t8`}
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
                                onClick={handleProcessPastedMatrix}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                            >
                                <Grid className="w-4 h-4" />
                                <span>NẠP VÀO MA TRẬN</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}