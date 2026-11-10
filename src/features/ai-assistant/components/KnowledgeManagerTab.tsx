import React, { useState, useMemo } from 'react';
import {
    Plus,
    Search,
    BookOpen,
    Edit3,
    Trash2,
    Eye,
    EyeOff,
    Image as ImageIcon,
    Shield,
    FileText
} from 'lucide-react';
import {
    KNOWLEDGE_CATEGORIES,
    ROLE_SCOPE_OPTIONS,
    type KnowledgeDocument
} from '../types/aiAssistantTypes';
import type { StoreItem } from '../../../core/lib/storage';
import { formatDate } from '../../../core/lib/formatters';
import { deleteKnowledgeDocument, toggleKnowledgeDocumentActive } from '../services/knowledgeService';
import KnowledgeDocEditor from './KnowledgeDocEditor';

interface Props {
    documents: KnowledgeDocument[];
    isAdmin: boolean;
    availableStores: StoreItem[];
    currentUserName: string;
    onRefresh: () => void;
    onAskFromDoc: (docTitle: string) => void;
    onToast: (msg: string) => void;
}

export default function KnowledgeManagerTab({
    documents,
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
            onToast('🗑️ Đã xóa tài liệu và dọn sạch ảnh trên Storage!');
            onRefresh();
        } else {
            onToast(`⚠️ ${res.error}`);
        }
    };

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
            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm tên tài liệu, chuyên mục..."
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                        />
                    </div>

                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
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
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer shrink-0"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Nạp Tài Liệu / Ảnh Mới</span>
                    </button>
                )}
            </div>

            {/* Danh sách tài liệu */}
            {filteredDocs.length === 0 ? (
                <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 text-center space-y-2">
                    <BookOpen className="w-9 h-9 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">
                        Chưa có tài liệu nào phù hợp trong phạm vi quyền truy cập của bạn.
                    </p>
                    {isAdmin && (
                        <p className="text-[11px] text-slate-400">
                            Nhấn &quot;Nạp Tài Liệu / Ảnh Mới&quot; để tải lên Word, Excel, PDF, Ảnh hoặc văn bản nội bộ.
                        </p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {filteredDocs.map((doc) => (
                        <div
                            key={doc.id}
                            className={`bg-white rounded-2xl border p-3.5 shadow-2xs flex flex-col justify-between gap-2.5 transition ${
                                doc.is_active ? 'border-slate-200' : 'border-slate-200 bg-slate-50/70 opacity-70'
                            }`}
                        >
                            <div className="space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                                            {doc.source_type}
                                        </span>
                                        <span className="text-[10.5px] font-bold text-slate-500">{doc.category}</span>
                                        {doc.image_paths && doc.image_paths.length > 0 && (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                                <ImageIcon className="w-2.5 h-2.5" />
                                                {doc.image_paths.length} ảnh
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 shrink-0">
                                        {doc.updated_at ? formatDate(doc.updated_at) : ''}
                                    </span>
                                </div>

                                <h3 className="text-xs sm:text-[13px] font-black text-slate-900 leading-snug flex items-start gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                    <span>{doc.title}</span>
                                </h3>

                                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                    {doc.summary || doc.raw_content.slice(0, 140)}
                                </p>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                                {/* Chip vai trò */}
                                <div className="flex items-center gap-1 flex-wrap">
                                    <Shield className="w-3 h-3 text-slate-400" />
                                    {(doc.allowed_roles || ['ALL']).map((r) => {
                                        const meta = ROLE_SCOPE_OPTIONS.find((o) => o.value === r);
                                        return (
                                            <span
                                                key={r}
                                                className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                                                    meta?.badgeClass || 'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}
                                            >
                                                {meta?.shortLabel || r}
                                            </span>
                                        );
                                    })}
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => onAskFromDoc(doc.title)}
                                        className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10.5px] font-bold transition cursor-pointer"
                                    >
                                        Hỏi về tài liệu này
                                    </button>

                                    {isAdmin && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleActive(doc)}
                                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                                                title={doc.is_active ? 'Tạm ẩn' : 'Kích hoạt lại'}
                                            >
                                                {doc.is_active ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingDoc(doc);
                                                    setShowEditor(true);
                                                }}
                                                className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                                                title="Chỉnh sửa tài liệu"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(doc)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                                                title="Xóa tài liệu"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

