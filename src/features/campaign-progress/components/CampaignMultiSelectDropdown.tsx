import { useState, useRef, useEffect } from 'react';
import { Filter, Check, Square, CheckSquare, Search, X } from 'lucide-react';
import type { CampaignProgressItem } from '../types';

interface Props {
    allCampaigns: CampaignProgressItem[];
    selectedKeys: string[];
    onToggle: (key: string) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
}

export default function CampaignMultiSelectDropdown({
    allCampaigns,
    selectedKeys,
    onToggle,
    onSelectAll,
    onDeselectAll
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Đóng dropdown khi click ra ngoài
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const filteredList = allCampaigns.filter(c =>
        c.displayName.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        c.campaignKey.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );

    const isAllSelected = allCampaigns.length > 0 && selectedKeys.length === allCampaigns.length;
    const isNoneSelected = selectedKeys.length === 0;

    return (
        <div className="relative inline-block text-left font-avo" ref={dropdownRef}>
            {/* Nút Trigger Dropdown */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all shadow-2xs ${
                    isOpen
                        ? 'bg-blue-50 border-blue-400 text-blue-700 ring-2 ring-blue-500/20'
                        : selectedKeys.length < allCampaigns.length
                        ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100/70'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
            >
                <Filter className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Chương trình thi đua:</span>
                <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                    selectedKeys.length < allCampaigns.length
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-blue-100 text-blue-800'
                }`}>
                    {selectedKeys.length}/{allCampaigns.length}
                </span>
            </button>

            {/* Menu Dropdown */}
            {isOpen && (
                <div className="absolute left-0 mt-1.5 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    {/* Header Tìm kiếm & Tác vụ nhanh */}
                    <div className="p-2.5 border-b border-slate-100 bg-slate-50/70 space-y-2">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm nhanh chương trình..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-7 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                                autoFocus
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-0.5">
                            <button
                                type="button"
                                onClick={onSelectAll}
                                disabled={isAllSelected}
                                className="text-blue-600 hover:text-blue-800 font-semibold disabled:text-slate-400 disabled:cursor-not-allowed"
                            >
                                Chọn tất cả ({allCampaigns.length})
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                                type="button"
                                onClick={onDeselectAll}
                                disabled={isNoneSelected}
                                className="text-rose-600 hover:text-rose-800 font-semibold disabled:text-slate-400 disabled:cursor-not-allowed"
                            >
                                Bỏ chọn tất cả
                            </button>
                        </div>
                    </div>

                    {/* Danh sách Checkbox */}
                    <div className="max-h-60 overflow-y-auto p-1.5 divide-y divide-slate-50">
                        {filteredList.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">
                                Không tìm thấy chương trình phù hợp
                            </div>
                        ) : (
                            filteredList.map((camp) => {
                                const isChecked = selectedKeys.includes(camp.campaignKey);
                                return (
                                    <label
                                        key={camp.campaignKey}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            onToggle(camp.campaignKey);
                                        }}
                                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                                            isChecked
                                                ? 'bg-blue-50/60 text-slate-900 font-medium'
                                                : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0 pr-2">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                readOnly
                                                className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer pointer-events-none"
                                            />
                                            <span className="truncate">{camp.displayName}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                                            <span className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                                                camp.forecastRate >= 100
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-rose-100 text-rose-800'
                                            }`}>
                                                {camp.forecastRate}%
                                            </span>
                                        </div>
                                    </label>
                                );
                            })
                        )}
                    </div>

                    {/* Footer tóm tắt */}
                    <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
                        <span>Đang hiển thị {filteredList.length} mục</span>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-semibold hover:bg-blue-700"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
