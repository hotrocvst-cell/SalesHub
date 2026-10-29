import React, { useState } from 'react';
import { Database, Copy, Check, X } from 'lucide-react';
import { CAMPAIGN_OFFSETS_SQL } from '../services/campaignOffsetService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function CampaignOffsetSqlModal({ isOpen, onClose }: Props) {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(CAMPAIGN_OFFSETS_SQL);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                            <Database className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold tracking-tight">Mã Lệnh DDL Khởi Tạo Bảng Supabase</h3>
                            <p className="text-[11px] text-slate-400">Bảng: employee_campaign_offsets (Dành riêng cho Admin)</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* SQL Code Block */}
                <div className="p-4 bg-slate-950 overflow-y-auto font-mono text-xs text-emerald-400 flex-1 select-all whitespace-pre-wrap leading-relaxed">
                    {CAMPAIGN_OFFSETS_SQL}
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                    <span className="text-[11px] text-slate-500">
                        Sao chép và chạy 1 lần duy nhất trong Supabase SQL Editor
                    </span>
                    <button
                        onClick={handleCopy}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copied ? 'Đã sao chép!' : 'Sao Chép SQL'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

