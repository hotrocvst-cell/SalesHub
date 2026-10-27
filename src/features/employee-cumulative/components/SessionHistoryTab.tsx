import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    fetchCloudEmployeeDataSessions,
    deleteEmployeeDataSession,
    pullCloudSessionsToLocal,
    type EmployeeDataSession
} from '../utils/sessionStorage';
import {
    History,
    Trash2,
    Eye,
    Clock,
    CheckCircle2,
    DownloadCloud,
    AlertCircle,
    Loader2,
    Cloud,
    RefreshCw,
    Search,
    LayoutList,
    LayoutGrid,
    Calendar,
    Store
} from 'lucide-react';
import SessionDetailModal from './SessionDetailModal';
import type { StoreItem } from '../../../core/lib/storage';
import { isStoreMatch, formatDateTime, formatDate } from '../../../core/lib/formatters';

interface Props {
    currentStoreName: string;
    month: number;
    year: number;
    onRestoreSession?: (session: EmployeeDataSession) => void;
    allowedStores?: StoreItem[];
    isAdmin?: boolean;
}

export default function SessionHistoryTab({
    currentStoreName,
    month,
    year,
    onRestoreSession,
    allowedStores = [],
    isAdmin = false
}: Props) {
    const [sessions, setSessions] = useState<EmployeeDataSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<EmployeeDataSession | null>(null);
    const [filterType, setFilterType] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
    const [message, setMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const loadSessions = useCallback(async () => {
        const filters = {
            month,
            year,
            storeName: currentStoreName === 'all' ? undefined : currentStoreName,
            sessionType: filterType === 'all' ? undefined : filterType
        };

        setIsLoading(true);
        try {
            // CHỈ LOAD DỮ LIỆU ĐƯỢC LƯU ĐỒNG THỜI TRÊN SUPABASE CLOUD (KHÔNG LOAD LOCALSTORAGE)
            const cloudRes = await fetchCloudEmployeeDataSessions(filters);
            if (cloudRes.success) {
                let data = cloudRes.data;
                // Nếu người dùng không phải Admin và đang chọn "all", lọc các phiên chỉ thuộc các siêu thị được phân quyền
                if (!isAdmin && allowedStores.length > 0 && currentStoreName === 'all') {
                    data = data.filter(sess =>
                        allowedStores.some(s => isStoreMatch(s.name, sess.store_name))
                    );
                }
                setSessions(data);
                // Dọn sạch cache local theo đúng các phiên đang tồn tại trên Cloud
                await pullCloudSessionsToLocal();
            } else {
                setMessage(`⚠️ Không thể kết nối CLOUD: ${cloudRes.error}`);
                setSessions([]);
            }
        } catch (e: any) {
            setMessage(`❌ Lỗi tải dữ liệu Supabase: ${e.message || String(e)}`);
            setSessions([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentStoreName, month, year, filterType, isAdmin, allowedStores]);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const handleDelete = async (sessionId: string, title: string) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa phiên dữ liệu: "${title}"?`)) return;
        setIsLoading(true);
        try {
            await deleteEmployeeDataSession(sessionId);
            await loadSessions();
            setMessage('Đã xóa phiên dữ liệu trên CLOUD!');
            setTimeout(() => setMessage(''), 3000);
        } catch (e: any) {
            setMessage(`❌ Lỗi khi xóa: ${e.message || String(e)}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Lọc theo từ khóa tìm kiếm (tên siêu thị, tiêu đề phiên, ngày chốt)
    const filteredSessions = useMemo(() => {
        if (!searchTerm.trim()) return sessions;
        const q = searchTerm.toLowerCase().trim();
        return sessions.filter(s =>
            s.session_title.toLowerCase().includes(q) ||
            s.store_name.toLowerCase().includes(q) ||
            (s.report_date && s.report_date.includes(q))
        );
    }, [sessions, searchTerm]);

    const revenueCount = useMemo(() => sessions.filter(s => s.session_type === 'REVENUE_CAMPAIGN').length, [sessions]);
    const hoursCount = useMemo(() => sessions.filter(s => s.session_type === 'WORK_HOURS').length, [sessions]);

    return (
        <div className="space-y-4">
            {/* Header Lịch Sử */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <History className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-slate-900 text-sm">
                                Nhật Ký &amp; Phiên Dữ Liệu Nhân Viên Đã Cập Nhật
                            </h3>
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Cloud className="w-3 h-3 text-emerald-600" />
                                Cloud Only
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                {sessions.length} phiên ({revenueCount} DT/Thi đua, {hoursCount} Giờ công)
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Theo dõi danh sách các phiên cập nhật dữ liệu lũy kế đã đồng bộ trực tiếp trên Cloud.
                        </p>
                    </div>
                </div>

                {/* Thanh công cụ điều khiển: Tìm kiếm, Lọc, Chế độ xem, Nút làm mới */}
                <div className="flex items-center gap-2 flex-wrap self-stretch lg:self-auto">
                    {/* Ô tìm kiếm nhanh */}
                    <div className="relative flex-1 sm:flex-initial">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Tìm siêu thị, tên phiên..."
                            className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-purple-500 outline-hidden transition w-full sm:w-48"
                        />
                    </div>

                    {/* Lọc loại phiên */}
                    <select
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                        className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-hidden cursor-pointer"
                    >
                        <option value="all">Tất cả loại ({sessions.length})</option>
                        <option value="REVENUE_CAMPAIGN">Doanh Thu &amp; Thi Đua ({revenueCount})</option>
                        <option value="WORK_HOURS">Giờ Công Toàn Cụm ({hoursCount})</option>
                    </select>

                    {/* Toggle chế độ xem Bảng / Thẻ */}
                    <div className="flex items-center border border-slate-200 rounded-xl p-0.5 bg-slate-50">
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`p-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs font-bold ${
                                viewMode === 'table'
                                    ? 'bg-white text-purple-700 shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Hiển thị dạng bảng (khuyên dùng)"
                        >
                            <LayoutList className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Bảng</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('cards')}
                            className={`p-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs font-bold ${
                                viewMode === 'cards'
                                    ? 'bg-white text-purple-700 shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Hiển thị dạng thẻ (Cards)"
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Thẻ</span>
                        </button>
                    </div>

                    {/* Nút Làm mới */}
                    <button
                        type="button"
                        onClick={loadSessions}
                        disabled={isLoading}
                        className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                        title="Tải lại danh sách từ Cloud"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-purple-600' : ''}`} />
                    </button>
                </div>
            </div>

            {message && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in duration-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{message}</span>
                </div>
            )}

            {/* DANH SÁCH CÁC PHIÊN DỮ LIỆU */}
            {filteredSessions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">
                        {searchTerm ? 'Không tìm thấy phiên dữ liệu nào khớp với từ khóa tìm kiếm.' : 'Chưa có phiên dữ liệu nào được ghi nhận cho kỳ này.'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                        Khi bạn nhấn "Lưu Doanh Thu &amp; Thi Đua" hoặc "Lưu Giờ Công", phiên cập nhật sẽ tự động được lưu lại tại đây.
                    </p>
                </div>
            ) : viewMode === 'table' ? (
                /* HIỂN THỊ DẠNG BẢNG (TABLE VIEW) */
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200">
                                <tr>
                                    <th className="px-2.5 py-3 text-center w-12 text-slate-500">STT</th>
                                    <th className="px-3 py-3 w-44 text-slate-700">Thời Gian &amp; Ngày Chốt</th>
                                    <th className="px-3 py-3 w-40 text-slate-700">Loại Phiên</th>
                                    <th className="px-3 py-3 text-slate-700">Siêu Thị &amp; Tiêu Đề Phiên</th>
                                    <th className="px-3 py-3 text-right w-24 text-slate-700">Nhân Sự</th>
                                    <th className="px-3 py-3 text-right w-36 text-slate-700">Tổng Số Liệu</th>
                                    <th className="px-3 py-3 text-center w-36 text-slate-700">Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {filteredSessions.map((sess, idx) => {
                                    const isRevenue = sess.session_type === 'REVENUE_CAMPAIGN';
                                    const timeStr = formatDateTime(sess.created_at);

                                    return (
                                        <tr key={sess.id} className="hover:bg-blue-50/40 transition">
                                            {/* 1. STT */}
                                            <td className="px-2.5 py-2.5 text-center text-slate-400 font-mono text-[11px]">
                                                {idx + 1}
                                            </td>

                                            {/* 2. Thời Gian & Ngày Chốt */}
                                            <td className="px-3 py-2.5 font-mono">
                                                <div className="text-slate-700 text-xs flex items-center gap-1">
                                                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                                    <span>{timeStr}</span>
                                                </div>
                                                {sess.report_date && (
                                                    <div className="mt-1">
                                                        <span
                                                            className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md border border-purple-200"
                                                            title="Ngày chốt dữ liệu (Report Date)"
                                                        >
                                                            <Calendar className="w-2.5 h-2.5 text-purple-500 shrink-0" />
                                                            <span>Chốt: {formatDate(sess.report_date)}</span>
                                                        </span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* 3. Loại Phiên */}
                                            <td className="px-3 py-2.5">
                                                <span
                                                    className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${
                                                        isRevenue
                                                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                    }`}
                                                >
                                                    {isRevenue ? 'Doanh Thu & Thi Đua' : 'Giờ Công Toàn Cụm'}
                                                </span>
                                            </td>

                                            {/* 4. Siêu Thị & Tiêu Đề Phiên */}
                                            <td className="px-3 py-2.5">
                                                <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                                                    <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <span>{sess.store_name}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5" title={sess.session_title}>
                                                    {sess.session_title}
                                                </div>
                                            </td>

                                            {/* 5. Nhân Sự */}
                                            <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-700">
                                                {sess.employee_count} NV
                                            </td>

                                            {/* 6. Tổng Số Liệu */}
                                            <td className="px-3 py-2.5 text-right font-mono font-extrabold">
                                                {isRevenue ? (
                                                    <div>
                                                        <span className="text-emerald-700 text-xs">
                                                            {sess.total_revenue_actual.toLocaleString('vi-VN')} tr
                                                        </span>
                                                        {sess.total_revenue_qd > 0 && (
                                                            <div className="text-[10px] text-slate-400 font-normal">
                                                                QĐ: {sess.total_revenue_qd.toLocaleString('vi-VN')} tr
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-blue-700 text-xs">
                                                        {sess.total_work_hours.toLocaleString('vi-VN')} giờ
                                                    </span>
                                                )}
                                            </td>

                                            {/* 7. Thao Tác */}
                                            <td className="px-3 py-2.5 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedSession(sess)}
                                                        className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                                        title="Xem chi tiết phiên"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {onRestoreSession && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onRestoreSession(sess)}
                                                            className="p-1.5 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition cursor-pointer"
                                                            title="Nạp lại số liệu phiên này vào bảng làm việc"
                                                        >
                                                            <DownloadCloud className="w-4 h-4" />
                                                        </button>
                                                    )}
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
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* HIỂN THỊ DẠNG THẺ (CARD VIEW) */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {filteredSessions.map(sess => {
                        const isRevenue = sess.session_type === 'REVENUE_CAMPAIGN';
                        const timeStr = formatDateTime(sess.created_at);

                        return (
                            <div
                                key={sess.id}
                                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-sm transition flex flex-col justify-between space-y-3"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <span
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${
                                                isRevenue
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-emerald-100 text-emerald-800'
                                            }`}
                                        >
                                            {isRevenue ? 'Doanh Thu & Thi Đua' : 'Giờ Công Toàn Cụm'}
                                        </span>
                                        <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> {timeStr}
                                        </span>
                                    </div>

                                    <h4 className="font-extrabold text-xs text-slate-900 line-clamp-2">
                                        {sess.session_title}
                                    </h4>

                                    <div className="text-[11px] text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Siêu thị:</span>
                                            <strong className="text-slate-800">{sess.store_name}</strong>
                                        </div>
                                        {sess.report_date && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Ngày chốt số liệu:</span>
                                                <strong className="text-purple-700 font-mono">{formatDate(sess.report_date)}</strong>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Nhân sự cập nhật:</span>
                                            <strong className="text-slate-800 font-mono">{sess.employee_count} NV</strong>
                                        </div>
                                        {isRevenue ? (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Tổng DT Thực tế:</span>
                                                <strong className="text-emerald-700 font-mono">
                                                    {sess.total_revenue_actual.toLocaleString('vi-VN')} tr
                                                </strong>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Tổng Giờ công:</span>
                                                <strong className="text-blue-700 font-mono">
                                                    {sess.total_work_hours.toLocaleString('vi-VN')} giờ
                                                </strong>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedSession(sess)}
                                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                                    >
                                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                                        <span>Xem Chi Tiết</span>
                                    </button>

                                    {onRestoreSession && (
                                        <button
                                            type="button"
                                            onClick={() => onRestoreSession(sess)}
                                            className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                                            title="Nạp lại số liệu phiên này vào bảng làm việc"
                                        >
                                            <DownloadCloud className="w-3.5 h-3.5" />
                                            <span>Nạp lại</span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => handleDelete(sess.id, sess.session_title)}
                                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                        title="Xóa phiên"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal xem chi tiết dữ liệu phiên */}
            {selectedSession && (
                <SessionDetailModal
                    session={selectedSession}
                    onClose={() => setSelectedSession(null)}
                    onRestore={onRestoreSession}
                />
            )}
        </div>
    );
}
