import { useState, useEffect, useCallback } from 'react';
import {
    syncAndFetchEmployeeDataSessions,
    fetchEmployeeDataSessions,
    deleteEmployeeDataSession,
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
    Loader2
} from 'lucide-react';
import SessionDetailModal from './SessionDetailModal';
import { formatDateTime } from '../../../core/lib/formatters';

interface Props {
    currentStoreName: string;
    month: number;
    year: number;
    onRestoreSession?: (session: EmployeeDataSession) => void;
}

export default function SessionHistoryTab({
    currentStoreName,
    month,
    year,
    onRestoreSession
}: Props) {
    const [sessions, setSessions] = useState<EmployeeDataSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<EmployeeDataSession | null>(null);
    const [filterType, setFilterType] = useState<string>('all');
    const [message, setMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const loadSessions = useCallback(async (syncCloud = false) => {
        const filters = {
            month,
            year,
            storeName: currentStoreName === 'all' ? undefined : currentStoreName,
            sessionType: filterType === 'all' ? undefined : filterType
        };

        if (syncCloud) {
            setIsLoading(true);
            try {
                const data = await syncAndFetchEmployeeDataSessions(filters);
                setSessions(data);
            } finally {
                setIsLoading(false);
            }
        } else {
            const data = fetchEmployeeDataSessions(filters);
            setSessions(data);
        }
    }, [currentStoreName, month, year, filterType]);

    useEffect(() => {
        // Initial sync with cloud
        loadSessions(true);
    }, [loadSessions]);

    const handleDelete = async (sessionId: string, title: string) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa phiên dữ liệu: "${title}"?`)) return;
        await deleteEmployeeDataSession(sessionId);
        await loadSessions(false);
        setMessage('Đã xóa phiên dữ liệu!');
        setTimeout(() => setMessage(''), 3000);
    };

    return (
        <div className="space-y-4">
            {/* Header Lịch Sử */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <History className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-slate-900 text-sm">
                            Nhật Ký & Phiên Dữ Liệu Nhân Viên Đã Cập Nhật
                        </h3>
                        <p className="text-xs text-slate-500">
                            Kiểm tra các phiên dán số liệu Doanh thu, Thi đua, Giờ công đã lưu trong tháng {month}/{year}.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin text-purple-600" />}
                    <select
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                        className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-hidden cursor-pointer"
                    >
                        <option value="all">Tất cả loại phiên</option>
                        <option value="REVENUE_CAMPAIGN">Doanh Thu & Thi Đua</option>
                        <option value="WORK_HOURS">Giờ Công Toàn Cụm</option>
                    </select>
                </div>
            </div>

            {message && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{message}</span>
                </div>
            )}

            {/* Danh sách các phiên */}
            {sessions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">Chưa có phiên dữ liệu nào được ghi nhận cho kỳ này.</p>
                    <p className="text-[11px] text-slate-400">
                        Khi bạn nhấn "Lưu Doanh Thu & Thi Đua" hoặc "Lưu Giờ Công", phiên cập nhật sẽ tự động được lưu lại tại đây.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {sessions.map(sess => {
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
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${isRevenue
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
