import { useState, useEffect } from 'react';
import { type SystemPagePermission, DEFAULT_PAGE_PERMISSIONS } from '../../../core/lib/permissions';
import {
    X,
    Check,
    Edit3,
    FileText,
    Sparkles,
    RotateCcw,
    Layers,
    Compass
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    page: SystemPagePermission | null;
    onSave: (path: string, newPageName: string, newDescription?: string) => void;
}

const QUICK_NAME_TAGS = [
    'BC',
    '(Realtime)',
    '(Lũy kế)',
    '(Mới)',
    'Tổng hợp',
    'Chi tiết',
    'Theo dõi',
    'Định lượng'
];

export default function EditPageModal({
    isOpen,
    onClose,
    page,
    onSave
}: Props) {
    const [pageName, setPageName] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string>('');

    // Tìm tên mặc định gốc của hệ thống nếu có
    const defaultPage = page
        ? DEFAULT_PAGE_PERMISSIONS.find(d => d.path === page.path || d.page_key === page.page_key)
        : null;

    useEffect(() => {
        if (page) {
            setPageName(page.page_name || '');
            setDescription(page.description || '');
            setErrorMsg('');
        }
    }, [page, isOpen]);

    if (!isOpen || !page) return null;

    const trimmedName = pageName.trim();
    const isOriginalName = defaultPage ? trimmedName === defaultPage.page_name : false;
    const hasNameChanged = trimmedName !== (page.page_name || '');
    const hasDescChanged = description.trim() !== (page.description || '').trim();
    const hasAnyChange = hasNameChanged || hasDescChanged;

    const handleRestoreDefaultName = () => {
        if (defaultPage) {
            setPageName(defaultPage.page_name);
            if (defaultPage.description) {
                setDescription(defaultPage.description);
            }
            setErrorMsg('');
        }
    };

    const handleAppendTag = (tag: string) => {
        if (!pageName.includes(tag)) {
            setPageName(prev => {
                const current = prev.trim();
                return current ? `${current} ${tag}` : tag;
            });
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!trimmedName) {
            setErrorMsg('Vui lòng nhập tên phân hệ / trang (không được để trống).');
            return;
        }

        onSave(page.path, trimmedName, description.trim());
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header Modal */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
                            <Edit3 className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-black text-slate-800">
                                Đổi Tên Phân Hệ / Trang
                            </h2>
                            <p className="text-[11px] text-slate-500">
                                Cập nhật tên hiển thị trên Sidebar Navigation & toàn hệ thống
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl hover:bg-slate-200/70 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto no-scrollbar flex-1 text-xs">
                    {/* Thẻ tóm tắt thông tin trang hiện tại */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                <Compass className="w-3 h-3 text-indigo-500" />
                                Phân hệ đang chọn
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                                <Layers className="w-2.5 h-2.5" />
                                {page.group_title || 'HỆ THỐNG'}
                            </span>
                        </div>
                        <div className="font-mono text-[11px] text-indigo-600 flex items-center gap-1.5 truncate">
                            <span>{page.path}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[10px] text-slate-400 font-sans font-medium">Mã: {page.page_key}</span>
                        </div>
                    </div>

                    {/* Trường nhập: Tên phân hệ / trang */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="font-extrabold text-slate-800 block">
                                Tên phân hệ / trang mới <span className="text-rose-500">*</span>:
                            </label>
                            {defaultPage && !isOriginalName && (
                                <button
                                    type="button"
                                    onClick={handleRestoreDefaultName}
                                    className="text-[10.5px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition cursor-pointer hover:underline"
                                    title={`Khôi phục về: "${defaultPage.page_name}"`}
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Tên gốc: {defaultPage.page_name}</span>
                                </button>
                            )}
                        </div>

                        <input
                            type="text"
                            value={pageName}
                            onChange={(e) => {
                                setPageName(e.target.value);
                                if (errorMsg) setErrorMsg('');
                            }}
                            placeholder="Ví dụ: BC Cụm Siêu Thị, Doanh Thu Realtime,..."
                            autoFocus
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-xs font-bold text-slate-800 transition outline-hidden"
                        />

                        {errorMsg && (
                            <p className="text-[11px] font-bold text-rose-600">
                                ⚠️ {errorMsg}
                            </p>
                        )}

                        {/* Thẻ gợi ý nhanh từ khóa */}
                        <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5">
                                <Sparkles className="w-2.5 h-2.5 text-amber-500" /> Gợi ý:
                            </span>
                            {QUICK_NAME_TAGS.map(tag => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => handleAppendTag(tag)}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 transition cursor-pointer"
                                >
                                    +{tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Trường nhập: Mô tả chức năng */}
                    <div className="space-y-1.5">
                        <label className="font-extrabold text-slate-800 block flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            Mô tả chức năng (Tùy chọn):
                        </label>
                        <textarea
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Mô tả tóm tắt nội dung báo cáo hoặc chức năng trang..."
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-xs text-slate-700 transition outline-hidden resize-none"
                        />
                    </div>

                    {/* Xem trước hiển thị trên Sidebar Navigation */}
                    <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3.5 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                            👁️ Xem trước hiển thị trên Sidebar:
                        </span>
                        <div className="bg-slate-900 text-white rounded-xl p-2.5 flex items-center justify-between gap-3 shadow-inner">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                                    ★
                                </div>
                                <span className="text-xs font-extrabold truncate text-white">
                                    {trimmedName || '(Chưa nhập tên)'}
                                </span>
                            </div>

                            {/* Badge nếu có */}
                            {page.badge_text && (
                                <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 shrink-0">
                                    {page.badge_icon} {page.badge_text}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Footer Nút Thao Tác */}
                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={!trimmedName || !hasAnyChange}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-md shadow-indigo-200 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Check className="w-4 h-4" />
                            <span>Xác Nhận Đổi Tên</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
