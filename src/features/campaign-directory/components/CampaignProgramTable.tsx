import React from 'react';
import { Edit3, Trash2, Gift, FileText } from 'lucide-react';
import type { CampaignProgramItem } from '../types';

interface Props {
    items: CampaignProgramItem[];
    selectedIds: Set<string>;
    showOpportunity?: boolean;
    onToggleSelect: (id: string) => void;
    onToggleSelectAll: () => void;
    isAllSelected: boolean;
    onEdit: (item: CampaignProgramItem) => void;
    onDelete: (id: string, name: string) => void;
    canManage: boolean;
}

export default function CampaignProgramTable({
    items,
    selectedIds,
    showOpportunity = true,
    onToggleSelect,
    onToggleSelectAll,
    isAllSelected,
    onEdit,
    onDelete,
    canManage
}: Props) {
    if (items.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                <p className="font-bold text-sm text-slate-600">Không tìm thấy chương trình thi đua nào phù hợp.</p>
                <p className="text-xs text-slate-400 mt-1">Hãy thử đổi từ khóa tìm kiếm hoặc chọn nhóm thi đua khác.</p>
            </div>
        );
    }

    return (
        <div data-report-table="true" className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden font-avo">
            <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse font-avo report-table">
                    <thead className="bg-slate-900 text-white uppercase text-[10.5px] font-black tracking-wider sticky top-0 z-20 select-none">
                        <tr>
                            <th className="py-2.5 px-2 text-center w-10 border-r border-slate-800" data-export-ignore="true">
                                <input
                                    type="checkbox"
                                    checked={isAllSelected}
                                    onChange={onToggleSelectAll}
                                    className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                    title="Chọn tất cả"
                                />
                            </th>
                            <th className="py-2.5 px-2 text-center w-10 border-r border-slate-800">STT</th>
                            <th className="py-2.5 px-2 text-center w-24 border-r border-slate-800">Nhóm</th>
                            <th className="py-2.5 px-3 min-w-[160px] border-r border-slate-800">Chương trình thi đua</th>
                            <th className="py-2.5 px-2 text-center w-24 border-r border-slate-800">Định hướng</th>
                            <th className="py-2.5 px-2 text-center w-24 border-r border-slate-800">Cách tính</th>
                            <th className="py-2.5 px-3 min-w-[220px] border-r border-slate-800">Thể lệ & Điều kiện đạt</th>
                            <th className="py-2.5 px-2 text-center w-24 border-r border-slate-800">Trạng thái SP</th>
                            {showOpportunity && (
                                <th className="py-2.5 px-3 min-w-[200px] border-r border-slate-800">Cơ hội (CTKM)</th>
                            )}
                            {canManage && (
                                <th className="py-2.5 px-2 text-center w-20" data-export-ignore="true">Thao tác</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                        {items.map((item, idx) => {
                            const isChecked = selectedIds.has(item.id);
                            return (
                                <tr
                                    key={item.id}
                                    className={`transition hover:bg-slate-50/80 ${
                                        isChecked ? 'bg-blue-50/40' : ''
                                    }`}
                                >
                                    {/* Checkbox */}
                                    <td className="py-2.5 px-2 text-center border-r border-slate-100" data-export-ignore="true">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => onToggleSelect(item.id)}
                                            className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                        />
                                    </td>

                                    {/* STT */}
                                    <td className="py-2.5 px-2 text-center font-mono text-slate-400 font-bold border-r border-slate-100">
                                        {idx + 1}
                                    </td>

                                    {/* Nhóm */}
                                    <td className="py-2.5 px-2 text-center border-r border-slate-100 whitespace-nowrap">
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                                            {item.group_name}
                                        </span>
                                    </td>

                                    {/* Chương trình thi đua */}
                                    <td className="py-2.5 px-3 font-extrabold text-slate-900 border-r border-slate-100">
                                        <div className="space-y-0.5">
                                            <div className="text-xs leading-snug">{item.program_name}</div>
                                            {item.target_period && (
                                                <div className="text-[10px] text-slate-400 font-normal">
                                                    Kỳ: {item.target_period}
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    {/* Định hướng */}
                                    <td className="py-2.5 px-2 text-center border-r border-slate-100 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold border ${
                                            item.orientation === 'Chính'
                                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                                : item.orientation === 'Bán kèm'
                                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                                : 'bg-amber-50 text-amber-800 border-amber-200'
                                        }`}>
                                            {item.orientation}
                                        </span>
                                    </td>

                                    {/* Cách tính */}
                                    <td className="py-2.5 px-2 text-center border-r border-slate-100 whitespace-nowrap">
                                        <span className="px-2 py-0.5 rounded-md text-[10.5px] font-black font-mono bg-blue-50 text-blue-900 border border-blue-200">
                                            {item.calculation_method}
                                        </span>
                                    </td>

                                    {/* Thể lệ */}
                                    <td className="py-2.5 px-3 text-slate-700 text-xs border-r border-slate-100">
                                        <p className="line-clamp-3 leading-relaxed whitespace-pre-line" title={item.rules}>
                                            {item.rules}
                                        </p>
                                    </td>

                                    {/* Trạng thái sản phẩm */}
                                    <td className="py-2.5 px-2 text-center border-r border-slate-100 whitespace-nowrap">
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200">
                                            {item.product_status}
                                        </span>
                                    </td>

                                    {/* Cơ hội (CTKM) */}
                                    {showOpportunity && (
                                        <td className="py-2.5 px-3 border-r border-slate-100">
                                            {item.opportunity ? (
                                                <p className="text-amber-950 font-semibold text-xs line-clamp-3 leading-relaxed" title={item.opportunity}>
                                                    {item.opportunity}
                                                </p>
                                            ) : (
                                                <span className="text-slate-300 italic text-[11px]">—</span>
                                            )}
                                        </td>
                                    )}

                                    {/* Thao tác */}
                                    {canManage && (
                                        <td className="py-2.5 px-2 text-center whitespace-nowrap" data-export-ignore="true">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => onEdit(item)}
                                                    className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                                    title="Sửa"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onDelete(item.id, item.program_name)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                                    title="Xóa"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
