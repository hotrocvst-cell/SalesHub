import { useState, useMemo, useEffect } from 'react';
import { parseEmployeeRevenueText, detectStoreFromRawText, type ParsedEmployeeRevenue } from '../utils/employeeParsers';
import { formatEmployeeRevenueToRawText } from '../utils/sessionStorage';
import type { EmployeeItem } from '../../../core/lib/storage';
import {
    Coins,
    CheckCircle2,
    AlertCircle,
    Trash2,
    ArrowRight,
    Store,
    Users,
    Filter,
    UserX,
    ChevronDown,
    ChevronUp
} from 'lucide-react';

interface Props {
    onApply: (data: ParsedEmployeeRevenue[], detectedStore?: string | null) => void;
    initialData?: ParsedEmployeeRevenue[];
    configuredEmployees?: EmployeeItem[];
    currentStoreName?: string;
}

export default function RevenuePasteTab({
    onApply,
    initialData = [],
    configuredEmployees = [],
    currentStoreName = 'all'
}: Props) {
    const [rawText, setRawText] = useState('');
    const [parsedList, setParsedList] = useState<ParsedEmployeeRevenue[]>(initialData);
    const [detectedStore, setDetectedStore] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    // Tiêu chí: Mặc định luôn lọc theo danh sách cấu hình khai báo nhân viên theo siêu thị
    const [filterByConfigured, setFilterByConfigured] = useState<boolean>(true);
    const [showExcluded, setShowExcluded] = useState<boolean>(false);

    useEffect(() => {
        if (initialData && initialData.length > 0) {
            setParsedList(initialData);
            if (!rawText) {
                setRawText(formatEmployeeRevenueToRawText(initialData));
            }
        }
    }, [initialData]);

    // Cho phép sửa trực tiếp giá trị trong ô input của từng nhân viên
    const handleUpdateMetric = (empId: string, field: keyof ParsedEmployeeRevenue, value: number) => {
        setParsedList(prev => {
            const next = prev.map(item => {
                if (item.employee_id === empId) {
                    return { ...item, [field]: value };
                }
                return item;
            });
            onApply(next, detectedStore);
            return next;
        });
    };

    const handleRemoveEmployee = (empId: string) => {
        setParsedList(prev => {
            const next = prev.filter(item => item.employee_id !== empId);
            onApply(next, detectedStore);
            return next;
        });
    };

    const handleParse = (text: string) => {
        setRawText(text);
        setErrorMsg('');
        if (!text.trim()) {
            setParsedList([]);
            setDetectedStore(null);
            return;
        }

        const results = parseEmployeeRevenueText(text);
        const storeName = detectStoreFromRawText(text);
        setDetectedStore(storeName);

        if (results.length === 0) {
            setErrorMsg('Không tìm thấy dòng dữ liệu doanh thu nhân viên hợp lệ! Hãy copy bảng hoặc toàn bộ trang Dashboard.');
            setParsedList([]);
        } else {
            setParsedList(results);
        }
    };

    // Phân loại nhân viên: Hợp lệ theo cấu hình siêu thị vs Ngoài danh sách cấu hình
    const { validList, excludedList } = useMemo(() => {
        if (!filterByConfigured || configuredEmployees.length === 0) {
            return { validList: parsedList, excludedList: [] as ParsedEmployeeRevenue[] };
        }

        const configuredSet = new Set<string>();
        configuredEmployees.forEach(e => {
            const raw = e.employee_id.trim().toLowerCase();
            configuredSet.add(raw);
            const digits = raw.replace(/\D/g, '');
            if (digits) configuredSet.add(digits);
        });

        const valid: ParsedEmployeeRevenue[] = [];
        const excluded: ParsedEmployeeRevenue[] = [];

        parsedList.forEach(emp => {
            const raw = emp.employee_id.trim().toLowerCase();
            const digits = raw.replace(/\D/g, '');
            if (configuredSet.has(raw) || (digits ? configuredSet.has(digits) : false)) {
                valid.push(emp);
            } else {
                excluded.push(emp);
            }
        });

        return { validList: valid, excludedList: excluded };
    }, [parsedList, configuredEmployees, filterByConfigured]);

    const handleConfirm = (dataToApply?: ParsedEmployeeRevenue[]) => {
        const targetList = dataToApply || validList;
        if (targetList.length === 0) return;
        onApply(targetList, detectedStore);
    };

    const totalRevQd = validList.reduce((sum, item) => sum + item.revenue_qd, 0);
    const totalRevActual = validList.reduce((sum, item) => sum + item.revenue_actual, 0);

    return (
        <div className="space-y-4">
            {/* Header hướng dẫn & áp dụng */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Coins className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-blue-900 text-sm">Dán Báo Cáo Doanh Thu Nhân Viên (Lũy Kế)</h3>
                        <p className="text-xs text-blue-700/80">
                            Thứ tự 8 cột sau tên NV: 1. Số lượng · 2. Doanh thu QĐ · 3. % Tỉ trọng · 4. Doanh thu · 5. TB 3 tháng · 6. % TT · 7. DT Trả góp · 8. % Trả góp.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {/* Nút 1: Áp dụng theo cấu hình hợp lệ */}
                    {validList.length > 0 && (
                        <button
                            type="button"
                            onClick={() => handleConfirm(validList)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                            <span>Áp Dụng Doanh Thu ({validList.length} NV)</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    )}

                    {/* Nút 2: Áp dụng toàn bộ nếu có nhân viên bị loại do chưa cấu hình */}
                    {filterByConfigured && excludedList.length > 0 && (
                        <button
                            type="button"
                            onClick={() => handleConfirm(parsedList)}
                            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                            title="Áp dụng toàn bộ danh sách bóc tách (bao gồm cả nhân sự chưa có trong danh sách cấu hình)"
                        >
                            <span>Áp Dụng Toàn Bộ ({parsedList.length} NV)</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Thông báo phát hiện siêu thị nếu copy cả trang */}
            {detectedStore && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
                    <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Tự động phát hiện Siêu thị: <strong className="font-bold text-emerald-900">{detectedStore}</strong></span>
                </div>
            )}

            {/* Thanh điều khiển tiêu chí lọc theo danh sách cấu hình */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={filterByConfigured}
                        onChange={e => setFilterByConfigured(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <Filter className="w-3.5 h-3.5 text-blue-600" />
                    <span>Chỉ lọc nhân viên theo danh sách cấu hình khai báo của siêu thị</span>
                </label>

                <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 font-bold flex items-center gap-1">
                        <Users className="w-3 h-3" /> Cấu hình: {configuredEmployees.length} NV
                    </span>
                    {parsedList.length > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold">
                            Khớp hợp lệ: {validList.length} NV
                        </span>
                    )}
                    {excludedList.length > 0 && filterByConfigured && (
                        <button
                            type="button"
                            onClick={() => setShowExcluded(!showExcluded)}
                            className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                            <UserX className="w-3 h-3 text-amber-600" />
                            <span>Loại bỏ: {excludedList.length} NV</span>
                            {showExcluded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                    )}
                </div>
            </div>

            {/* Ô nhập liệu textarea */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span>Dán nội dung từ báo cáo Doanh thu vào đây:</span>
                    {rawText && (
                        <button
                            type="button"
                            onClick={() => { setRawText(''); setParsedList([]); }}
                            className="text-rose-600 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Xóa trắng
                        </button>
                    )}
                </div>
                <textarea
                    rows={6}
                    value={rawText}
                    onChange={e => handleParse(e.target.value)}
                    placeholder="Ví dụ dán trực tiếp từ Dashboard TGDD:&#10;27560 - Bùi Minh Lãm&#10;235&#9;2,141&#9;22.0%&#9;1,606&#9;0&#9;—&#9;482&#9;30.0%&#10;260732 - Nguyễn Thị Hồng Loan&#10;216&#9;1,986&#9;20.4%&#9;1,570&#9;0&#9;—&#9;553&#9;35.2%"
                    className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
            </div>

            {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* Hộp xem chi tiết nhân viên bị loại do không nằm trong cấu hình siêu thị */}
            {showExcluded && excludedList.length > 0 && filterByConfigured && (
                <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs text-amber-900 font-bold">
                        <span className="flex items-center gap-1.5">
                            <UserX className="w-4 h-4 text-amber-600" />
                            Danh sách {excludedList.length} nhân sự bị loại bỏ (không có trong cấu hình ST {currentStoreName})
                        </span>
                        <span className="text-[11px] font-normal text-amber-700">
                            (Bổ sung nhân sự tại trang Cấu hình siêu thị nếu cần)
                        </span>
                    </div>
                    <div className="max-h-40 overflow-y-auto divide-y divide-amber-200/60 text-xs">
                        {excludedList.map(emp => (
                            <div key={emp.employee_id} className="py-1.5 flex items-center justify-between font-mono">
                                <div>
                                    <strong className="text-amber-900">{emp.employee_id}</strong> - {emp.full_name}
                                </div>
                                <div className="text-amber-700 text-[11px]">
                                    DT Thực: {emp.revenue_actual.toLocaleString('vi-VN')} tr · DT QĐ: {emp.revenue_qd.toLocaleString('vi-VN')} tr
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bảng xem trước kết quả bóc tách */}
            {validList.length > 0 && (
                <div data-report-table="true" className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden font-avo">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Hợp lệ theo cấu hình: {validList.length} nhân viên (có thể chỉnh sửa trực tiếp từng ô số liệu)</span>
                        </span>
                        <div className="flex items-center gap-4 text-xs font-extrabold text-slate-700">
                            <span>Tổng DT QĐ: <strong className="text-blue-700 font-mono">{totalRevQd.toLocaleString('vi-VN')} tr</strong></span>
                            <span>Tổng DT Thực: <strong className="text-emerald-700 font-mono">{totalRevActual.toLocaleString('vi-VN')} tr</strong></span>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse font-avo report-table">
                            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10">
                                <tr>
                                    <th className="p-2.5 text-center w-12 border-b">STT</th>
                                    <th className="p-2.5 w-24 border-b">Mã NV</th>
                                    <th className="p-2.5 border-b min-w-[140px]">Họ và tên</th>
                                    <th className="p-2.5 text-right border-b w-24">Số Lượng</th>
                                    <th className="p-2.5 text-right border-b w-28 text-blue-700">DT QĐ (tr)</th>
                                    <th className="p-2.5 text-right border-b w-28 text-emerald-700">DT Thực (tr)</th>
                                    <th className="p-2.5 text-right border-b w-28">DT Trả Góp</th>
                                    <th className="p-2.5 text-right border-b w-20">% Trả Góp</th>
                                    <th className="p-2.5 text-center border-b w-14">Xóa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {validList.map((emp, idx) => (
                                    <tr key={emp.employee_id} className="hover:bg-slate-50 transition">
                                        <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                                        <td className="p-2 font-mono font-bold text-blue-700">{emp.employee_id}</td>
                                        <td className="p-2 font-bold text-slate-800">{emp.full_name}</td>
                                        <td className="p-1 text-right">
                                            <input
                                                type="number"
                                                value={emp.quantity || ''}
                                                onChange={e => handleUpdateMetric(emp.employee_id, 'quantity', parseInt(e.target.value) || 0)}
                                                className="w-20 text-right font-mono bg-white border border-slate-200 focus:border-blue-500 rounded-lg px-2 py-1 text-xs outline-hidden focus:ring-1 focus:ring-blue-500 shadow-2xs"
                                            />
                                        </td>
                                        <td className="p-1 text-right">
                                            <input
                                                type="number"
                                                step={0.01}
                                                value={emp.revenue_qd || ''}
                                                onChange={e => handleUpdateMetric(emp.employee_id, 'revenue_qd', parseFloat(e.target.value) || 0)}
                                                className="w-24 text-right font-mono font-bold text-blue-700 bg-white border border-slate-200 focus:border-blue-500 rounded-lg px-2 py-1 text-xs outline-hidden focus:ring-1 focus:ring-blue-500 shadow-2xs"
                                            />
                                        </td>
                                        <td className="p-1 text-right">
                                            <input
                                                type="number"
                                                step={0.01}
                                                value={emp.revenue_actual || ''}
                                                onChange={e => handleUpdateMetric(emp.employee_id, 'revenue_actual', parseFloat(e.target.value) || 0)}
                                                className="w-24 text-right font-mono font-bold text-emerald-700 bg-white border border-slate-200 focus:border-emerald-500 rounded-lg px-2 py-1 text-xs outline-hidden focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                                            />
                                        </td>
                                        <td className="p-1 text-right">
                                            <input
                                                type="number"
                                                step={0.01}
                                                value={emp.installment_revenue || ''}
                                                onChange={e => handleUpdateMetric(emp.employee_id, 'installment_revenue', parseFloat(e.target.value) || 0)}
                                                className="w-24 text-right font-mono text-slate-700 bg-white border border-slate-200 focus:border-blue-500 rounded-lg px-2 py-1 text-xs outline-hidden focus:ring-1 focus:ring-blue-500 shadow-2xs"
                                            />
                                        </td>
                                        <td className="p-1 text-right">
                                            <input
                                                type="number"
                                                step={0.1}
                                                value={emp.installment_rate || ''}
                                                onChange={e => handleUpdateMetric(emp.employee_id, 'installment_rate', parseFloat(e.target.value) || 0)}
                                                className="w-16 text-right font-mono text-slate-700 bg-white border border-slate-200 focus:border-blue-500 rounded-lg px-2 py-1 text-xs outline-hidden focus:ring-1 focus:ring-blue-500 shadow-2xs"
                                            />
                                        </td>
                                        <td className="p-1 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveEmployee(emp.employee_id)}
                                                className="p-1 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                                title={`Xóa nhân viên ${emp.full_name}`}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
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

