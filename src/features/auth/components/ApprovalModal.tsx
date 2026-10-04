import { useState, useEffect } from 'react';
import { useAuth } from '../../../shared/contexts/AuthContext';
import {
    fetchApprovalRequests,
    processApprovalRequest,
    type UserApprovalRequest,
    ROLE_LABELS
} from '../../../core/lib/authService';
import {
    UserCheck,
    Check,
    X,
    Building2,
    Database,
    Shield,
    Crown,
    Users,
    AlertCircle,
    Store,
    Calendar,
    Phone,
    Mail,
    BadgeHelp
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onUpdated?: () => void;
}

export default function ApprovalModal({ isOpen, onClose, onUpdated }: Props) {
    const { currentUser } = useAuth();
    const [requests, setRequests] = useState<UserApprovalRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
    const [filterRole, setFilterRole] = useState<string>('ALL');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [reviewNote, setReviewNote] = useState<{ [id: string]: string }>({});
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const loadRequests = async () => {
        setIsLoading(true);
        // Admin xem toàn bộ yêu cầu trong hệ thống (cả QL, TC, NV, Mở siêu thị mới)
        // Quản lý chỉ xem các yêu cầu thuộc Siêu thị của mình
        const data = await fetchApprovalRequests({
            approverRole: currentUser.role === 'ADMIN' ? undefined : 'QUAN_LY',
            storeName: currentUser.role === 'QUAN_LY' ? currentUser.store_name : undefined
        });
        setRequests(data);
        setIsLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            loadRequests();
            setMsg(null);
        }
    }, [isOpen, currentUser.role, currentUser.store_name]);

    if (!isOpen) return null;

    const allPending = requests.filter(r => r.status === 'PENDING');
    const pendingList = allPending.filter(r => {
        if (filterRole === 'ALL') return true;
        if (filterRole === 'NEW_STORE') return r.is_new_store;
        return r.requested_role === filterRole;
    });
    const historyList = requests.filter(r => r.status !== 'PENDING');

    const handleAction = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
        setProcessingId(requestId);
        setMsg(null);
        const note = reviewNote[requestId] || (decision === 'APPROVED' ? 'Đã phê duyệt đạt yêu cầu' : 'Từ chối');

        const res = await processApprovalRequest({
            requestId,
            decision,
            reviewerName: `${currentUser.full_name} (${currentUser.role_title})`,
            reviewNote: note
        });

        setProcessingId(null);

        if (res.success) {
            setMsg({
                type: 'success',
                text: decision === 'APPROVED' ? 'Đã phê duyệt yêu cầu thành công!' : 'Đã từ chối yêu cầu.'
            });
            await loadRequests();
            onUpdated?.();
        } else {
            setMsg({
                type: 'error',
                text: res.error || 'Có lỗi khi xử lý xét duyệt'
            });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-5 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
                            <UserCheck className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <h3 className="font-black text-base leading-tight">
                                Xét Duyệt Tài Khoản &amp; Phân Quyền
                            </h3>
                            <p className="text-xs text-blue-200">
                                {currentUser.role === 'ADMIN'
                                    ? 'Cấp quyền Quản lý Siêu thị, Trưởng ca & Mở Siêu thị mới'
                                    : `Duyệt Nhân viên gia nhập Siêu thị: ${currentUser.store_name}`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-5 pt-3 pb-0 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/50">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('PENDING')}
                            className={`pb-2.5 px-3 text-xs font-black transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
                                activeTab === 'PENDING'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <span>Chờ xét duyệt</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                pendingList.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                            }`}>
                                {pendingList.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('HISTORY')}
                            className={`pb-2.5 px-3 text-xs font-black transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
                                activeTab === 'HISTORY'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <span>Lịch sử đã duyệt</span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold">
                                {historyList.length}
                            </span>
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={loadRequests}
                        className="text-[11px] font-bold text-slate-500 hover:text-blue-600 transition cursor-pointer pb-2"
                    >
                        🔄 Làm mới
                    </button>
                </div>

                {/* Sub-filter pills for Pending tab */}
                {activeTab === 'PENDING' && allPending.length > 0 && (
                    <div className="px-5 py-2 bg-slate-100/60 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto text-[11px]">
                        <button
                            type="button"
                            onClick={() => setFilterRole('ALL')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                                filterRole === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Tất cả ({allPending.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterRole('QUAN_LY')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                                filterRole === 'QUAN_LY' ? 'bg-amber-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            👑 Quản lý ({allPending.filter(r => r.requested_role === 'QUAN_LY').length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterRole('TRUONG_CA')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                                filterRole === 'TRUONG_CA' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            ⭐ Trưởng ca ({allPending.filter(r => r.requested_role === 'TRUONG_CA').length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterRole('NHAN_VIEN')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                                filterRole === 'NHAN_VIEN' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            👤 Nhân viên ({allPending.filter(r => r.requested_role === 'NHAN_VIEN').length})
                        </button>
                        {allPending.some(r => r.is_new_store) && (
                            <button
                                type="button"
                                onClick={() => setFilterRole('NEW_STORE')}
                                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                                    filterRole === 'NEW_STORE' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                🏢 Mở ST mới ({allPending.filter(r => r.is_new_store).length})
                            </button>
                        )}
                    </div>
                )}

                {/* Notification Banner */}
                {msg && (
                    <div className={`p-3 mx-5 mt-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                        msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                        {msg.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                        <span>{msg.text}</span>
                    </div>
                )}

                {/* Body Content */}
                <div className="p-5 overflow-y-auto space-y-4 flex-1">
                    {isLoading ? (
                        <div className="py-12 text-center text-xs font-bold text-slate-400">
                            Đang tải danh sách yêu cầu xét duyệt...
                        </div>
                    ) : activeTab === 'PENDING' ? (
                        pendingList.length === 0 ? (
                            <div className="py-12 text-center space-y-2">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                                    <Check className="w-6 h-6" />
                                </div>
                                <div className="font-extrabold text-slate-700 text-sm">Tất cả yêu cầu đã được xử lý</div>
                                <p className="text-xs text-slate-400">Hiện không có yêu cầu nào đang chờ xét duyệt.</p>
                            </div>
                        ) : (
                            pendingList.map((req) => (
                                <div
                                    key={req.id}
                                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 transition space-y-3 shadow-2xs"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-extrabold text-sm text-slate-900">{req.full_name}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                    req.requested_role === 'QUAN_LY'
                                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                                        : req.requested_role === 'TRUONG_CA'
                                                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                }`}>
                                                    {ROLE_LABELS[req.requested_role]}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                                                <span className="flex items-center gap-1">
                                                    <Mail className="w-3 h-3 text-slate-400" />
                                                    {req.email}
                                                </span>
                                                {req.employee_id && (
                                                    <span className="flex items-center gap-1">
                                                        <BadgeHelp className="w-3 h-3 text-slate-400" />
                                                        Mã NV: <b>{req.employee_id}</b>
                                                    </span>
                                                )}
                                                {req.phone && (
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="w-3 h-3 text-slate-400" />
                                                        {req.phone}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="text-[11px] text-slate-400 shrink-0">
                                            {new Date(req.created_at).toLocaleString('vi-VN')}
                                        </div>
                                    </div>

                                    {/* THÔNG TIN SIÊU THỊ & GỢI Ý MỚI */}
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500 font-medium flex items-center gap-1.5">
                                                <Store className="w-3.5 h-3.5 text-blue-600" />
                                                <span>Siêu thị đăng ký:</span>
                                            </span>
                                            <span className="font-extrabold text-slate-900">{req.store_name}</span>
                                        </div>

                                        {req.is_new_store && (
                                            <div className="mt-1 pt-1.5 border-t border-slate-200/80 text-[11px] text-amber-800 bg-amber-50/60 p-2 rounded-lg border border-amber-200">
                                                <div className="font-bold flex items-center gap-1">
                                                    <Building2 className="w-3.5 h-3.5 text-amber-600" />
                                                    <span>Đề xuất thêm mới siêu thị này vào hệ thống:</span>
                                                </div>
                                                <div className="mt-0.5">
                                                    Mã ST: <b>{req.new_store_code || 'Chưa có'}</b> | Địa chỉ: {req.new_store_address || 'Chưa có'}
                                                </div>
                                            </div>
                                        )}

                                        {/* GHI CHÚ KẾ THỪA NẾU LÀ QUẢN LÝ (Requirement 4) */}
                                        {req.requested_role === 'QUAN_LY' && !req.is_new_store && (
                                            <div className="mt-1 pt-1.5 border-t border-slate-200/80 text-[11px] text-blue-800 bg-blue-50/60 p-2 rounded-lg border border-blue-200 flex items-start gap-1.5">
                                                <Database className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                                <span>
                                                    <b>Kế thừa dữ liệu:</b> Khi phê duyệt, tài khoản này sẽ tiếp quản quyền Quản lý của siêu thị <b>{req.store_name}</b> và kế thừa trọn vẹn toàn bộ dữ liệu lịch sử hiện có.
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* GHI CHÚ & NÚT HÀNH ĐỘNG */}
                                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                                        <input
                                            type="text"
                                            placeholder="Ghi chú phản hồi (nếu có)..."
                                            value={reviewNote[req.id] || ''}
                                            onChange={(e) => setReviewNote({ ...reviewNote, [req.id]: e.target.value })}
                                            className="w-full sm:flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />

                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <button
                                                type="button"
                                                disabled={processingId === req.id}
                                                onClick={() => handleAction(req.id, 'REJECTED')}
                                                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                                <span>Từ chối</span>
                                            </button>

                                            <button
                                                type="button"
                                                disabled={processingId === req.id}
                                                onClick={() => handleAction(req.id, 'APPROVED')}
                                                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                                <span>Phê duyệt</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )
                    ) : (
                        historyList.length === 0 ? (
                            <div className="py-12 text-center text-xs text-slate-400">
                                Chưa có lịch sử xét duyệt nào.
                            </div>
                        ) : (
                            historyList.map((req) => (
                                <div key={req.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-extrabold text-slate-800">{req.full_name}</span>
                                            <span className="text-slate-400 font-normal">({req.email})</span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                            req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                        }`}>
                                            {req.status === 'APPROVED' ? '✓ Đã Duyệt' : '✕ Đã Từ Chối'}
                                        </span>
                                    </div>

                                    <div className="text-slate-600">
                                        Vai trò: <b>{ROLE_LABELS[req.requested_role]}</b> | Siêu thị: <b>{req.store_name}</b>
                                    </div>

                                    {req.reviewed_by && (
                                        <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/60">
                                            <span>Xử lý bởi: <b>{req.reviewed_by}</b></span>
                                            <span>{req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString('vi-VN') : ''}</span>
                                        </div>
                                    )}
                                </div>
                            ))
                        )
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                    <span className="text-[11px] text-slate-500">
                        {currentUser.role === 'ADMIN' ? '🛡️ Thẩm quyền Admin toàn hệ thống' : `👑 Thẩm quyền Quản lý: ${currentUser.store_name}`}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}
