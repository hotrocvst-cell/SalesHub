import React from 'react';
import { Link } from 'react-router-dom';
import {
    CheckCircle2,
    AlertTriangle,
    Clock,
    ArrowRight,
    TrendingUp,
    Trophy,
    Users,
    Target,
    Database,
    Calendar
} from 'lucide-react';
import type { DataStreamStatus } from '../types';
import { formatDate, formatDateTime } from '../../../core/lib/formatters';

interface DataStreamCardProps {
    stream: DataStreamStatus;
}

export default function DataStreamCard({ stream }: DataStreamCardProps) {
    const isOk = stream.isOk;

    // Biểu tượng theo loại dữ liệu
    const getStreamIcon = () => {
        switch (stream.id) {
            case 'store_revenue':
                return <TrendingUp className={`w-5 h-5 ${isOk ? 'text-emerald-600' : 'text-amber-600'}`} />;
            case 'store_emulation':
                return <Trophy className={`w-5 h-5 ${isOk ? 'text-emerald-600' : 'text-amber-600'}`} />;
            case 'employee_revenue':
                return <Users className={`w-5 h-5 ${isOk ? 'text-emerald-600' : 'text-amber-600'}`} />;
            case 'employee_emulation':
                return <Trophy className={`w-5 h-5 ${isOk ? 'text-emerald-600' : 'text-amber-600'}`} />;
            case 'employee_targets':
                return <Target className={`w-5 h-5 ${isOk ? 'text-emerald-600' : 'text-amber-600'}`} />;
            case 'employee_work_hours':
                return <Clock className={`w-5 h-5 ${isOk ? 'text-emerald-600' : 'text-amber-600'}`} />;
            default:
                return <Database className={`w-5 h-5 ${isOk ? 'text-emerald-600' : 'text-amber-600'}`} />;
        }
    };

    return (
        <div
            className={`relative rounded-2xl p-4 transition-all duration-200 border-2 ${
                isOk
                    ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-50/70 via-white to-white shadow-xs hover:shadow-md hover:border-emerald-500'
                    : 'border-amber-300 bg-gradient-to-br from-amber-50/70 via-white to-white shadow-xs hover:shadow-md hover:border-amber-400'
            }`}
        >
            {/* Hàng 1: Biểu tượng, Tiêu đề và Khung Trạng thái */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                            isOk
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                        }`}
                    >
                        {getStreamIcon()}
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-extrabold text-sm text-slate-900 truncate leading-snug">
                            {stream.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                            {stream.description}
                        </p>
                    </div>
                </div>

                {/* Khung Định Dạng Trạng Thái (OK vs CẢNH BÁO TONE VỪA PHẢI) */}
                <div className="shrink-0">
                    {isOk ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white font-extrabold text-[11px] shadow-sm shadow-emerald-600/20">
                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>OK</span>
                        </div>
                    ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>{stream.statusText}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Hàng 2: Thông tin chi tiết các mốc phiên */}
            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                {/* Phiên mới nhất */}
                <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-200/70">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        Phiên mới nhất
                    </span>
                    <div className="flex items-center gap-1 font-extrabold text-slate-800">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                            {stream.latestDataDate
                                ? (stream.latestDataDate.startsWith('20')
                                    ? formatDate(stream.latestDataDate)
                                    : stream.latestDataDate)
                                : 'Chưa có dữ liệu'}
                        </span>
                    </div>
                    {isOk && stream.latestDataDate && stream.latestDataDate.startsWith('20') && (
                        <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                            ✓ Đúng phiên n-1
                        </span>
                    )}
                </div>

                {/* Độ phủ hoặc Cập nhật */}
                <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-200/70">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        {stream.category === 'store' ? 'Độ phủ siêu thị' : 'Thời gian ghi nhận'}
                    </span>
                    <div className="font-extrabold text-slate-800 truncate">
                        {stream.category === 'store' ? (
                            <span>
                                {stream.storeCoveredCount}/{stream.totalStoreCount} ST{' '}
                                <span className="text-slate-400 font-normal">({stream.coveragePercent}%)</span>
                            </span>
                        ) : stream.lastUpdatedAt ? (
                            <span>{formatDateTime(stream.lastUpdatedAt)}</span>
                        ) : (
                            <span>{stream.recordCount > 0 ? `${stream.recordCount} bản ghi` : '—'}</span>
                        )}
                    </div>
                    {stream.lastUpdatedBy && (
                        <span className="text-[10px] text-slate-400 block truncate mt-0.5 font-medium">
                            Bởi: {stream.lastUpdatedBy}
                        </span>
                    )}
                </div>
            </div>

            {/* Hàng 3: Cảnh báo & Nút hành động */}
            {!isOk && stream.warningMessage && (
                <div className="mt-2.5 p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-1.5 leading-relaxed">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span className="flex-1 font-medium">{stream.warningMessage}</span>
                </div>
            )}

            {/* Nút thao tác điều hướng nhanh */}
            <div className="mt-3 flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500 font-medium">
                    Kỳ vọng: <strong className="text-slate-800 font-bold">{formatDate(stream.expectedDate)}</strong>
                </span>

                <Link
                    to={stream.actionUrl}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                        isOk
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                            : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25'
                    }`}
                >
                    <span>{stream.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            </div>
        </div>
    );
}
