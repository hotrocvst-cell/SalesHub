import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Save } from 'lucide-react';
import type { OcrToolCategory, SampleDataGroup } from '../types';
import { inferOcrToolCategory, inferOcrToolPath } from '../utils/ocrSamplePresets';

interface SampleDataGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (groupData: Partial<SampleDataGroup>) => void;
    editingGroup?: SampleDataGroup | null;
}

const TOOL_CATEGORY_OPTIONS: { value: OcrToolCategory; label: string }[] = [
    { value: 'cumulative_store', label: 'OCR Lũy kế — ST (/cap-nhat-ocr)' },
    { value: 'cumulative_employee', label: 'OCR Lũy kế — Nhân viên NV (/cap-nhat-nhan-vien-ocr)' },
    { value: 'realtime_store', label: 'OCR Realtime — ST (/bc-ngay/tong-quan)' },
    { value: 'realtime_employee', label: 'OCR Realtime — Nhân viên NV (/bc-ngay-nhan-vien)' },
    { value: 'other', label: 'Công cụ OCR khác' }
];

export default function SampleDataGroupModal({
    isOpen,
    onClose,
    onSave,
    editingGroup
}: SampleDataGroupModalProps) {
    const [title, setTitle] = useState('');
    const [key, setKey] = useState('');
    const [category, setCategory] = useState<OcrToolCategory>('cumulative_store');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (editingGroup) {
            setTitle(editingGroup.group_title);
            setKey(editingGroup.group_key);
            setCategory(editingGroup.tool_category || inferOcrToolCategory(editingGroup.group_key, editingGroup.group_title));
            setDescription(editingGroup.description || '');
        } else {
            setTitle('');
            setKey('');
            setCategory('cumulative_store');
            setDescription('');
        }
    }, [editingGroup, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            alert('Vui lòng nhập tên nhóm công cụ OCR!');
            return;
        }

        const slug = title
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_');

        const normalizedKey = key.trim()
            ? key.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
            : (category !== 'other' ? `ocr_${category}_${slug}` : `ocr_${slug}`);

        onSave({
            group_title: title.trim(),
            group_key: normalizedKey,
            tool_category: category,
            tool_path: inferOcrToolPath(category),
            description: description.trim()
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FolderPlus className="w-5 h-5 text-blue-300" aria-hidden="true" />
                        <h3 className="font-black text-sm sm:text-base">
                            {editingGroup ? 'Chỉnh sửa nhóm công cụ OCR' : 'Thêm nhóm hình ảnh mẫu OCR'}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng cửa sổ"
                        className="p-1 rounded-lg hover:bg-white/15 text-white/80 hover:text-white cursor-pointer transition"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 text-xs font-medium">
                    <div>
                        <label htmlFor="sample-group-category" className="block text-xs font-bold text-slate-700 mb-1">
                            Loại công cụ OCR <span className="text-rose-500">*</span>
                        </label>
                        <select
                            id="sample-group-category"
                            name="tool_category"
                            value={category}
                            onChange={e => setCategory(e.target.value as OcrToolCategory)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                        >
                            {TOOL_CATEGORY_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="sample-group-title" className="block text-xs font-bold text-slate-700 mb-1">
                            Tên nhóm công cụ <span className="text-rose-500">*</span>
                        </label>
                        <input
                            id="sample-group-title"
                            name="group_title"
                            type="text"
                            required
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Ví dụ: OCR Lũy kế ST — Bản chụp dọc điện thoại"
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:bg-white"
                        />
                    </div>

                    <div>
                        <label htmlFor="sample-group-key" className="block text-xs font-bold text-slate-700 mb-1">
                            Mã định danh nhóm (Group Key)
                        </label>
                        <input
                            id="sample-group-key"
                            name="group_key"
                            type="text"
                            value={key}
                            disabled={Boolean(editingGroup)}
                            onChange={e => setKey(e.target.value)}
                            placeholder="Để trống để hệ thống tự sinh theo loại công cụ"
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-mono text-[11px] focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label htmlFor="sample-group-desc" className="block text-xs font-bold text-slate-700 mb-1">
                            Mô tả / Hướng dẫn chung
                        </label>
                        <textarea
                            id="sample-group-desc"
                            name="description"
                            rows={2}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Ghi chú phạm vi áp dụng của bộ ảnh mẫu này..."
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                        />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer transition"
                        >
                            <Save className="w-4 h-4" aria-hidden="true" />
                            <span>{editingGroup ? 'Cập nhật nhóm' : 'Tạo nhóm'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
