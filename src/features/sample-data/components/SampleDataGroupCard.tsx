import React from 'react';
import {
    ChevronDown,
    ChevronUp,
    Plus,
    Trash2,
    Edit3,
    Layers,
    FolderKanban
} from 'lucide-react';
import type { SampleDataGroup, SampleDataItem } from '../types';
import SampleDataItemInput from './SampleDataItemInput';

interface SampleDataGroupCardProps {
    group: SampleDataGroup;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onUpdateGroup: (updatedGroup: SampleDataGroup) => void;
    onDeleteGroup: (groupKey: string) => void;
    onEditGroupInfo: (group: SampleDataGroup) => void;
}

export default function SampleDataGroupCard({
    group,
    isExpanded,
    onToggleExpand,
    onUpdateGroup,
    onDeleteGroup,
    onEditGroupInfo
}: SampleDataGroupCardProps) {
    const handleItemChange = (updatedItem: SampleDataItem) => {
        const nextItems = group.items.map(it => it.id === updatedItem.id ? updatedItem : it);
        onUpdateGroup({
            ...group,
            items: nextItems,
            updated_at: new Date().toISOString()
        });
    };

    const handleItemDelete = (itemId: string) => {
        if (confirm('Bạn có chắc muốn xóa ô dữ liệu này khỏi nhóm?')) {
            const nextItems = group.items.filter(it => it.id !== itemId);
            onUpdateGroup({
                ...group,
                items: nextItems,
                updated_at: new Date().toISOString()
            });
        }
    };

    const handleAddItem = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newItem: SampleDataItem = {
            id: 'item-' + Date.now(),
            label: `Dữ liệu mới #${group.items.length + 1}`,
            sample_text: '',
            note: '',
            updated_at: new Date().toISOString()
        };
        onUpdateGroup({
            ...group,
            items: [...group.items, newItem],
            updated_at: new Date().toISOString()
        });
        if (!isExpanded) onToggleExpand();
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all">
            {/* Header của Nhóm - Bấm vào header để mở rộng/thu gọn */}
            <div
                onClick={onToggleExpand}
                className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-800/90 transition-colors"
                title={isExpanded ? 'Bấm để thu gọn nhóm' : 'Bấm để mở rộng nhóm'}
            >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 border border-blue-400/30">
                        <FolderKanban className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-black text-sm sm:text-base text-white truncate">
                                {group.group_title}
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                                {group.items.length} ô dữ liệu
                            </span>
                        </div>
                        {group.description && (
                            <p className="text-xs text-slate-300 mt-0.5 truncate">
                                {group.description}
                            </p>
                        )}
                    </div>
                </div>

                {/* Các nút hành động trên Header Nhóm */}
                <div
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1.5 self-end sm:self-auto shrink-0"
                >
                    <button
                        type="button"
                        onClick={handleAddItem}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition shadow-2xs"
                        title="Thêm một ô dữ liệu mẫu mới vào nhóm này"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm ô</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onEditGroupInfo(group)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition"
                        title="Chỉnh sửa tiêu đề và mô tả nhóm"
                    >
                        <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                        type="button"
                        onClick={() => onDeleteGroup(group.group_key)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 cursor-pointer transition"
                        title="Xóa toàn bộ nhóm dữ liệu này"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                        type="button"
                        onClick={onToggleExpand}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition"
                        title={isExpanded ? 'Thu gọn nhóm' : 'Mở rộng nhóm'}
                    >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Nội dung danh sách các ô nhập liệu */}
            {isExpanded && (
                <div className="p-3.5 sm:p-4 space-y-3 bg-slate-100/50">
                    {group.items.length === 0 ? (
                        <div className="text-center py-6 px-4 bg-white rounded-xl border border-dashed border-slate-300">
                            <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs font-semibold text-slate-500">
                                Nhóm này chưa có ô dữ liệu nào.
                            </p>
                            <button
                                type="button"
                                onClick={handleAddItem}
                                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer transition"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Thêm ô dữ liệu đầu tiên</span>
                            </button>
                        </div>
                    ) : (
                        <>
                            {group.items.map((item, idx) => (
                                <SampleDataItemInput
                                    key={item.id}
                                    item={item}
                                    index={idx}
                                    onChange={handleItemChange}
                                    onDelete={handleItemDelete}
                                />
                            ))}

                            <div className="pt-1 flex justify-center">
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs cursor-pointer transition"
                                >
                                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Thêm ô dữ liệu vào nhóm "{group.group_title}"</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
