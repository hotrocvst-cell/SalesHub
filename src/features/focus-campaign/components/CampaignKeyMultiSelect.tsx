import React, { useState, useMemo } from 'react';
import { ChevronDown, X, Check, Search } from 'lucide-react';
import type { CampaignDictItem } from '../../../core/lib/storage';

interface Props {
    selectedKeys: string[];
    onToggleKey: (key: string) => void;
    campaignDict: CampaignDictItem[];
    periodActiveCampaigns: CampaignDictItem[];
    currentMonth: number;
}

export default function CampaignKeyMultiSelect({
    selectedKeys,
    onToggleKey,
    campaignDict,
    periodActiveCampaigns,
    currentMonth
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [onlyPeriodActive, setOnlyPeriodActive] = useState(true);

    const displayedCampaigns = useMemo(() => {
        const baseList = (onlyPeriodActive && periodActiveCampaigns.length > 0)
            ? periodActiveCampaigns
            : campaignDict;

        if (!searchText.trim()) return baseList;
        const q = searchText.trim().toLowerCase();
        return baseList.filter(d =>
            d.display_name.toLowerCase().includes(q) ||
            d.raw_key.toLowerCase().includes(q)
        );
    }, [onlyPeriodActive, periodActiveCampaigns, campaignDict, searchText]);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full inline-flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
            >
                <span className="truncate">
                    Nhóm hàng ({selectedKeys.length} đã chọn)
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {isOpen && (
                <div className="absolute top-full mt-1 left-0 right-0 sm:right-auto sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-2.5 space-y-2 max-h-80 flex flex-col">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-[11px] font-black text-slate-500 uppercase">
                            Tùy chọn nhóm hàng thi đua
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Toggle lọc nhóm hàng theo kỳ (Yêu cầu 5) */}
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 cursor-pointer px-1">
                        <input
                            type="checkbox"
                            checked={onlyPeriodActive}
                            onChange={(e) => setOnlyPeriodActive(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-indigo-600"
                        />
                        <span>Chỉ hiện nhóm hàng trong kỳ T{currentMonth}</span>
                    </label>

                    {/* Ô TÌM KIẾM NHANH (YÊU CẦU 3) */}
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Tìm nhanh nhóm hàng..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            className="w-full pl-7 pr-2 py-1 bg-slate-50 border border-slate-200 text-xs rounded-lg outline-hidden focus:bg-white focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="overflow-y-auto space-y-1 flex-1 pr-1 max-h-48">
                        {displayedCampaigns.map((d) => {
                            const isChecked = selectedKeys.includes(d.raw_key);
                            return (
                                <button
                                    key={d.raw_key}
                                    type="button"
                                    onClick={() => onToggleKey(d.raw_key)}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition cursor-pointer ${
                                        isChecked ? 'bg-indigo-50 text-indigo-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                >
                                    <span className="truncate">{d.display_name}</span>
                                    {isChecked && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-2" />}
                                </button>
                            );
                        })}
                        {displayedCampaigns.length === 0 && (
                            <div className="py-3 text-center text-xs text-slate-400">
                                Không có nhóm hàng phù hợp.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
