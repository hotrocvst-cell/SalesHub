import React, { useState, useRef } from 'react';
import {
    UploadCloud,
    Sparkles,
    Save,
    X,
    Image as ImageIcon,
    FileText,
    Loader2,
    Trash2
} from 'lucide-react';
import {
    KNOWLEDGE_CATEGORIES,
    type KnowledgeDocument,
    type KnowledgeSourceType
} from '../types/aiAssistantTypes';
import { parseUploadedDocumentFile } from '../utils/documentParser';
import { uploadKnowledgeImage, getSignedImageUrlsBatch } from '../services/knowledgeStorageService';
import { saveKnowledgeDocument } from '../services/knowledgeService';
import type { StoreItem } from '../../../core/lib/storage';
import RoleStoreScopeSelector from './RoleStoreScopeSelector';

interface Props {
    editingDoc?: KnowledgeDocument | null;
    availableStores: StoreItem[];
    currentUserName: string;
    onSaved: () => void;
    onCancel: () => void;
    onToast: (msg: string) => void;
}

export default function KnowledgeDocEditor({
    editingDoc,
    availableStores,
    currentUserName,
    onSaved,
    onCancel,
    onToast
}: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const extraImageInputRef = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState(editingDoc?.title || '');
    const [category, setCategory] = useState<string>(editingDoc?.category || KNOWLEDGE_CATEGORIES[0]);
    const [sourceType, setSourceType] = useState<KnowledgeSourceType>(editingDoc?.source_type || 'TEXT');
    const [rawContent, setRawContent] = useState(editingDoc?.raw_content || '');
    const [imagePaths, setImagePaths] = useState<string[]>(editingDoc?.image_paths || []);
    const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
    const [allowedRoles, setAllowedRoles] = useState<string[]>(editingDoc?.allowed_roles || ['ALL']);
    const [allowedStores, setAllowedStores] = useState<string[]>(editingDoc?.allowed_stores || ['ALL']);
    const [isParsingFile, setIsParsingFile] = useState(false);
    const [isUploadingImg, setIsUploadingImg] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    React.useEffect(() => {
        if (imagePaths.length > 0) {
            getSignedImageUrlsBatch(imagePaths).then(setPreviewUrls);
        }
    }, [imagePaths]);

    const handleUploadDocumentFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        setIsParsingFile(true);
        try {
            const parsed = await parseUploadedDocumentFile(file);
            if (!title.trim()) {
                setTitle(file.name.replace(/\.[^.]+$/, ''));
            }
            setSourceType(parsed.sourceType);
            setRawContent((prev) => (prev.trim() ? `${prev.trim()}\n\n---\n\n${parsed.markdown}` : parsed.markdown));

            if (parsed.isImage) {
                const upRes = await uploadKnowledgeImage(file, 'docs');
                if (upRes.success && upRes.storagePath) {
                    setImagePaths((prev) => [...prev, upRes.storagePath!]);
                    onToast(`✅ Đã đọc ảnh & lưu ảnh gốc (${upRes.sizeKb || 0} KB) lên Supabase Storage!`);
                } else {
                    onToast(`⚠️ Đã đọc chữ nhưng chưa lưu được ảnh gốc: ${upRes.error}`);
                }
            } else {
                onToast(`✅ Đã bóc tách thành công file ${parsed.sourceType}! Hãy rà soát lại nội dung trước khi lưu.`);
            }
        } catch (err: any) {
            onToast(`⚠️ ${err?.message || 'Lỗi đọc file tài liệu'}`);
        } finally {
            setIsParsingFile(false);
        }
    };

    const handleUploadExtraImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        e.target.value = '';

        setIsUploadingImg(true);
        let added = 0;
        for (const f of files.slice(0, 5)) {
            const res = await uploadKnowledgeImage(f, 'docs');
            if (res.success && res.storagePath) {
                setImagePaths((prev) => [...prev, res.storagePath!]);
                added++;
            } else if (res.error) {
                onToast(`⚠️ ${res.error}`);
            }
        }
        if (added > 0) {
            onToast(`🖼️ Đã nén và tải ${added} ảnh gốc lên Supabase Storage!`);
        }
        setIsUploadingImg(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !rawContent.trim()) {
            onToast('⚠️ Vui lòng nhập tiêu đề và nội dung tài liệu!');
            return;
        }
        setIsSaving(true);
        const res = await saveKnowledgeDocument({
            id: editingDoc?.id,
            title,
            category,
            source_type: sourceType,
            raw_content: rawContent,
            image_paths: imagePaths,
            allowed_roles: allowedRoles,
            allowed_stores: allowedStores,
            is_active: editingDoc?.is_active ?? true,
            created_by: currentUserName
        });
        setIsSaving(false);

        if (!res.success) {
            onToast(`⚠️ Lỗi lưu tài liệu: ${res.error}`);
            return;
        }
        onToast(`🎉 Đã lưu tài liệu "${title}" (${res.chunkCount} phân đoạn tri thức)!`);
        onSaved();
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>{editingDoc ? 'Chỉnh Sửa Tài Liệu Tri Thức' : 'Nạp Tài Liệu / Ảnh Mới Vào Kho'}</span>
                </div>
                <button type="button" onClick={onCancel} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Vùng nạp file đa định dạng */}
            <div className="p-3 bg-blue-50/60 border border-dashed border-blue-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="text-xs text-blue-900 space-y-0.5">
                    <div className="font-bold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>Tải lên đa nguồn (Word, Excel, PDF, Ảnh, Text)</span>
                    </div>
                    <p className="text-[11px] text-blue-700/80">
                        Hỗ trợ `.docx`, `.xlsx`, `.pdf`, `.txt`, `.md` và ảnh chụp `.jpg/.png` (tự động nén &amp; trích xuất chữ).
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.md,.csv,.xlsx,.xls,.docx,.pdf,image/*"
                        className="hidden"
                        onChange={handleUploadDocumentFile}
                    />
                    <button
                        type="button"
                        disabled={isParsingFile}
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                    >
                        {isParsingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                        <span>{isParsingFile ? 'Đang bóc tách...' : 'Chọn File / Ảnh'}</span>
                    </button>

                    <input
                        ref={extraImageInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleUploadExtraImages}
                    />
                    <button
                        type="button"
                        disabled={isUploadingImg}
                        onClick={() => extraImageInputRef.current?.click()}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                        title="Đính kèm thêm hình ảnh gốc minh họa (không OCR lại chữ)"
                    >
                        {isUploadingImg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />}
                        <span>+ Ảnh minh họa</span>
                    </button>
                </div>
            </div>

            {/* Tiêu đề & Danh mục */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">Tiêu đề tài liệu: <span className="text-rose-500">*</span></label>
                    <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ví dụ: Quy định thưởng thi đua ngành hàng Gia dụng T11..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">Chuyên mục:</label>
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                    >
                        {KNOWLEDGE_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Bộ chọn phân quyền 4 cấp & phạm vi ST */}
            <RoleStoreScopeSelector
                allowedRoles={allowedRoles}
                allowedStores={allowedStores}
                availableStores={availableStores}
                onChangeRoles={setAllowedRoles}
                onChangeStores={setAllowedStores}
            />

            {/* Xem trước ảnh đính kèm nếu có */}
            {imagePaths.length > 0 && (
                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700">Hình ảnh gốc đính kèm ({imagePaths.length}):</label>
                    <div className="flex items-center gap-2 flex-wrap">
                        {imagePaths.map((p, idx) => (
                            <div key={p + idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-300 bg-slate-100">
                                {previewUrls[p] ? (
                                    <img src={previewUrls[p]} alt="preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">Ảnh #{idx + 1}</div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setImagePaths((prev) => prev.filter((_, i) => i !== idx))}
                                    className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full shadow cursor-pointer"
                                    title="Gỡ ảnh khỏi tài liệu"
                                >
                                    <Trash2 className="w-2.5 h-2.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Nội dung văn bản Markdown */}
            <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Nội dung chi tiết (hỗ trợ Markdown &amp; Bảng): <span className="text-rose-500">*</span></label>
                <textarea
                    required
                    rows={8}
                    value={rawContent}
                    onChange={(e) => setRawContent(e.target.value)}
                    placeholder="Dán nội dung quy định, hướng dẫn hoặc tải file phía trên để AI tự bóc tách vào đây..."
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-mono leading-relaxed text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                    Hủy
                </button>
                <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-60"
                >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{isSaving ? 'Đang lưu Cloud...' : 'Lưu Kho Tri Thức'}</span>
                </button>
            </div>
        </form>
    );
}
