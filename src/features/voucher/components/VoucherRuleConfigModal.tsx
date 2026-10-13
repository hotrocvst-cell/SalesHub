import React, { useState } from 'react';
import {
    X,
    Sliders,
    Zap,
    Clock,
    Sparkles,
    Calendar,
    Save,
    CheckCircle2
} from 'lucide-react';
import type { VoucherDistributionRule } from '../types';
import { saveVoucherDistributionConfig } from '../services/voucherService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentRule: VoucherDistributionRule;
    onSaved: (newRule: VoucherDistributionRule) => void;
    currentUserDisplayName?: string;
    showToast: (msg: string) => void;
}

export default function VoucherRuleConfigModal({
    isOpen,
    onClose,
    currentRule,
    onSaved,
    currentUserDisplayName = 'Quản lý',
    showToast
}: Props) {
    const [selectedRule, setSelectedRule] = useState<VoucherDistributionRule>(currentRule || 'FIFO');
    const [isSaving, setIsSaving] = useState<boolean>(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await saveVoucherDistributionConfig(selectedRule, currentUserDisplayName);
            if (res.success) {
                showToast(`✅ Đã lưu quy tắc cấp mã: [${selectedRule === 'FIFO' ? 'FIFO - Nhập trước cấp trước' : selectedRule === 'FEFO' ? 'FEFO - Hạn gần cấp trước' : 'LIFO'}]`);
                onSaved(selectedRule);
                onClose();
            } else {
                showToast(`❌ Không thể lưu cấu hình: ${res.error}`);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const rules = [
        {
            id: 'FIFO' as VoucherDistributionRule,
            title: 'FIFO (First In, First Out)',
            badge: '⚡ Khuyên Dùng',
            badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
            icon: Zap,
            iconColor: 'text-emerald-600',
            shortDesc: 'Vào trước, ra trước • Nhập trước, cấp trước',
            detailDesc: 'Hệ thống tự động ưu tiên cấp các mã voucher được nạp vào kho sớm nhất (ngày tạo cũ nhất). Ngăn ngừa tối đa tình trạng tồn đọng mã cũ trong kho.',
            example: 'Ví dụ: Mã nạp vào kho ngày 01/10 sẽ được tự động xuất cấp trước mã nạp ngày 10/10.'
        },
        {
            id: 'FEFO' as VoucherDistributionRule,
            title: 'FEFO (First Expired, First Out)',
            badge: '⏳ Tối Ưu Hạn Dùng',
            badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
            icon: Calendar,
            iconColor: 'text-amber-600',
            shortDesc: 'Hạn dùng gần nhất, cấp phát trước',
            detailDesc: 'Hệ thống ưu tiên cấp các mã có ngày hết hạn (expires_at) gần nhất trước để tránh lãng phí mã sắp hết hạn. Nếu cùng hạn dùng sẽ áp dụng FIFO.',
            example: 'Ví dụ: Mã hết hạn ngày 20/10 sẽ được cấp trước mã hết hạn ngày 31/10.'
        },
        {
            id: 'LIFO' as VoucherDistributionRule,
            title: 'LIFO (Last In, First Out)',
            badge: 'Mã Mới Nhất',
            badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
            icon: Clock,
            iconColor: 'text-slate-600',
            shortDesc: 'Mới nạp vào kho, cấp phát trước',
            detailDesc: 'Hệ thống cấp các mã voucher mới được nạp vào kho gần đây nhất.',
            example: 'Ví dụ: Mã vừa nạp hôm nay sẽ được cấp trước các mã đã nạp từ các tuần trước.'
        }
    ];

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden my-auto">
                {/* Header */}
                <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center">
                            <Sliders className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-black">Cài Đặt Quy Tắc Cấp Mã Voucher</h2>
                            <p className="text-[11px] text-slate-300">
                                Thứ tự ưu tiên xuất kho khi nhân viên bấm nhận mã
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-5 space-y-3.5">
                    <p className="text-xs text-slate-600">
                        Chọn quy tắc tự động lựa chọn mã voucher khi nhân viên siêu thị yêu cầu cấp mã trong kho:
                    </p>

                    <div className="space-y-2.5">
                        {rules.map(rule => {
                            const isSelected = selectedRule === rule.id;
                            const IconComponent = rule.icon;
                            return (
                                <div
                                    key={rule.id}
                                    onClick={() => setSelectedRule(rule.id)}
                                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                                        isSelected
                                            ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                                            : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <div
                                                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                                                    isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 ' + rule.iconColor
                                                }`}
                                            >
                                                <IconComponent className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-black text-slate-900">
                                                        {rule.title}
                                                    </span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rule.badgeColor}`}>
                                                        {rule.badge}
                                                    </span>
                                                </div>
                                                <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">
                                                    {rule.shortDesc}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="pt-0.5 shrink-0">
                                            <div
                                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                                                    isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'
                                                }`}
                                            >
                                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
                                        <p>{rule.detailDesc}</p>
                                        <p className="text-slate-500 italic bg-white/80 p-1.5 rounded-lg border border-slate-100">
                                            {rule.example}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 text-xs text-indigo-900 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Đồng bộ 100% Cloud-First:</span>
                        </div>
                        <p className="text-[11px] text-indigo-800 leading-relaxed">
                            Cấu hình sau khi lưu sẽ được cập nhật lên Supabase Cloud và áp dụng ngay lập tức cho toàn bộ điện thoại và máy tính của nhân viên khi thực hiện cấp mã.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-800 hover:bg-slate-200 text-xs font-bold transition cursor-pointer"
                    >
                        Hủy
                    </button>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-black transition cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        <span>{isSaving ? 'Đang lưu...' : 'Lưu Quy Tắc Cấp Mã'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
