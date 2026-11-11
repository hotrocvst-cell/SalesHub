import React, { useState, useMemo } from 'react';
import { Plus, Search, BookOpen, X } from 'lucide-react';
import { KNOWLEDGE_CATEGORIES, type KnowledgeDocument } from '../types/aiAssistantTypes';
import type { StoreItem } from '../../../core/lib/storage';
import { deleteKnowledgeDocument, toggleKnowledgeDocumentActive } from '../services/knowledgeService';
import KnowledgeDocEditor from './KnowledgeDocEditor';
import KnowledgeDocCard from './KnowledgeDocCard';

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

    const filteredDocs = useMemo(() => {
        return documents.filter((d) => {
            if (selectedCategory !== 'ALL' && d.category !== selectedCategory) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                return (
                    d.title.toLowerCase().includes(q) ||
                    (d.summary || '').toLowerCase().includes(q) ||
                    d.category.toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [documents, selectedCategory, searchQuery]);

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
            {/* Thanh bộ lọc & Nút thêm tài liệu (Admin) */}
            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
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
                            onAskFromDoc={onAskFromDoc}
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

