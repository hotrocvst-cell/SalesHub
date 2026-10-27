import { useState, useMemo, useEffect } from 'react';
import { type SystemPagePermission } from '../../../core/lib/permissions';
import {
    X,
    Check,
    Layers,
    Plus,
    BarChart3,
    HeartPulse,
    Database,
    Ticket,
    Settings,
    FolderKanban,
    CheckCircle2,
    Coins
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    page: SystemPagePermission | null;
    allPages: SystemPagePermission[];
    onSaveGroup: (path: string, newGroup: string, applyToAllInCurrentGroup?: boolean) => void;
}

const DEFAULT_STANDARD_GROUPS = [
    'BÁO CÁO KINH DOANH',
    'SỨC KHỎE NHÂN VIÊN',
    'DỮ LIỆU & PHIÊN LÀM VIỆC',
    'TIỆN ÍCH BÁN HÀNG',
    'HỖ TRỢ CVST',
    'HỆ THỐNG & CẤU HÌNH'
];

function getGroupIcon(groupTitle: string) {
    const upper = groupTitle.toUpperCase();
    if (upper.includes('BÁO CÁO') || upper.includes('KINH DOANH')) return BarChart3;
    if (upper.includes('SỨC KHỎE') || upper.includes('NHÂN VIÊN') || upper.includes('THI ĐUA')) return HeartPulse;
    if (upper.includes('DỮ LIỆU') || upper.includes('PHIÊN')) return Database;
    if (upper.includes('TIỆN ÍCH') || upper.includes('VOUCHER')) return Ticket;
    if (upper.includes('HỖ TRỢ') || upper.includes('CVST') || upper.includes('KIỂM QUỸ')) return Coins;
    if (upper.includes('HỆ THỐNG') || upper.includes('CẤU HÌNH')) return Settings;
    return FolderKanban;
}

export default function ChangeGroupModal({
    isOpen,
    onClose,
    page,
    allPages,
    onSaveGroup
}: Props) {
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [customGroupName, setCustomGroupName] = useState<string>('');
    const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
    const [applyToAll, setApplyToAll] = useState<boolean>(false);

    // Đồng bộ giá trị khi mở modal với trang cụ thể
    useEffect(() => {
        if (page) {
            setSelectedGroup(page.group_title || DEFAULT_STANDARD_GROUPS[0]);
            setCustomGroupName('');
            setIsCustomMode(false);
            setApplyToAll(false);
        }
    }, [page, isOpen]);

    // Tổng hợp tất cả các nhóm hiện có trong hệ thống
    const availableGroups = useMemo(() => {
        const set = new Set<string>(DEFAULT_STANDARD_GROUPS);
        allPages.forEach(p => {
            if (p.group_title && p.group_title.trim()) {
                set.add(p.group_title.trim());
            }
        });
        return Array.from(set);
    }, [allPages]);

    // Đếm số lượng trang trong từng nhóm
    const groupCountMap = useMemo(() => {
        const counts: Record<string, number> = {};
        allPages.forEach(p => {
            const g = p.group_title || '';
            counts[g] = (counts[g] || 0) + 1;
        });
        return counts;
    }, [allPages]);

    if (!isOpen || !page) return null;

    const currentGroup = page.group_title || '';
    const sameGroupCount = groupCountMap[currentGroup] || 1;

    const finalGroup = isCustomMode
        ? customGroupName.trim()
        : selectedGroup;

    const hasChanged = finalGroup !== currentGroup && finalGroup.length > 0;

    const handleSelectExisting = (grp: string) => {
        setSelectedGroup(grp);
        setIsCustomMode(false);
    };

    const handleCustomChange = (val: string) => {
        setCustomGroupName(val);
        setIsCustomMode(true);
    };

    const handleConfirm = () => {
        if (!finalGroup) return;
        onSaveGroup(page.path, finalGroup, applyToAll);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div
                className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Modal */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-black text-slate-800">
                                Thay Đổi Nhóm Chức Năng
                            </h2>
                            <p className="text-[11px] text-slate-500">
                                Di chuyển phân hệ sang nhóm khác hoặc tạo nhóm mới trên Sidebar
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

                {/* Nội dung chính cuộn dọc */}
                <div className="p-5 space-y-4 overflow-y-auto no-scrollbar flex-1 text-xs">
                    {/* Thẻ thông tin trang đang chọn */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Phân hệ đang cấu hình
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Hiện tại: {currentGroup}
                            </span>
                        </div>
                        <div className="font-extrabold text-slate-800 text-sm">
                            {page.page_name}
                        </div>
                        <div className="font-mono text-[11px] text-indigo-600">
                            {page.path}
                        </div>
                    </div>

                    {/* Danh sách các nhóm chức năng hiện có */}
                    <div className="space-y-2">
                        <label className="font-extrabold text-slate-700 block">
                            1. Chọn Nhóm Chức Năng Có Sẵn:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {availableGroups.map((grp) => {
                                const IconComponent = getGroupIcon(grp);
                                const isSelected = !isCustomMode && selectedGroup === grp;
                                const isCurrent = grp === currentGroup;
                                const count = groupCountMap[grp] || 0;

                                return (
                                    <button
                                        key={grp}
                                        type="button"
                                        onClick={() => handleSelectExisting(grp)}
                                        className={`p-3 rounded-2xl border text-left transition flex items-center justify-between gap-2.5 cursor-pointer ${
                                            isSelected
                                                ? 'bg-indigo-50/90 border-indigo-400 text-indigo-900 ring-2 ring-indigo-300 shadow-2xs'
                                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                                                isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                <IconComponent className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-extrabold text-xs truncate">
                                                    {grp}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    {count} phân hệ {isCurrent && '• (Đang ở nhóm này)'}
                                                </div>
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Hoặc tạo nhóm mới */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5 text-indigo-600" />
                            <span>2. Hoặc Nhập Tên Nhóm Mới Tùy Chỉnh:</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Ví dụ: BÁO CÁO BAN GIÁM ĐỐC, TIỆN ÍCH NỘI BỘ..."
                                value={customGroupName}
                                onChange={(e) => handleCustomChange(e.target.value)}
                                onFocus={() => setIsCustomMode(true)}
                                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold outline-none transition ${
                                    isCustomMode && customGroupName.trim()
                                        ? 'bg-indigo-50/60 border-indigo-400 text-indigo-900 ring-2 ring-indigo-200'
                                        : 'bg-slate-50 border-slate-200 text-slate-700 focus:bg-white focus:border-indigo-400'
                                }`}
                            />
                            {isCustomMode && customGroupName.trim() && (
                                <span className="absolute right-3 top-2.5 text-[10px] font-black text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">
                                    Nhóm Mới
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                            Nếu nhập nhóm mới, thanh điều hướng Sidebar sẽ tự động tạo một đề mục nhóm mới để gom phân hệ này vào.
                        </p>
                    </div>

                    {/* Tùy chọn áp dụng cho toàn bộ các trang cùng nhóm cũ */}
                    {sameGroupCount > 1 && (
                        <div className="pt-2 border-t border-slate-100">
                            <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50/60 border border-amber-200 text-amber-900 cursor-pointer hover:bg-amber-50 transition">
                                <input
                                    type="checkbox"
                                    checked={applyToAll}
                                    onChange={(e) => setApplyToAll(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                />
                                <div className="text-[11px]">
                                    <span className="font-black block text-amber-950">
                                        Đổi tên nhóm cho toàn bộ {sameGroupCount} trang cùng thuộc "{currentGroup}"
                                    </span>
                                    <span className="text-amber-800">
                                        Hữu ích khi bạn muốn đổi tên hoàn toàn nhóm chức năng này mà không cần sửa từng trang một.
                                    </span>
                                </div>
                            </label>
                        </div>
                    )}
                </div>

                {/* Footer Modal */}
                <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/80 transition cursor-pointer"
                    >
                        Hủy Bỏ
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!hasChanged}
                        className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md shadow-indigo-200 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                    >
                        <Check className="w-4 h-4" />
                        <span>Xác Nhận Đổi Nhóm</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
