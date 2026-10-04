import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../shared/contexts/AuthContext';
import {
    fetchSystemNotifications,
    fetchApprovalRequests,
    markNotificationAsRead,
    type SystemNotification,
    type UserApprovalRequest
} from '../../../core/lib/authService';
import ApprovalModal from './ApprovalModal';
import { Bell, Check, UserCheck, Sparkles, ChevronRight, X, Clock } from 'lucide-react';

export default function NotificationBell() {
    const { currentUser } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [notifications, setNotifications] = useState<SystemNotification[]>([]);
    const [pendingRequests, setPendingRequests] = useState<UserApprovalRequest[]>([]);
    const popoverRef = useRef<HTMLDivElement>(null);

    const loadData = async () => {
        if (!currentUser.email && !currentUser.id) return;

        // Tải thông báo
        const notifs = await fetchSystemNotifications({
            role: currentUser.role,
            storeName: currentUser.store_name,
            userId: currentUser.id
        });
        setNotifications(notifs);

        // Tải yêu cầu cần xét duyệt nếu là Admin hoặc Quản lý
        if (currentUser.role === 'ADMIN' || currentUser.role === 'QUAN_LY') {
            const approverRole = currentUser.role === 'ADMIN' ? undefined : 'QUAN_LY';
            const reqs = await fetchApprovalRequests({
                approverRole,
                storeName: currentUser.role === 'QUAN_LY' ? currentUser.store_name : undefined,
                status: 'PENDING'
            });
            setPendingRequests(reqs);
        }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 15000); // 15 giây cập nhật 1 lần
        return () => clearInterval(interval);
    }, [currentUser.role, currentUser.store_name, currentUser.id]);

    // Đóng dropdown khi click ra ngoài
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const unreadCount = notifications.filter(n => !n.is_read).length;
    const totalBadge = unreadCount + pendingRequests.length;

    const handleMarkAllRead = async () => {
        for (const n of notifications) {
            if (!n.is_read) {
                await markNotificationAsRead(n.id);
            }
        }
        await loadData();
    };

    return (
        <div className="relative" ref={popoverRef}>
            {/* Nút Chuông Thông Báo */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                title="Thông báo & Xét duyệt"
                aria-label="Thông báo"
            >
                <Bell className="w-5 h-5" />
                {totalBadge > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse shadow-sm">
                        {totalBadge > 9 ? '9+' : totalBadge}
                    </span>
                )}
            </button>

            {/* Dropdown Popover */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    {/* Header */}
                    <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                                Trung Tâm Thông Báo
                            </span>
                            {totalBadge > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black">
                                    {totalBadge} mới
                                </span>
                            )}
                        </div>

                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={handleMarkAllRead}
                                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer"
                            >
                                Đã đọc tất cả
                            </button>
                        )}
                    </div>

                    {/* Banner Yêu Cầu Cần Xét Duyệt (Dành cho Admin & Quản lý) */}
                    {(currentUser.role === 'ADMIN' || currentUser.role === 'QUAN_LY') && pendingRequests.length > 0 && (
                        <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0 font-bold">
                                    <UserCheck className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-black text-amber-900 truncate">
                                        {pendingRequests.length} tài khoản chờ bạn duyệt
                                    </div>
                                    <div className="text-[10px] text-amber-700 truncate">
                                        {currentUser.role === 'ADMIN' ? 'QL, TC & Siêu thị mới' : 'Nhân sự xin gia nhập siêu thị'}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsOpen(false);
                                    setIsApprovalModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black rounded-xl transition shrink-0 cursor-pointer shadow-xs"
                            >
                                Xét Duyệt
                            </button>
                        </div>
                    )}

                    {/* Danh Sách Thông Báo */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                                Không có thông báo mới nào.
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    onClick={() => {
                                        markNotificationAsRead(n.id);
                                        if (n.type === 'APPROVAL_REQUEST') {
                                            setIsOpen(false);
                                            setIsApprovalModalOpen(true);
                                        }
                                    }}
                                    className={`p-3.5 transition cursor-pointer hover:bg-slate-50 flex items-start gap-2.5 ${
                                        !n.is_read ? 'bg-blue-50/40' : ''
                                    }`}
                                >
                                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                        !n.is_read ? 'bg-blue-600' : 'bg-transparent'
                                    }`} />

                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="text-xs font-extrabold text-slate-800 leading-snug">
                                            {n.title}
                                        </div>
                                        <div className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                                            {n.message}
                                        </div>
                                        <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-0.5">
                                            <Clock className="w-3 h-3" />
                                            <span>{new Date(n.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span>•</span>
                                            <span>{new Date(n.created_at).toLocaleDateString('vi-VN')}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {(currentUser.role === 'ADMIN' || currentUser.role === 'QUAN_LY') && (
                        <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOpen(false);
                                    setIsApprovalModalOpen(true);
                                }}
                                className="w-full py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 cursor-pointer"
                            >
                                <span>Quản lý toàn bộ danh sách xét duyệt</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Modal Xét Duyệt */}
            <ApprovalModal
                isOpen={isApprovalModalOpen}
                onClose={() => setIsApprovalModalOpen(false)}
                onUpdated={loadData}
            />
        </div>
    );
}
