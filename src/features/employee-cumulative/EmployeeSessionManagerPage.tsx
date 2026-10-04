import { useState, useEffect } from 'react';
import { fetchStores, type StoreItem } from '../../core/lib/storage';
import { formatDateTime } from '../../core/lib/formatters';
import {
    syncAndFetchEmployeeDataSessions,
    deleteEmployeeDataSession,
    getUnsyncedSessions,
    syncLocalSessionsToCloud,
    pullCloudSessionsToLocal,
    type EmployeeDataSession
} from './utils/sessionStorage';
import type { ParsedCampaignBlock } from './utils/employeeParsers';
import SessionDetailModal from './components/SessionDetailModal';
import {
    Calendar,
    Store,
    Trash2,
    Eye,
    CheckCircle2,
    AlertCircle,
    Database,
    Filter,
    RefreshCw,
    ArrowUpRight,
    CloudUpload,
    CloudDownload,
    DownloadCloud
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function EmployeeSessionManagerPage() {
    const navigate = useNavigate();
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [selectedStore, setSelectedStore] = useState<string>('all');
    // Mặc định là 0 để hiển thị toàn bộ các phiên cũ (tránh bị lọc ẩn do khác tháng hiện tại)
    const [selectedMonth, setSelectedMonth] = useState<number>(0);
    const [selectedYear, setSelectedYear] = useState<number>(0);
    const [sessionType, setSessionType] = useState<string>('all');

    const [sessions, setSessions] = useState<EmployeeDataSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<EmployeeDataSession | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [message, setMessage] = useState<string>('');

    // Trạng thái Supabase Cloud
    const [cloudStatus, setCloudStatus] = useState<{
        checked: boolean;
        exists: boolean;
        count: number;
        unsyncedCount: number;
    }>({ checked: false, exists: false, count: 0, unsyncedCount: 0 });
    const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);

    const loadData = async () => {
        setLoading(true);
        const storesRes = await fetchStores();
        if (storesRes.success) setStores(storesRes.data);

        // Tự động kéo từ Supabase Cloud và nạp dữ liệu đầy đủ
        const data = await syncAndFetchEmployeeDataSessions({
            month: selectedMonth === 0 ? undefined : selectedMonth,
            year: selectedYear === 0 ? undefined : selectedYear,
            storeName: selectedStore === 'all' ? undefined : selectedStore,
            sessionType: sessionType === 'all' ? undefined : sessionType
        });
        setSessions(data);

        // Kiểm tra đồng bộ Cloud
        try {
            const check = await getUnsyncedSessions();
            setCloudStatus({
                checked: true,
                exists: check.tableExists,
                count: check.cloudCount,
                unsyncedCount: check.unsynced.length
            });
        } catch (e) {
            console.warn('Lỗi kiểm tra cloud:', e);
        }

        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [selectedStore, selectedMonth, selectedYear, sessionType]);

    // Kéo dữ liệu từ Cloud về
    const handlePullFromCloud = async () => {
        setLoading(true);
        const res = await pullCloudSessionsToLocal();
        if (res.success) {
            setMessage(`☁️ Đã tải về thành công ${res.count} phiên dữ liệu từ Cloud!`);
            await loadData();
        } else {
            setMessage(`❌ Lỗi tải từ Cloud: ${res.error || 'Vui lòng kiểm tra kết nối mạng!'}`);
        }
        setLoading(false);
        setTimeout(() => setMessage(''), 4000);
    };

    // Đồng bộ toàn bộ phiên lên Supabase Cloud
    const handleSyncToCloud = async () => {
        setIsSyncingCloud(true);
        const res = await syncLocalSessionsToCloud();
        setIsSyncingCloud(false);

        if (res.success) {
            setMessage(`☁️ Đã đồng bộ thành công ${res.syncedCount} phiên lên Supabase Cloud!`);
            await loadData();
        } else {
            setMessage(`❌ Lỗi đồng bộ: ${res.error || 'Vui lòng liên hệ Quản trị viên để kiểm tra kết nối Cloud!'}`);
        }
        setTimeout(() => setMessage(''), 4000);
    };

    const handleDelete = async (id: string, title: string) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa phiên dữ liệu: "${title}"?`)) return;
        await deleteEmployeeDataSession(id);
        await loadData();
        setMessage('Đã xóa phiên dữ liệu thành công!');
        setTimeout(() => setMessage(''), 3000);
    };

    // Nạp lại phiên dữ liệu vào trang Cập nhật số liệu để xem và chỉnh sửa tiếp
    const handleRestoreToCumulativePage = (sess: EmployeeDataSession) => {
        try {
            const restoredRev = sess.session_type === 'REVENUE_CAMPAIGN'
                ? sess.records.map(r => ({
                    employee_id: r.employee_id,
                    full_name: r.full_name,
                    quantity: r.quantity || 0,
                    revenue_qd: r.revenue_qd || 0,
                    revenue_actual: r.revenue_actual || 0,
                    installment_revenue: r.installment_revenue || 0,
                    installment_rate: r.installment_rate || 0
                }))
                : [];

            const campaignMatrix: Record<string, Record<string, number>> = {};
            const campaignBlocksMap: Record<string, Record<string, number>> = {};
            sess.records.forEach(r => {
                if (r.campaigns) {
                    campaignMatrix[r.employee_id] = r.campaigns;
                    Object.entries(r.campaigns).forEach(([cName, val]) => {
                        if (!campaignBlocksMap[cName]) campaignBlocksMap[cName] = {};
                        campaignBlocksMap[cName][r.employee_id] = val;
                    });
                }
            });

            const reconstructedCampaignBlocks: ParsedCampaignBlock[] = Object.entries(campaignBlocksMap).map(([name, empVals]) => ({
                campaign_name: name,
                unit_type: 'DOANH THU',
                employee_values: empVals
            }));

            const restoredHours: Record<string, number> = {};
            sess.records.forEach(r => {
                if (r.work_hours !== undefined) {
                    restoredHours[r.employee_id] = r.work_hours;
                }
            });

            const activeTab = sess.session_type === 'WORK_HOURS' ? 'hours' : 'revenue';

            const restorePayload = {
                editingSession: {
                    id: sess.id,
                    session_title: sess.session_title,
                    session_type: sess.session_type,
                    store_name: sess.store_name,
                    month: sess.month,
                    year: sess.year,
                    report_date: sess.report_date
                },
                month: sess.month,
                year: sess.year,
                store: sess.store_name,
                revenueData: restoredRev,
                campaignBlocks: reconstructedCampaignBlocks,
                campaignMatrix,
                workHoursMap: restoredHours,
                activeTab
            };

            // Lưu vào key chuyển tiếp
            localStorage.setItem('saleshub_emp_cum_active_restore', JSON.stringify(restorePayload));

            // Đồng thời lưu vào draft của tháng đó
            const draftKey = `saleshub_emp_cum_draft_${sess.month}_${sess.year}`;
            localStorage.setItem(draftKey, JSON.stringify({
                selectedStore: sess.store_name,
                revenueData: restoredRev,
                campaignBlocks: reconstructedCampaignBlocks,
                campaignMatrix,
                workHoursMap: restoredHours,
                updatedAt: new Date().toISOString(),
                isSavedSession: false
            }));

            navigate('/cap-nhat-luy-ke-nhan-vien', { state: restorePayload });
        } catch (e) {
            console.warn('Lỗi nạp lại phiên:', e);
        }
    };

    const totalSessions = sessions.length;

    return (
        <div className="max-w-[1600px] mx-auto space-y-4 pb-12">
            {/* Header Phân Hệ */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
                            <Database className="w-5 h-5" />
                        </span>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Quản Lý Phiên Dữ Liệu Nhân Viên
                        </h1>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Kiểm tra, đối soát và tra cứu lịch sử các phiên cập nhật dữ liệu Doanh thu, Thi đua, Giờ công nhân viên.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => navigate('/cap-nhat-luy-ke-nhan-vien')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                        <span>Cập Nhật Số Liệu Mới</span>
                        <ArrowUpRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* BANNER CẢNH BÁO ĐỒNG BỘ SUPABASE CLOUD */}
            {cloudStatus.checked && !cloudStatus.exists && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-amber-900 shadow-xs animate-in fade-in duration-200">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-2">
                                <span>⚠️ Dữ Liệu Đang Lưu Tạm Bộ Nhớ Trình Duyệt (LocalStorage)</span>
                            </h3>
                            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                                Dịch vụ lưu trữ đám mây cho phiên nhân sự chưa được thiết lập trên Supabase Cloud. Hiện có <b>{sessions.length}</b> phiên dữ liệu đang được lưu an toàn tại máy này.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0">
                        <button
                            type="button"
                            onClick={loadData}
                            disabled={loading}
                            className="w-full md:w-auto px-4 py-2 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            <span>Kiểm tra lại kết nối</span>
                        </button>
                    </div>
                </div>
            )}

            {cloudStatus.checked && cloudStatus.exists && cloudStatus.unsyncedCount > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-blue-900 shadow-xs animate-in fade-in duration-200">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-blue-100 text-blue-700 shrink-0">
                            <CloudUpload className="w-5 h-5 text-blue-600 animate-bounce" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-xs uppercase tracking-wider text-blue-900 flex items-center gap-2">
                                <span>⚠️ Phát hiện {cloudStatus.unsyncedCount} phiên dữ liệu nhân sự chưa đồng bộ lên Cloud!</span>
                            </h3>
                            <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                                Các phiên này đang được lưu cục bộ trên máy. Hãy bấm nút đồng bộ để đưa toàn bộ lên Supabase Cloud cho toàn bộ nhân sự cùng truy cập.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0">
                        <button
                            type="button"
                            onClick={handleSyncToCloud}
                            disabled={isSyncingCloud}
                            className="w-full md:w-auto px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition shadow-md cursor-pointer disabled:opacity-50"
                        >
                            <CloudUpload className={`w-4 h-4 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                            <span>{isSyncingCloud ? 'ĐANG ĐỒNG BỘ...' : `⚡ ĐỒNG BỘ ${cloudStatus.unsyncedCount} PHIÊN LÊN CLOUD`}</span>
                        </button>
                    </div>
                </div>
            )}

            {cloudStatus.checked && cloudStatus.exists && cloudStatus.unsyncedCount === 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-emerald-800">
                    <div className="flex items-center gap-2 font-medium">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span><b>Supabase Cloud:</b> Toàn bộ {cloudStatus.count} phiên dữ liệu nhân sự đã được đồng bộ trực tuyến.</span>
                    </div>
                </div>
            )}

            {/* Thanh Bộ Lọc */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <Store className="w-4 h-4 text-purple-600" />
                        <select
                            value={selectedStore}
                            onChange={e => setSelectedStore(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                        >
                            <option value="all">🏢 Tất Cả Siêu Thị</option>
                            {stores.map(s => (
                                <option key={s.id || s.code} value={s.name}>{s.name} ({s.code})</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <Calendar className="w-4 h-4 text-purple-600" />
                        <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(Number(e.target.value))}
                            className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                        >
                            <option value={0}>📅 Tất Cả Các Tháng</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                        <span className="text-slate-300">/</span>
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(Number(e.target.value))}
                            className="bg-transparent text-xs font-bold text-slate-700 outline-hidden cursor-pointer"
                        >
                            <option value={0}>Tất Cả Năm</option>
                            <option value={2026}>2026</option>
                            <option value={2025}>2025</option>
                            <option value={2024}>2024</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <Filter className="w-4 h-4 text-purple-600" />
                        <select
                            value={sessionType}
                            onChange={e => setSessionType(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                        >
                            <option value="all">Tất cả loại phiên</option>
                            <option value="REVENUE_CAMPAIGN">Doanh Thu & Thi Đua</option>
                            <option value="WORK_HOURS">Giờ Công Toàn Cụm</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono hidden sm:inline">
                        Tổng số phiên: <strong className="text-slate-900">{totalSessions}</strong>
                    </span>

                    <button
                        type="button"
                        onClick={handlePullFromCloud}
                        className="px-3 py-1.5 border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Tải lại toàn bộ các phiên từ Supabase Cloud về máy"
                    >
                        <CloudDownload className="w-3.5 h-3.5 text-purple-600" />
                        <span>Kéo từ Cloud</span>
                    </button>

                    <button
                        type="button"
                        onClick={loadData}
                        className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                        title="Làm mới danh sách"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600' : ''}`} />
                    </button>
                </div>
            </div>

            {message && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{message}</span>
                </div>
            )}

            {/* Bảng danh sách phiên */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                                <th className="p-3 text-center w-12">STT</th>
                                <th className="p-3 w-40">Thời Gian Cập Nhật</th>
                                <th className="p-3 w-40">Loại Phiên</th>
                                <th className="p-3">Tên Phiên & Siêu Thị</th>
                                <th className="p-3 text-right">Số Nhân Sự</th>
                                <th className="p-3 text-right">Tổng Số Liệu</th>
                                <th className="p-3 text-center w-36">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                            {sessions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400">
                                        Không tìm thấy phiên dữ liệu nào phù hợp với bộ lọc. Hãy bấm "Kéo từ Cloud" hoặc "Cập Nhật Số Liệu Mới".
                                    </td>
                                </tr>
                            ) : (
                                sessions.map((sess, idx) => {
                                    const isRev = sess.session_type === 'REVENUE_CAMPAIGN';
                                    const dateStr = formatDateTime(sess.created_at);

                                    return (
                                        <tr key={sess.id} className="hover:bg-slate-50">
                                            <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                            <td className="p-3 font-mono text-slate-600">{dateStr}</td>
                                            <td className="p-3">
                                                <span
                                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${
                                                        isRev
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : 'bg-emerald-100 text-emerald-800'
                                                    }`}
                                                >
                                                    {isRev ? 'Doanh Thu & Thi Đua' : 'Giờ Công Toàn Cụm'}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-bold text-slate-900">{sess.session_title}</div>
                                                <div className="text-[11px] text-slate-400">{sess.store_name}</div>
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-blue-700">
                                                {sess.employee_count} NV
                                            </td>
                                            <td className="p-3 text-right font-mono font-extrabold">
                                                {isRev ? (
                                                    <span className="text-emerald-700">
                                                        {sess.total_revenue_actual.toLocaleString('vi-VN')} tr
                                                    </span>
                                                ) : (
                                                    <span className="text-blue-700">
                                                        {sess.total_work_hours.toLocaleString('vi-VN')} giờ
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedSession(sess)}
                                                        className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                                        title="Xem chi tiết phiên"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRestoreToCumulativePage(sess)}
                                                        className="p-1.5 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition cursor-pointer"
                                                        title="Nạp phiên này vào trang Cập Nhật Số Liệu để xem/chỉnh sửa tiếp"
                                                    >
                                                        <DownloadCloud className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(sess.id, sess.session_title)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                                        title="Xóa phiên"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
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

            {/* Modal xem chi tiết */}
            {selectedSession && (
                <SessionDetailModal
                    session={selectedSession}
                    onClose={() => setSelectedSession(null)}
                    onRestore={handleRestoreToCumulativePage}
                />
            )}
        </div>
    );
}
