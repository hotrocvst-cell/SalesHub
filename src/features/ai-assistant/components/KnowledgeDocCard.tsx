import React from 'react';
import {
    Edit3,
    Trash2,
    Eye,
    EyeOff,
    Image as ImageIcon,
    Shield,
    FileText
} from 'lucide-react';
import { ROLE_SCOPE_OPTIONS, type KnowledgeDocument } from '../types/aiAssistantTypes';
import { formatDate } from '../../../core/lib/formatters';

interface Props {
    doc: KnowledgeDocument;
    isAdmin: boolean;
    onAskFromDoc: (docTitle: string) => void;
    onToggleActive: (doc: KnowledgeDocument) => void;
    onEdit: (doc: KnowledgeDocument) => void;
    onDelete: (doc: KnowledgeDocument) => void;
}

/**
 * Thẻ hiển thị tóm tắt tài liệu tri thức kèm phân quyền và tác vụ quản trị.
 */
export default function KnowledgeDocCard({
    doc,
    isAdmin,
    onAskFromDoc,
    onToggleActive,
    onEdit,
    onDelete
}: Props) {
    return (
        <div
            className={`bg-white rounded-2xl border p-3.5 shadow-sm flex flex-col justify-between gap-2.5 transition ${
                doc.is_active ? 'border-slate-200' : 'border-slate-200 bg-slate-50/70 opacity-75'
            }`}
        >
            <div className="space-y-1.5 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                            {doc.source_type}
                        </span>
                        <span className="text-[10.5px] font-bold text-slate-600">{doc.category}</span>
                        {doc.image_paths && doc.image_paths.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold tabular-nums">
                                <ImageIcon className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                                {doc.image_paths.length} ảnh
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">
                        {doc.updated_at ? formatDate(doc.updated_at) : ''}
                    </span>
                </div>

                <h3 className="text-xs sm:text-[13px] font-black text-slate-900 leading-snug flex items-start gap-1.5 break-words">
                    <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="min-w-0 break-words">{doc.title}</span>
                </h3>

                <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                    {doc.summary || doc.raw_content.slice(0, 140)}
                </p>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1 flex-wrap">
                    <Shield className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
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
                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10.5px] font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        Hỏi về tài liệu này
                    </button>

                    {isAdmin && (
                        <>
                            <button
                                type="button"
                                onClick={() => onToggleActive(doc)}
                                aria-label={doc.is_active ? `Tạm ẩn tài liệu ${doc.title}` : `Kích hoạt tài liệu ${doc.title}`}
                                className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                title={doc.is_active ? 'Tạm ẩn' : 'Kích hoạt lại'}
                            >
                                {doc.is_active ? <Eye className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /> : <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => onEdit(doc)}
                                aria-label={`Chỉnh sửa tài liệu ${doc.title}`}
                                className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                title="Chỉnh sửa tài liệu"
                            >
                                <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                onClick={() => onDelete(doc)}
                                aria-label={`Xóa tài liệu ${doc.title}`}
                                className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                                title="Xóa tài liệu"
                            >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

