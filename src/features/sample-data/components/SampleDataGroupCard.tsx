import React from 'react';
import { Link } from 'react-router-dom';
import {
    ChevronDown,
    ChevronUp,
    Plus,
    Trash2,
    Edit3,
    Camera,
    Images,
    ExternalLink
} from 'lucide-react';
import type { SampleDataGroup, SampleDataItem, SampleImageAsset } from '../types';
import { OCR_CATEGORY_META, inferOcrToolCategory } from '../utils/ocrSamplePresets';
import SampleImageSlotCard from './SampleImageSlotCard';

interface SampleDataGroupCardProps {
    group: SampleDataGroup;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onUpdateGroup: (updatedGroup: SampleDataGroup) => void;
    onDeleteGroup: (groupKey: string) => void;
    onEditGroupInfo: (group: SampleDataGroup) => void;
    onOpenLightbox: (images: SampleImageAsset[], activeIndex: number, slotLabel: string) => void;
}

export default function SampleDataGroupCard({
    group,
    isExpanded,
    onToggleExpand,
    onUpdateGroup,
    onDeleteGroup,
    onEditGroupInfo,
    onOpenLightbox
}: SampleDataGroupCardProps) {
    const category = group.tool_category || inferOcrToolCategory(group.group_key, group.group_title);
    const meta = OCR_CATEGORY_META[category] || OCR_CATEGORY_META.other;
    const toolPath = group.tool_path || meta.defaultPath;

    const totalImages = group.items.reduce((acc, it) => acc + (it.images?.length || 0), 0);

    const handleItemChange = (updatedItem: SampleDataItem) => {
        const nextItems = group.items.map(it => (it.id === updatedItem.id ? updatedItem : it));
        onUpdateGroup({
            ...group,
            items: nextItems,
            updated_at: new Date().toISOString()
        });
    };

    const handleItemDelete = (itemId: string) => {
        if (confirm('Bạn có chắc muốn xóa ô ảnh mẫu này khỏi công cụ?')) {
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
            id: `slot-${Date.now()}`,
            label: `${group.items.length + 1}. Ô ảnh mẫu mới`,
            note: 'Chụp rõ các cột số liệu cần bóc tách OCR.',
            images: [],
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
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all">
            {/* Header công cụ OCR */}
            <div
                onClick={onToggleExpand}
                className="p-3.5 sm:p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-800/95 transition-colors"
                title={isExpanded ? 'Bấm để thu gọn nhóm ảnh mẫu' : 'Bấm để mở rộng nhóm ảnh mẫu'}
            >
                <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 border border-blue-400/30">
                        <Camera className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-black text-sm sm:text-base text-white truncate">
                                {group.group_title}
                            </h3>
                            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-slate-100 border border-white/15">
                                {meta.scopeBadge}
                            </span>
                            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-blue-500/25 text-blue-200 border border-blue-400/30">
                                {meta.targetBadge}
                            </span>
                            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 tabular-nums">
                                {group.items.length} ô mẫu • {totalImages} ảnh
                            </span>
                        </div>
                        {group.description && (
                            <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                                {group.description}
                            </p>
                        )}
                    </div>
                </div>

                {/* Các nút hành động */}
                <div
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 flex-wrap"
                >
                    {toolPath && (
                        <Link
                            to={toolPath}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition"
                            title={`Mở trang công cụ OCR (${toolPath})`}
                        >
                            <span>Mở OCR</span>
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </Link>
                    )}

                    <button
                        type="button"
                        onClick={handleAddItem}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition shadow-2xs"
                        title="Thêm ô ảnh mẫu mới vào công cụ OCR này"
                    >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Thêm ô ảnh</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onEditGroupInfo(group)}
                        aria-label={`Chỉnh sửa thông tin nhóm ${group.group_title}`}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition"
                        title="Chỉnh sửa tiêu đề và mô tả nhóm"
                    >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        onClick={() => onDeleteGroup(group.group_key)}
                        aria-label={`Xóa nhóm ${group.group_title}`}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 cursor-pointer transition"
                        title="Xóa toàn bộ nhóm công cụ OCR này"
                    >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        onClick={onToggleExpand}
                        aria-label={isExpanded ? 'Thu gọn nhóm' : 'Mở rộng nhóm'}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition"
                    >
                        {isExpanded ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
                    </button>
                </div>
            </div>

            {/* Danh sách các ô ảnh mẫu */}
            {isExpanded && (
                <div className="p-3.5 sm:p-4 space-y-3 bg-slate-50/70">
                    {group.items.length === 0 ? (
                        <div className="text-center py-6 px-4 bg-white rounded-xl border border-dashed border-slate-300">
                            <Images className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
                            <p className="text-xs font-semibold text-slate-600">
                                Công cụ này chưa có ô ảnh mẫu nào.
                            </p>
                            <button
                                type="button"
                                onClick={handleAddItem}
                                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer transition"
                            >
                                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Thêm ô ảnh mẫu đầu tiên</span>
                            </button>
                        </div>
                    ) : (
                        <>
                            {group.items.map((item, idx) => (
                                <SampleImageSlotCard
                                    key={item.id}
                                    item={item}
                                    index={idx}
                                    onChange={handleItemChange}
                                    onDelete={handleItemDelete}
                                    onOpenLightbox={onOpenLightbox}
                                />
                            ))}

                            <div className="pt-1 flex justify-center">
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs cursor-pointer transition"
                                >
                                    <Plus className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                                    <span>Thêm ô ảnh mẫu vào &ldquo;{group.group_title}&rdquo;</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </section>
    );
}
