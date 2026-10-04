import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ExcelJS from 'exceljs';
import {
    fetchAllBusinessRecords,
    deleteBusinessRecordById,
    deleteBusinessRecord,
    getLocalDraft,
    clearLocalDraft,
    type BusinessDayRecord
} from '../../core/lib/storage';
import { formatValue, getShortStoreName, getCampaignLabel, formatDate, formatDateTime } from '../../core/lib/formatters';
import {
    Database,
    Search,
    Trash2,
    RefreshCw,
    Download,
    AlertTriangle,
    AlertCircle,
    CloudUpload,
    ArrowRight,
    Eye,
    Calendar,
    Store,
    TrendingUp,
    CheckCircle2,
    X,
    FileSpreadsheet
} from 'lucide-react';

export default function DataManagementPage() {
    const navigate = useNavigate();
    const [records, setRecords] = useState<BusinessDayRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedStore, setSelectedStore] = useState<string>('all');
    const [selectedMonth, setSelectedMonth] = useState<string>('all');

    // Quản lý bản nháp chưa đồng bộ
    const [localDraft, setLocalDraft] = useState<any | null>(null);

    // Quản lý modal xem chi tiết & modal xác nhận xóa
    const [detailRecord, setDetailRecord] = useState<BusinessDayRecord | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<BusinessDayRecord | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    const checkDraft = () => {
        const draft = getLocalDraft();
        if (draft && (draft.rawEmulation?.trim() || draft.rawRevenue?.trim()) && !draft.isSynced) {
            setLocalDraft(draft);
        } else {
            setLocalDraft(null);
        }
    };

    // 1. TẢI TOÀN BỘ BẢN GHI TỪ SUPABASE
    const loadRecords = async () => {
        setLoading(true);
        const res = await fetchAllBusinessRecords();
        if (res.success && res.data) {
            setRecords(res.data);
        } else {
            showToast('Không thể tải danh sách bản ghi!', 'error');
        }
        setLoading(false);
    };

    useEffect(() => {
        loadRecords();
        checkDraft();
    }, []);

    const handleDiscardDraft = () => {
        if (window.confirm('Bạn có chắc chắn muốn bỏ qua và xóa bản nháp cục bộ này trên thiết bị không?')) {
            clearLocalDraft();
            setLocalDraft(null);
            showToast('Đã xóa bản nháp cục bộ!');
        }
    };

    // Danh sách siêu thị có trong dữ liệu
    const storeList = useMemo(() => {
        const set = new Set<string>();
        records.forEach(r => {
            if (r.storeName) set.add(getShortStoreName(r.storeName));
        });
        return Array.from(set).sort();
    }, [records]);

    // Danh sách các tháng có trong dữ liệu
    const monthList = useMemo(() => {
        const set = new Set<string>();
        records.forEach(r => {
            if (r.month && r.year) set.add(`T${r.month}/${r.year}`);
        });
        return Array.from(set).sort();
    }, [records]);

    // Bộ lọc dữ liệu
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const shortStore = getShortStoreName(r.storeName);
            const matchStore = selectedStore === 'all' || shortStore === selectedStore;
            const matchMonth = selectedMonth === 'all' || `T${r.month}/${r.year}` === selectedMonth;
            const q = searchQuery.trim().toLowerCase();
            const matchSearch = !q ||
                r.storeName.toLowerCase().includes(q) ||
                r.reportDate.toLowerCase().includes(q) ||
                formatDate(r.reportDate).toLowerCase().includes(q);

            return matchStore && matchMonth && matchSearch;
        });
    }, [records, selectedStore, selectedMonth, searchQuery]);

    // 2. XÓA BẢN GHI
    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);

        let res;
        if (deleteTarget.id) {
            res = await deleteBusinessRecordById(deleteTarget.id);
        } else {
            res = await deleteBusinessRecord(deleteTarget.storeName, deleteTarget.reportDate);
        }

        setIsDeleting(false);
        if (res.success) {
            setRecords(prev => prev.filter(r => {
                if (deleteTarget.id && r.id) return r.id !== deleteTarget.id;
                return !(r.storeName === deleteTarget.storeName && r.reportDate === deleteTarget.reportDate);
            }));
            showToast(`Đã xóa thành công bản ghi ngày ${formatDate(deleteTarget.reportDate)} của ${getShortStoreName(deleteTarget.storeName)}!`);
            setDeleteTarget(null);
        } else {
            showToast('Có lỗi xảy ra khi xóa bản ghi!', 'error');
        }
    };

    // 3. XUẤT TOÀN BỘ DỮ LIỆU ĐANG LỌC RA EXCEL (DÙNG EXCELJS AN TOÀN)
    const handleExportExcel = async () => {
        if (filteredRecords.length === 0) {
            showToast('Không có dữ liệu để xuất file!', 'error');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('DanhSachBaoCao');

        worksheet.columns = [
            { header: 'Siêu Thị', key: 'storeName', width: 28 },
            { header: 'Ngày Báo Cáo', key: 'reportDate', width: 14 },
            { header: 'Tháng', key: 'month', width: 10 },
            { header: 'Năm', key: 'year', width: 10 },
            { header: 'Thực Thu (VNĐ)', key: 'revenueActual', width: 20 },
            { header: 'Chỉ Tiêu (VNĐ)', key: 'revenueTarget', width: 20 },
            { header: 'Doanh Số Trả Góp', key: 'revenueInstallment', width: 20 },
            { header: 'Tỷ Lệ Trả Góp (%)', key: 'installmentRate', width: 18 },
            { header: 'Dự Kiến Hoàn Thành (%)', key: 'forecastCompletionRate', width: 24 },
            { header: 'Thời Gian Cập Nhật', key: 'updatedAt', width: 24 }
        ];

        filteredRecords.forEach(r => {
            worksheet.addRow({
                storeName: r.storeName,
                reportDate: formatDate(r.reportDate),
                month: r.month,
                year: r.year,
                revenueActual: r.revenueActual || 0,
                revenueTarget: r.revenueTarget || 0,
                revenueInstallment: r.revenueInstallment || 0,
                installmentRate: r.installmentRate || 0,
                forecastCompletionRate: r.forecastCompletionRate || 0,
                updatedAt: r.updatedAt ? formatDateTime(r.updatedAt) : ''
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Danh_Sach_Bao_Cao_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);

        showToast('Xuất file Excel thành công!');
    };

    return (
        <div className="p-4 sm:p-6 space-y-4 max-w-full mx-auto w-full">
            {/* Toast Notification */}
            {toastMessage && (
                <div className={`fixed bottom-6 right-6 z-50 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 ${toastMessage.type === 'success' ? 'bg-slate-900 border border-emerald-500' : 'bg-red-600'
                    }`}>
                    {toastMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-white" />}
                    <span>{toastMessage.text}</span>
                </div>
            )}

            {/* HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                    <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <Database className="w-5 h-5 text-indigo-600" />
                        <span>Quản Lý Dữ Liệu Báo Cáo Kinh Doanh</span>
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Xem, tra cứu chi tiết và xử lý dọn dẹp các bản ghi số liệu ngày/tháng được lưu trên hệ thống Supabase.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleExportExcel}
                        className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                        <Download className="w-4 h-4 text-emerald-600" />
                        <span>Xuất Excel ({filteredRecords.length})</span>
                    </button>

                    <button
                        onClick={loadRecords}
                        disabled={loading}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                        title="Tải lại danh sách"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* BANNER CẢNH BÁO BẢN NHÁP CỤC BỘ CHƯA ĐỒNG BỘ */}
            {localDraft && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-amber-900 shadow-xs animate-in fade-in duration-200">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-2">
                                <span>⚠️ Phát hiện có bản nháp dữ liệu kinh doanh chưa đồng bộ lên Cloud!</span>
                            </h3>
                            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                                Trên thiết bị này đang có bản nháp số liệu kinh doanh cục bộ {localDraft.updatedAt ? `(lưu lúc ${formatDateTime(localDraft.updatedAt)})` : ''}. Số liệu này chưa được đưa vào danh sách báo cáo chính thức trên Supabase Cloud.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0 flex-wrap">
                        <button
                            type="button"
                            onClick={() => navigate('/cap-nhat')}
                            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                            <CloudUpload className="w-4 h-4" />
                            <span>Mở Trang Cập Nhật &amp; Đồng Bộ</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={handleDiscardDraft}
                            className="px-3 py-2 bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Bỏ qua bản nháp</span>
                        </button>
                    </div>
                </div>
            )}

            {/* BỘ LỌC TÌM KIẾM */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="relative sm:col-span-2">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                        type="text"
                        placeholder="Tìm theo tên siêu thị hoặc ngày (dd/mm/yyyy)..."
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

                <div>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                        <option value="all">📅 Tất cả thời gian ({monthList.length})</option>
                        {monthList.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
            </div>

            {/* BẢNG DANH SÁCH DỮ LIỆU */}
            <div data-report-table="true" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs font-avo">
                <div className="overflow-x-auto no-scrollbar max-h-[70vh]">
                    <table className="w-full text-xs text-left border-collapse font-avo report-table">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-black tracking-wider sticky top-0 z-10 border-b border-slate-200">
                            <tr>
                                <th className="py-3 px-3 text-center w-10">#</th>
                                <th className="py-3 px-3">Siêu Thị</th>
                                <th className="py-3 px-3">Ngày Báo Cáo</th>
                                <th className="py-3 px-3 text-right">Thực Thu (VNĐ)</th>
                                <th className="py-3 px-3 text-right">Chỉ Tiêu (VNĐ)</th>
                                <th className="py-3 px-3 text-right">DK Hoàn Thành</th>
                                <th className="py-3 px-3 text-right">Trả Góp</th>
                                <th className="py-3 px-3 text-center">Cập Nhật</th>
                                <th className="py-3 px-3 text-center w-24">Thao Tác</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-slate-400 font-semibold">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                                        Đang nạp danh sách bản ghi...
                                    </td>
                                </tr>
                            ) : filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-slate-400 font-semibold">
                                        Không có bản ghi nào khớp với điều kiện tìm kiếm!
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map((item, idx) => (
                                    <tr key={item.id || `${item.storeName}-${item.reportDate}`} className="hover:bg-indigo-50/20 transition">
                                        <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                                        <td className="py-2.5 px-3 font-bold text-slate-800">
                                            <div className="flex items-center gap-1.5">
                                                <Store className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                                                <span className="truncate max-w-[200px]" title={item.storeName}>
                                                    {getShortStoreName(item.storeName)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-600">
                                            {formatDate(item.reportDate)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                                            {formatValue(item.revenueActual || 0)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                            {formatValue(item.revenueTarget || 0)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${(item.forecastCompletionRate || 0) >= 100
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                }`}>
                                                {(item.forecastCompletionRate || 0).toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono text-indigo-600 font-semibold">
                                            {formatValue(item.revenueInstallment || 0)}
                                        </td>
                                        <td className="py-2.5 px-3 text-center text-[10px] text-slate-400 font-mono">
                                            {item.updatedAt ? formatDate(item.updatedAt) : '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => setDetailRecord(item)}
                                                    className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition cursor-pointer"
                                                    title="Xem chi tiết bản ghi"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(item)}
                                                    className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition cursor-pointer"
                                                    title="Xóa bản ghi này"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL XEM CHI TIẾT BẢN GHI */}
            {detailRecord && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-[650px] w-full p-6 space-y-4 shadow-2xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="font-extrabold text-sm text-slate-800 uppercase flex items-center gap-2">
                                    <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                                    <span>Chi Tiết Bản Ghi Báo Cáo</span>
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                                    {detailRecord.storeName} - Ngày {formatDate(detailRecord.reportDate)}
                                </p>
                            </div>
                            <button
                                onClick={() => setDetailRecord(null)}
                                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Khối Thông số tổng quan */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-center">
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Thực Thu</p>
                                <p className="font-mono font-bold text-xs text-emerald-700 mt-0.5">{formatValue(detailRecord.revenueActual)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Chỉ Tiêu</p>
                                <p className="font-mono font-bold text-xs text-slate-700 mt-0.5">{formatValue(detailRecord.revenueTarget)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Dự Kiến HT</p>
                                <p className="font-mono font-bold text-xs text-indigo-700 mt-0.5">{(detailRecord.forecastCompletionRate || 0).toFixed(1)}%</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Tiến Độ Ngày</p>
                                <p className="font-mono font-bold text-xs text-slate-700 mt-0.5">{detailRecord.passedDays}/{detailRecord.totalDays}</p>
                            </div>
                        </div>

                        {/* Khối Chi tiết Thi Đua (Emulation Summary) */}
                        <div>
                            <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase">Chi Tiết Chương Trình Thi Đua</h4>
                            <div className="max-h-48 overflow-y-auto no-scrollbar border border-slate-200 rounded-xl divide-y divide-slate-100">
                                {detailRecord.emulationSummary && Object.keys(detailRecord.emulationSummary).length > 0 ? (
                                    Object.entries(detailRecord.emulationSummary).map(([key, val]) => (
                                        <div key={key} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                                            <span className="font-semibold text-slate-700">{getCampaignLabel(key)}</span>
                                            <div className="flex items-center gap-3 font-mono text-[11px]">
                                                <span className="text-slate-500">Mục tiêu: <b>{val.target}</b></span>
                                                <span className="text-emerald-600">Thực hiện: <b>{val.actual}</b></span>
                                                <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">{(val.pctDK || 0).toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="p-4 text-center text-slate-400 text-xs">Không có dữ liệu chi tiết thi đua kèm theo.</p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-2 border-t border-slate-100">
                            <button
                                onClick={() => setDetailRecord(null)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                                Đóng Cửa Sổ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL XÁC NHẬN XÓA BẢN GHI */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-[420px] w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-center">
                        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                            <AlertTriangle className="w-6 h-6" />
                        </div>

                        <div>
                            <h3 className="font-black text-sm text-slate-800 uppercase">Xác Nhận Xóa Dữ Liệu?</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Bạn có chắc chắn muốn xóa bản ghi ngày <b>{formatDate(deleteTarget.reportDate)}</b> của siêu thị <b>{getShortStoreName(deleteTarget.storeName)}</b>?
                            </p>
                            <p className="text-[11px] text-red-500 font-semibold mt-1">
                                * Hành động này sẽ xóa vĩnh viễn trên cơ sở dữ liệu Supabase.
                            </p>
                        </div>

                        <div className="flex items-center justify-center gap-2 pt-2">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                                HỦY BỎ
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{isDeleting ? 'ĐANG XÓA...' : 'XÁC NHẬN XÓA'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}