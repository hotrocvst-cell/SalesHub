import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Save } from 'lucide-react';
import type { SampleDataGroup } from '../types';

interface SampleDataGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (groupData: Partial<SampleDataGroup>) => void;
    editingGroup?: SampleDataGroup | null;
}

export default function SampleDataGroupModal({
    isOpen,
    onClose,
    onSave,
    editingGroup
}: SampleDataGroupModalProps) {
    const [title, setTitle] = useState('');
    const [key, setKey] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (editingGroup) {
            setTitle(editingGroup.group_title);
            setKey(editingGroup.group_key);
            setDescription(editingGroup.description || '');
        } else {
            setTitle('');
            setKey('');
            setDescription('');
        }
    }, [editingGroup, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            alert('Vui lòng nhập tiêu đề nhóm!');
            return;
        }

        const normalizedKey = key.trim()
            ? key.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
            : title
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd')
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '_');

        onSave({
            group_title: title.trim(),
            group_key: normalizedKey,
            description: description.trim()
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header Modal */}
                <div className="p-4 bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FolderPlus className="w-5 h-5 text-blue-200" />
                        <h3 className="font-black text-sm sm:text-base">
                            {editingGroup ? 'Chỉnh sửa Nhóm dữ liệu' : 'Tạo Nhóm dữ liệu mẫu mới'}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white cursor-pointer transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 text-xs font-medium">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Tiêu đề nhóm <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Ví dụ: Báo cáo Thi đua & Xếp hạng"
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:bg-white"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Mã định danh nhóm (Group Key)
                        </label>
                        <input
                            type="text"
                            value={key}
                            disabled={Boolean(editingGroup)}
                            onChange={e => setKey(e.target.value)}
                            placeholder="Để trống hệ thống sẽ tự sinh (ví dụ: thi_dua_xep_hang)"
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-mono text-[11px] focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:opacity-50"
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">
                            Mã duy nhất dùng để định danh trên Supabase DB.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Mô tả / Ghi chú phạm vi
                        </label>
                        <textarea
                            rows={2}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Ví dụ: Dữ liệu dùng để test trang /tong-hop-thi-dua..."
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                        />
                    </div>

                    {/* Footer Actions */}
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
                            <Save className="w-4 h-4" />
                            <span>{editingGroup ? 'Cập nhật nhóm' : 'Tạo nhóm'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

