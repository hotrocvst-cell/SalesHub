import React, { useState } from 'react';
import { X, Copy, Check, Database, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { CAMPAIGN_PROGRAM_DDL_SQL } from '../services/campaignProgramService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    isCloudReady: boolean;
    cloudSource: 'cloud' | 'local';
    onRecheck: () => void;
    isChecking: boolean;
}

export default function CampaignProgramSqlModal({
    isOpen,
    onClose,
    isCloudReady,
    cloudSource,
    onRecheck,
    isChecking
}: Props) {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopySql = async () => {
        try {
            await navigator.clipboard.writeText(CAMPAIGN_PROGRAM_DDL_SQL);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch (e) {
            console.error('Lỗi sao chép SQL:', e);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto font-avo animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs ${
                            isCloudReady ? 'bg-emerald-600' : 'bg-amber-500'
                        }`}>
                            <Database className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900">
                                Trạng Thái Kết Nối & Mã SQL Supabase
                            </h3>
                            <p className="text-[11px] text-slate-400">
                                Khởi tạo bảng campaign_programs trên Supabase PostgreSQL Cloud
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
                    {/* Banner trạng thái */}
                    {isCloudReady ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 text-emerald-950">
                            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                                <div className="font-black text-sm text-emerald-900">
                                    Đã Kết Nối Supabase Cloud Thành Công!
                                </div>
                                <p className="text-emerald-800 leading-relaxed font-medium">
                                    Bảng <code>campaign_programs</code> đã sẵn sàng trên Cloud. Mọi thao tác thêm, sửa, xóa chương trình thi đua đều được lưu trữ đồng bộ thời gian thực đa thiết bị.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 text-amber-950">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <div className="font-black text-sm text-amber-900">
                                    Chưa Tìm Thấy Bảng Trên Supabase Cloud (Đang Dùng LocalStorage Cache)
                                </div>
                                <p className="text-amber-800 leading-relaxed font-medium">
                                    Hệ thống hiện đang lưu tạm trên bộ nhớ trình duyệt máy bạn. Để dữ liệu được chia sẻ cho toàn bộ quản lý và nhân viên trên điện thoại, Quản trị viên vui lòng sao chép đoạn mã SQL bên dưới và dán chạy 1 lần duy nhất trong <strong>Supabase SQL Editor</strong>.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Mã SQL DDL */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                                Mã SQL DDL Khởi Tạo Bảng & Bảo Mật RLS:
                            </span>
                            <button
                                type="button"
                                onClick={handleCopySql}
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                                    copied
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                            >
                                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copied ? 'Đã sao chép SQL!' : 'Sao chép mã SQL'}</span>
                            </button>
                        </div>

                        <pre className="p-3 bg-slate-900 text-slate-100 rounded-2xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-56 select-all border border-slate-800">
                            {CAMPAIGN_PROGRAM_DDL_SQL}
                        </pre>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onRecheck}
                            disabled={isChecking}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                            <span>{isChecking ? 'Đang kiểm tra...' : 'Kiểm tra lại kết nối'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
