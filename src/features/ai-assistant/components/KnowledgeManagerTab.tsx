import React, { useState, useMemo } from 'react';
import { Plus, Search, BookOpen, X, ArrowUpDown, Filter, AlertTriangle } from 'lucide-react';
import { KNOWLEDGE_CATEGORIES, type KnowledgeDocument } from '../types/aiAssistantTypes';
import type { StoreItem } from '../../../core/lib/storage';
import {
    deleteKnowledgeDocument,
    toggleKnowledgeDocumentActive,
    isDocumentExpired,
    recordDocumentAccess
} from '../services/knowledgeService';
import KnowledgeDocEditor from './KnowledgeDocEditor';
import KnowledgeDocCard from './KnowledgeDocCard';
import TopHotDocumentsWidget from './TopHotDocumentsWidget';

interface Props {
    documents: KnowledgeDocument[];
    isLoading?: boolean;
    isAdmin: boolean;
    availableStores: StoreItem[];
    currentUserName: string;
    onRefresh: () => void;
    onAskFromDoc: (docTitle: string) => void;
    onToast: (msg: string) => void;
}

export default function KnowledgeManagerTab({
    documents,
    isLoading = false,
    isAdmin,
    availableStores,
    currentUserName,
    onRefresh,
    onAskFromDoc,
    onToast
}: Props) {
    const [showEditor, setShowEditor] = useState(false);
    const [editingDoc, setEditingDoc] = useState<KnowledgeDocument | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [usageFilter, setUsageFilter] = useState<'ALL' | 'VALID' | 'EXPIRED' | 'ZERO_VIEWS'>('ALL');
    const [sortOrder, setSortOrder] = useState<'UPDATED' | 'MOST_VIEWED' | 'LEAST_VIEWED'>('UPDATED');

    const expiredCount = useMemo(() => documents.filter((d) => isDocumentExpired(d.valid_until)).length, [documents]);
    const zeroViewsCount = useMemo(() => documents.filter((d) => (d.view_count || 0) === 0).length, [documents]);

    const filteredDocs = useMemo(() => {
        return documents
            .filter((d) => {
                if (selectedCategory !== 'ALL' && d.category !== selectedCategory) return false;

                // Lọc theo trạng thái hiệu lực & mức độ sử dụng
                if (usageFilter === 'VALID' && isDocumentExpired(d.valid_until)) return false;
                if (usageFilter === 'EXPIRED' && !isDocumentExpired(d.valid_until)) return false;
                if (usageFilter === 'ZERO_VIEWS' && (d.view_count || 0) > 0) return false;

                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    return (
                        d.title.toLowerCase().includes(q) ||
                        (d.summary || '').toLowerCase().includes(q) ||
                        d.category.toLowerCase().includes(q)
                    );
                }
                return true;
            })
            .sort((a, b) => {
                if (sortOrder === 'MOST_VIEWED') {
                    return (b.view_count || 0) - (a.view_count || 0);
                }
                if (sortOrder === 'LEAST_VIEWED') {
                    return (a.view_count || 0) - (b.view_count || 0);
                }
                // Mặc định: Mới cập nhật nhất
                return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
            });
    }, [documents, selectedCategory, searchQuery, usageFilter, sortOrder]);

    const handleAskFromDoc = (docTitle: string, docId?: string) => {
        if (docId) {
            recordDocumentAccess([docId]);
        }
        onAskFromDoc(docTitle);
    };

    const handleToggleActive = async (doc: KnowledgeDocument) => {
        const res = await toggleKnowledgeDocumentActive(doc.id, !doc.is_active);
        if (res.success) {
            onToast(doc.is_active ? 'Đã tạm ẩn tài liệu khỏi Chatbot' : 'Đã kích hoạt lại tài liệu');
            onRefresh();
        } else {
            onToast(`⚠️ ${res.error}`);
        }
    };

    const handleDelete = async (doc: KnowledgeDocument) => {
        if (!window.confirm(`Xác nhận xóa vĩnh viễn tài liệu "${doc.title}" (bao gồm ảnh gốc đính kèm)?`)) return;
        const res = await deleteKnowledgeDocument(doc);
        if (res.success) {
            onToast('Đã xóa tài liệu và dọn sạch ảnh trên Storage!');
            onRefresh();
        } else {
            onToast(`⚠️ ${res.error}`);
        }
    };

    const hasActiveFilter = Boolean(searchQuery.trim() || selectedCategory !== 'ALL');

    if (showEditor && isAdmin) {
        return (
            <KnowledgeDocEditor
                editingDoc={editingDoc}
                availableStores={availableStores}
                currentUserName={currentUserName}
                onSaved={() => {
                    setShowEditor(false);
                    setEditingDoc(null);
                    onRefresh();
                }}
                onCancel={() => {
                    setShowEditor(false);
                    setEditingDoc(null);
                }}
                onToast={onToast}
            />
        );
    }

    return (
        <div className="space-y-3">
            {/* 1. BẢNG XẾP HẠNG TOP TÀI LIỆU HOT (TUẦN / THÁNG / ALL-TIME) */}
            <TopHotDocumentsWidget onAskFromDoc={onAskFromDoc} />

            {/* 2. Thanh bộ lọc & Nút thêm tài liệu (Admin) */}
            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm flex flex-col gap-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                        <div className="relative flex-1 min-w-[180px]">
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                            <input
                                id="knowledge-search-input"
                                name="knowledgeSearch"
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                aria-label="Tìm kiếm tài liệu"
                                placeholder="Tìm tên tài liệu, chuyên mục..."
                                className="w-full h-9 pl-8 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    aria-label="Xóa từ khóa tìm kiếm"
                                    className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                            )}
                        </div>

                        <select
                            id="knowledge-category-select"
                            name="knowledgeCategory"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            aria-label="Lọc theo chuyên mục"
                            className="w-full sm:w-auto h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="ALL">Tất cả chuyên mục ({documents.length})</option>
                            {KNOWLEDGE_CATEGORIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    {isAdmin && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingDoc(null);
                                setShowEditor(true);
                            }}
                            className="h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                        >
                            <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>Nạp Tài Liệu / Ảnh Mới</span>
                        </button>
                    )}
                </div>

                {/* Dòng bộ lọc phụ: HSD & Mức độ tra cứu & Sắp xếp */}
                <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                            <Filter className="w-3 h-3 text-slate-400" />
                            Lọc:
                        </span>
                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg flex-wrap">
                            <button
                                type="button"
                                onClick={() => setUsageFilter('ALL')}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                    usageFilter === 'ALL' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Tất cả ({documents.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setUsageFilter('VALID')}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                    usageFilter === 'VALID' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Còn hiệu lực
                            </button>
                            <button
                                type="button"
                                onClick={() => setUsageFilter('EXPIRED')}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                    usageFilter === 'EXPIRED' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:bg-rose-50'
                                }`}
                                title="Các tài liệu đã qua thời hạn áp dụng, đang bị ẩn khỏi AI"
                            >
                                🔴 Hết hạn ({expiredCount})
                            </button>
                            <button
                                type="button"
                                onClick={() => setUsageFilter('ZERO_VIEWS')}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                    usageFilter === 'ZERO_VIEWS' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-800 hover:bg-amber-50'
                                }`}
                                title="Tài liệu chưa từng có lượt tra cứu nào (Cần xem xét cập nhật hoặc dọn dẹp)"
                            >
                                ⚪ Chưa dùng ({zeroViewsCount})
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            Sắp xếp:
                        </span>
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as any)}
                            aria-label="Sắp xếp danh sách tài liệu"
                            className="h-7 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[10.5px] font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="UPDATED">Mới cập nhật</option>
                            <option value="MOST_VIEWED">Nhiều lượt tra cứu nhất 🔥</option>
                            <option value="LEAST_VIEWED">Ít lượt tra cứu nhất</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Danh sách tài liệu */}
            {isLoading && documents.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5" aria-label="Đang tải danh sách tài liệu">
                    {[0, 1, 2, 3].map((idx) => (
                        <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-3.5 h-36 animate-pulse space-y-2.5">
                            <div className="h-4 w-1/3 bg-slate-200 rounded" />
                            <div className="h-4 w-3/4 bg-slate-200 rounded" />
                            <div className="h-3 w-full bg-slate-100 rounded" />
                        </div>
                    ))}
                </div>
            ) : filteredDocs.length === 0 ? (
                <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 text-center space-y-2.5">
                    <BookOpen className="w-9 h-9 text-slate-400 mx-auto" aria-hidden="true" />
                    <p className="text-xs font-bold text-slate-700">
                        {hasActiveFilter
                            ? 'Không tìm thấy tài liệu khớp bộ lọc hiện tại.'
                            : 'Chưa có tài liệu nào trong phạm vi quyền truy cập của bạn.'}
                    </p>
                    {hasActiveFilter ? (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                setSelectedCategory('ALL');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                        >
                            Đặt lại bộ lọc
                        </button>
                    ) : isAdmin && (
                        <p className="text-[11px] text-slate-500">
                            Nhấn &quot;Nạp Tài Liệu / Ảnh Mới&quot; để tải lên Word, Excel, PDF, Ảnh hoặc văn bản nội bộ.
                        </p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {filteredDocs.map((doc) => (
                        <KnowledgeDocCard
                            key={doc.id}
                            doc={doc}
                            isAdmin={isAdmin}
                            onAskFromDoc={() => handleAskFromDoc(doc.title, doc.id)}
                            onToggleActive={handleToggleActive}
                            onEdit={(targetDoc) => {
                                setEditingDoc(targetDoc);
                                setShowEditor(true);
                            }}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

