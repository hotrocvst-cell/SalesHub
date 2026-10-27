import React, { useState } from 'react';
import { X, Send, AlertCircle, Sparkles } from 'lucide-react';
import type { TicketCategory, TicketPriority, SupportTicket } from '../types';
import { CATEGORY_METADATA, PRIORITY_METADATA } from '../types';

interface Props {
    onClose: () => void;
    onSubmit: (ticketData: Omit<SupportTicket, 'id' | 'ticket_code' | 'created_at' | 'updated_at' | 'comment_count'>) => Promise<void>;
    currentUser: {
        employee_id: string;
        full_name: string;
        store_name: string;
        role: string;
    };
}

export default function CreateTicketModal({ onClose, onSubmit, currentUser }: Props) {
    const [category, setCategory] = useState<TicketCategory>('gop_y_giao_dien');
    const [priority, setPriority] = useState<TicketPriority>('trung_binh');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!title.trim()) {
            setErrorMsg('Vui lòng nhập tiêu đề chủ đề / phiếu hỗ trợ.');
            return;
        }
        if (!content.trim()) {
            setErrorMsg('Vui lòng nhập nội dung mô tả chi tiết.');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit({
                title: title.trim(),
                category,
                priority,
                status: 'open',
                content: content.trim(),
                creator_id: currentUser.employee_id || 'UNKNOWN',
                creator_name: currentUser.full_name || 'Người dùng SalesHub',
                creator_role: currentUser.role || 'NHAN_VIEN',
                creator_store: currentUser.store_name || '',
                is_starred: priority === 'khan_cap',
                is_anonymous: isAnonymous
            });
            onClose();
        } catch (err: any) {
            setErrorMsg(err?.message || 'Có lỗi xảy ra khi tạo phiếu.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/80">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-bold text-slate-900">Tạo Phiếu / Đóng Góp Ý Kiến</h2>
                            <p className="text-[11px] text-slate-500">Tương tác trực tiếp giữa người dùng và Quản trị viên</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4">
                    {errorMsg && (
                        <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Category Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            1. Chọn Phân Loại Chủ Đề: <span className="text-rose-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {(Object.keys(CATEGORY_METADATA) as TicketCategory[]).map(cat => {
                                const meta = CATEGORY_METADATA[cat];
                                const isSelected = category === cat;
                                return (
                                    <button
                                        type="button"
                                        key={cat}
                                        onClick={() => setCategory(cat)}
                                        className={`flex items-center gap-1.5 p-2 rounded-xl text-xs font-bold border transition-all text-left ${
                                            isSelected
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        <span>{meta.icon}</span>
                                        <span className="truncate">{meta.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Priority Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            2. Mức Độ Ưu Tiên:
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                            {(Object.keys(PRIORITY_METADATA) as TicketPriority[]).map(pri => {
                                const meta = PRIORITY_METADATA[pri];
                                const isSelected = priority === pri;
                                return (
                                    <button
                                        type="button"
                                        key={pri}
                                        onClick={() => setPriority(pri)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                            isSelected
                                                ? `${meta.bgClass} ${meta.colorClass} border-current ring-1 ring-current shadow-xs`
                                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        {meta.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            3. Tiêu Đề Chủ Đề / Phiếu: <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ví dụ: Góp ý co gọn độ rộng cột bảng số liệu trên điện thoại..."
                            className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                        />
                    </div>

                    {/* Content */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            4. Nội Dung Mô Tả Chi Tiết: <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Mô tả cụ thể mong muốn, thắc mắc hoặc các bước tái hiện lỗi để Admin hỗ trợ nhanh nhất..."
                            rows={4}
                            className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                        />
                    </div>

                    {/* Anonymous Mode Toggle */}
                    <div
                        onClick={() => setIsAnonymous(!isAnonymous)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isAnonymous
                                ? 'bg-indigo-50/70 border-indigo-300 shadow-xs'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                        }`}
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-xl shrink-0">🎭</span>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900">
                                        Gửi dưới dạng ẩn danh (Anonymous)
                                    </span>
                                    {isAnonymous && (
                                        <span className="text-[10px] font-extrabold bg-indigo-600 text-white px-1.5 py-0.2 rounded-full">
                                            Bật
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Tên và Mã nhân viên của bạn sẽ được ẩn hoàn toàn trên phiếu và với người xem khác.
                                </p>
                            </div>
                        </div>

                        {/* Switch pill */}
                        <div className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                            isAnonymous ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                        }`}>
                            <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
                        </div>
                    </div>

                    {/* Creator Metadata info preview */}
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                        <span>
                            Người gửi: {isAnonymous ? (
                                <strong className="text-indigo-600">🎭 Ẩn danh (Hệ thống ẩn thông tin)</strong>
                            ) : (
                                <><strong>{currentUser.full_name}</strong> ({currentUser.employee_id})</>
                            )}
                        </span>
                        <span>{currentUser.store_name || 'Hệ thống'}</span>
                    </div>

                    {/* Submit Actions */}
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
                        >
                            <Send className="w-3.5 h-3.5" />
                            <span>{isSubmitting ? 'Đang gửi...' : 'Gửi Phiếu'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
