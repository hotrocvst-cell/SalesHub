import React, { useState } from 'react';
import { Trophy, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, ChevronDown, Sparkles } from 'lucide-react';
import type { CampaignMappingItem, KnownStoreCampaignTarget } from '../services/campaignTargetMappingService';
import type { CampaignDictItem } from '../../../core/lib/storage';
import { formatValue } from '../../../core/lib/formatters';

interface Props {
    campaignMappings: CampaignMappingItem[];
    knownStoreCampaigns: KnownStoreCampaignTarget[];
    campaignDict: CampaignDictItem[];
    onRemapCampaign: (oldName: string, newName: string) => void;
    activeCampaignNames: string[];
}

export default function CampaignMappingReviewBar({
    campaignMappings,
    knownStoreCampaigns,
    campaignDict,
    onRemapCampaign,
    activeCampaignNames
}: Props) {
    const [editingCampaignName, setEditingCampaignName] = useState<string | null>(null);

    // Tập hợp danh sách các chương trình cần hiển thị
    const displayList = React.useMemo(() => {
        const map = new Map<string, Partial<CampaignMappingItem>>();

        // Nạp từ campaignMappings đã được OCR nhận diện
        campaignMappings.forEach(m => {
            map.set(m.resolvedName, m);
        });

        // Bổ sung các campaignName đang có trong phiên nhân viên nếu chưa có trong mappings
        activeCampaignNames.forEach(cName => {
            if (!map.has(cName)) {
                const known = knownStoreCampaigns.find(k => k.campaignName.toLowerCase() === cName.toLowerCase());
                map.set(cName, {
                    rawName: cName,
                    resolvedName: cName,
                    unit: known?.unit || 'DT',
                    storeActual: known?.actual || 0,
                    storeTarget: known?.target || 0,
                    isAutoMatched: false
                });
            }
        });

        return Array.from(map.values());
    }, [campaignMappings, activeCampaignNames, knownStoreCampaigns]);

    if (displayList.length === 0) return null;

    // Danh sách gợi ý tên chuẩn từ knownStoreCampaigns và campaignDict
    const candidateOptions = React.useMemo(() => {
        const set = new Set<string>();
        knownStoreCampaigns.forEach(k => {
            if (k.campaignName) set.add(k.campaignName.trim());
        });
        campaignDict.forEach(d => {
            if (d.raw_key) set.add(d.raw_key.trim());
            if (d.display_name) set.add(d.display_name.trim());
        });
        return Array.from(set).sort();
    }, [knownStoreCampaigns, campaignDict]);

    return (
        <div className="bg-gradient-to-r from-purple-50/90 via-indigo-50/70 to-blue-50/90 border border-purple-200 rounded-2xl p-3.5 sm:p-4 text-xs shadow-xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-200/60 pb-2">
                <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-xl bg-purple-600 text-white font-black shadow-xs shrink-0">
                        <Trophy className="w-4 h-4 text-amber-300" />
                    </span>
                    <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                                Rà Soát & Đối Chiếu Chỉ Tiêu Thi Đua
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.2 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                                {displayList.length} chương trình
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            AI tự động bóc tách cấu trúc ST &amp; mapping tên chính xác qua Target ST (giải quyết tên bị cắt ba chấm &quot;...&quot;)
                        </p>
                    </div>
                </div>
            </div>

            {/* DANH SÁCH CÁC CHƯƠNG TRÌNH ĐÃ NHẬN DIỆN & MAPPING */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                {displayList.map(item => {
                    const cName = item.resolvedName || item.rawName || '';
                    const isEditing = editingCampaignName === cName;
                    const isTruncatedRaw = item.rawName && (item.rawName.endsWith('...') || item.rawName.endsWith('…'));

                    return (
                        <div
                            key={cName}
                            className="bg-white border border-purple-100 rounded-xl p-2.5 shadow-2xs space-y-1.5 hover:border-purple-300 transition"
                        >
                            <div className="flex items-start justify-between gap-1.5">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1">
                                        <span className="font-extrabold text-slate-900 text-xs truncate block" title={cName}>
                                            {cName}
                                        </span>
                                        <span className={`text-[9px] font-black px-1 py-0.2 rounded shrink-0 ${
                                            item.unit === 'SL' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                        }`}>
                                            {item.unit || 'DT'}
                                        </span>
                                    </div>

                                    {/* Trạng thái mapping */}
                                    {item.isAutoMatched ? (
                                        <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold mt-0.5 flex-wrap">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                            <span>Khớp qua Target:</span>
                                            <span className="font-mono bg-emerald-50 px-1 rounded text-emerald-800 border border-emerald-200">
                                                {formatValue(item.storeTarget)} {item.unit || 'tr'}
                                            </span>
                                            {isTruncatedRaw && (
                                                <span className="text-slate-400 font-normal">
                                                    (Gốc: {item.rawName})
                                                </span>
                                            )}
                                        </div>
                                    ) : item.storeTarget ? (
                                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                                            <span>Target ST: <strong className="font-mono text-slate-700">{formatValue(item.storeTarget)}</strong></span>
                                            <span>• Thực hiện: <strong className="font-mono text-emerald-700">{formatValue(item.storeActual)}</strong></span>
                                        </div>
                                    ) : null}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setEditingCampaignName(isEditing ? null : cName)}
                                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition cursor-pointer shrink-0"
                                    title="Đổi tên chương trình này"
                                >
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isEditing ? 'rotate-180' : ''}`} />
                                </button>
                            </div>

                            {/* DROPDOWN CHỌN TÊN CHUẨN KHI MUỐN ĐỔI */}
                            {isEditing && (
                                <div className="pt-2 border-t border-slate-100 space-y-1 animate-in fade-in">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block">
                                        Chọn tên chuẩn từ danh mục:
                                    </label>
                                    <select
                                        defaultValue={cName}
                                        onChange={(e) => {
                                            const newName = e.target.value;
                                            if (newName && newName !== cName) {
                                                onRemapCampaign(cName, newName);
                                                setEditingCampaignName(null);
                                            }
                                        }}
                                        className="w-full bg-slate-50 border border-purple-200 rounded-lg p-1 text-xs text-slate-800 font-medium outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                                    >
                                        <option value={cName}>-- Giữ nguyên: {cName} --</option>
                                        {candidateOptions.map(opt => (
                                            <option key={opt} value={opt}>
                                                🎯 {opt}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

