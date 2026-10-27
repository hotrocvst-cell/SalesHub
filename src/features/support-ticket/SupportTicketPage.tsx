import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MessageSquareText, Search, Plus, Filter, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../shared/contexts/AuthContext';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import TicketStatsOverview from './components/TicketStatsOverview';
import TicketFilterBar, { type StatusTab } from './components/TicketFilterBar';
import TicketCardItem from './components/TicketCardItem';
import TicketDetailModal from './components/TicketDetailModal';
import CreateTicketModal from './components/CreateTicketModal';
import type { SupportTicket, TicketComment, TicketStatus } from './types';
import {
    SUPPORT_TICKETS_DDL_SQL,
    checkSupportTicketTablesReady,
    fetchSupportTickets,
    fetchTicketComments,
    createSupportTicket,
    addTicketComment,
    updateTicketStatus,
    toggleStarTicket,
    submitTicketRating
} from './services/ticketService';

export default function SupportTicketPage() {
    const { currentUser, isAdmin, accessibleStores } = useAuth();

    // Data State
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [storageType, setStorageType] = useState<'cloud' | 'local'>('cloud');
    const [tableReady, setTableReady] = useState<boolean>(true);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

    // Active Ticket & Modal State
    const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
    const [activeComments, setActiveComments] = useState<TicketComment[]>([]);
    const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

    // Filter States
    const [selectedStore, setSelectedStore] = useState<string>('ALL');
    const [activeTab, setActiveTab] = useState<StatusTab>('ALL');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Load initial tickets
    const loadData = useCallback(async (isSilent = false) => {
        if (!isSilent) setIsLoading(true);
        setIsRefreshing(true);
        try {
            const tableCheck = await checkSupportTicketTablesReady();
            setTableReady(tableCheck.exists);

            const res = await fetchSupportTickets();
            setTickets(res.data);
            setStorageType(res.source);
            setLastSyncTime(new Date());
        } catch (e) {
            console.warn('Lỗi load tickets:', e);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Open detail modal and load comments
    const handleSelectTicket = async (ticket: SupportTicket) => {
        setActiveTicket(ticket);
        try {
            const comments = await fetchTicketComments(ticket.id);
            setActiveComments(comments);
        } catch (e) {
            console.warn('Lỗi nạp comments:', e);
        }
    };

    // Add comment handler
    const handleAddComment = async (content: string, isAnonymous?: boolean) => {
        if (!activeTicket) return;
        const newCmt = await addTicketComment({
            ticket_id: activeTicket.id,
            author_id: currentUser.employee_id || 'UNKNOWN',
            author_name: currentUser.full_name || 'Người dùng SalesHub',
            author_role: currentUser.role || 'NHAN_VIEN',
            author_store: currentUser.store_name || '',
            content,
            is_admin_reply: isAdmin,
            is_anonymous: Boolean(isAnonymous)
        });

        setActiveComments(prev => [...prev, newCmt]);
        setTickets(prev => prev.map(t => t.id === activeTicket.id ? { ...t, comment_count: (t.comment_count || 0) + 1 } : t));
        setActiveTicket(prev => prev ? { ...prev, comment_count: (prev.comment_count || 0) + 1 } : null);
    };

    // Update status handler
    const handleUpdateStatus = async (status: TicketStatus, note?: string) => {
        if (!activeTicket) return;
        const ok = await updateTicketStatus(activeTicket.id, status, note, currentUser.full_name);
        if (ok) {
            const updated = { ...activeTicket, status, resolution_note: note || activeTicket.resolution_note };
            setActiveTicket(updated);
            setTickets(prev => prev.map(t => t.id === activeTicket.id ? updated : t));
        }
    };

    // Toggle star handler
    const handleToggleStar = async (ticketId: string, currentStarred: boolean) => {
        const nextStarred = !currentStarred;
        await toggleStarTicket(ticketId, nextStarred);
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, is_starred: nextStarred } : t));
        if (activeTicket && activeTicket.id === ticketId) {
            setActiveTicket(prev => prev ? { ...prev, is_starred: nextStarred } : null);
        }
    };

    // Submit rating handler
    const handleSubmitRating = async (rating: number, comment?: string) => {
        if (!activeTicket) return;
        await submitTicketRating(activeTicket.id, rating, comment);
        const updated = { ...activeTicket, rating, rating_comment: comment };
        setActiveTicket(updated);
        setTickets(prev => prev.map(t => t.id === activeTicket.id ? updated : t));
    };

    // Store options derived from accessibleStores or tickets
    const storeOptions = useMemo(() => {
        const set = new Set<string>();
        if (accessibleStores && accessibleStores.length > 0) {
            accessibleStores.forEach(s => set.add(s));
        }
        tickets.forEach(t => {
            if (t.creator_store) set.add(t.creator_store);
        });
        return Array.from(set);
    }, [accessibleStores, tickets]);

    // Calculate maxIdLength for Rule 11 uniform employee badge
    const maxIdLength = useMemo(() => {
        if (!tickets || tickets.length === 0) return 6;
        return Math.max(6, ...tickets.map(t => String(t.creator_id || '').trim().length));
    }, [tickets]);

    // Counts for tabs
    const tabCounts = useMemo(() => {
        let needsAction = 0;
        let starred = 0;
        let myTickets = 0;
        const empId = currentUser.employee_id;

        tickets.forEach(t => {
            if (t.status === 'open' || t.status === 'in_progress') needsAction++;
            if (t.is_starred) starred++;
            if (empId && t.creator_id === empId) myTickets++;
        });

        return { needsAction, starred, myTickets };
    }, [tickets, currentUser.employee_id]);

    // Filter tickets
    const filteredTickets = useMemo(() => {
        return tickets.filter(t => {
            // Store filter
            if (selectedStore !== 'ALL' && t.creator_store !== selectedStore) return false;

            // Status tab
            if (activeTab === 'NEEDS_ACTION' && !(t.status === 'open' || t.status === 'in_progress')) return false;
            if (activeTab === 'STARRED' && !t.is_starred) return false;
            if (activeTab === 'MY_TICKETS' && t.creator_id !== currentUser.employee_id) return false;
            if (activeTab === 'CLOSED' && !(t.status === 'closed' || t.status === 'resolved')) return false;

            // Category filter
            if (selectedCategory !== 'ALL' && t.category !== selectedCategory) return false;

            // Priority filter
            if (selectedPriority !== 'ALL' && t.priority !== selectedPriority) return false;

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchCode = t.ticket_code.toLowerCase().includes(q);
                const matchTitle = t.title.toLowerCase().includes(q);
                const matchContent = t.content.toLowerCase().includes(q);
                const matchCreator = t.creator_name.toLowerCase().includes(q) || t.creator_id.toLowerCase().includes(q);
                if (!matchCode && !matchTitle && !matchContent && !matchCreator) return false;
            }

            return true;
        });
    }, [tickets, selectedStore, activeTab, selectedCategory, selectedPriority, searchQuery, currentUser.employee_id]);

    return (
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 space-y-4">
            {/* Header Title Banner */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 rounded-2xl p-4 sm:p-5 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
                            <MessageSquareText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
                                    HỖ TRỢ & ĐÓNG GÓP Ý KIẾN
                                </h1>
                                <span className="text-[10px] font-extrabold uppercase bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full shadow-xs">
                                    Admin ↔ User
                                </span>
                            </div>
                            <p className="text-xs text-blue-100 mt-0.5">
                                Kênh tiếp nhận thắc mắc hướng dẫn, góp ý giao diện, đề xuất tính năng mới & báo lỗi hệ thống SalesHub
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white text-blue-700 hover:bg-blue-50 active:bg-blue-100 rounded-xl text-xs font-black shadow-md transition-all shrink-0 self-start sm:self-auto"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Tạo Phiếu / Góp Ý Mới</span>
                    </button>
                </div>
            </div>

            {/* Quy chuẩn 8 & 5: Cloud Storage Sync Status Banner */}
            <CloudDataSyncStatusBanner
                storageType={storageType}
                syncStatus="synced"
                tableReady={tableReady}
                tableName="support_tickets"
                sqlDdl={SUPPORT_TICKETS_DDL_SQL}
                lastSyncTime={lastSyncTime}
                onSyncNow={() => loadData(false)}
            />

            {/* Summary KPIs & Stats (Chỉ hiển thị thẻ KPI cho Admin) */}
            <TicketStatsOverview
                tickets={tickets}
                activeCategory={selectedCategory}
                onFilterCategory={setSelectedCategory}
                isAdmin={isAdmin}
            />

            {/* Filter Bar conforming to Rule 10 & Rule 9 */}
            <TicketFilterBar
                selectedStore={selectedStore}
                onSelectStore={setSelectedStore}
                storeOptions={storeOptions}
                onOpenCreateModal={() => setShowCreateModal(true)}
                onRefresh={() => loadData(true)}
                isRefreshing={isRefreshing}
                activeTab={activeTab}
                onSelectTab={setActiveTab}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                selectedPriority={selectedPriority}
                onSelectPriority={setSelectedPriority}
                needsActionCount={tabCounts.needsAction}
                starredCount={tabCounts.starred}
                myTicketsCount={tabCounts.myTickets}
            />

            {/* Tickets List */}
            <div className="space-y-2.5">
                {isLoading ? (
                    <div className="py-12 text-center text-slate-400 text-xs font-semibold animate-pulse">
                        Đang nạp danh sách phiếu hỗ trợ...
                    </div>
                ) : filteredTickets.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-2 shadow-xs">
                        <MessageSquareText className="w-10 h-10 text-slate-300 mx-auto" />
                        <h3 className="text-sm font-bold text-slate-700">Không tìm thấy phiếu hỗ trợ nào</h3>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            Chưa có phiếu nào khớp với bộ lọc hiện tại. Bạn có thể bấm nút bên dưới để tạo chủ đề mới.
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all mt-2"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tạo Phiếu Ngay</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                        {filteredTickets.map(ticket => (
                            <TicketCardItem
                                key={ticket.id}
                                ticket={ticket}
                                onClick={() => handleSelectTicket(ticket)}
                                onToggleStar={(e) => {
                                    e.stopPropagation();
                                    handleToggleStar(ticket.id, Boolean(ticket.is_starred));
                                }}
                                canManage={isAdmin}
                                maxIdLength={maxIdLength}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Detail & Discussion Modal */}
            {activeTicket && (
                <TicketDetailModal
                    ticket={activeTicket}
                    comments={activeComments}
                    onClose={() => setActiveTicket(null)}
                    onAddComment={handleAddComment}
                    onUpdateStatus={handleUpdateStatus}
                    onToggleStar={(starred) => handleToggleStar(activeTicket.id, !starred)}
                    onSubmitRating={handleSubmitRating}
                    currentUserId={currentUser.employee_id}
                    currentUserName={currentUser.full_name}
                    isAdmin={isAdmin}
                />
            )}

            {/* Create Ticket Modal */}
            {showCreateModal && (
                <CreateTicketModal
                    onClose={() => setShowCreateModal(false)}
                    onSubmit={async (data) => {
                        const newT = await createSupportTicket(data);
                        setTickets(prev => [newT, ...prev]);
                    }}
                    currentUser={{
                        employee_id: currentUser.employee_id || 'UNKNOWN',
                        full_name: currentUser.full_name || 'Người dùng SalesHub',
                        store_name: currentUser.store_name || '',
                        role: currentUser.role || 'NHAN_VIEN'
                    }}
                />
            )}
        </div>
    );
}
