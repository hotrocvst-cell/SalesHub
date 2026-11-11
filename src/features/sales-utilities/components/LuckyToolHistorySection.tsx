import React from 'react';
import { History, Clock } from 'lucide-react';
import type { LuckyToolLogRecord } from '../types';

interface Props {
    logs: LuckyToolLogRecord[];
    storeDisplayLabel: string;
}

export default function LuckyToolHistorySection({ logs, storeDisplayLabel }: Props) {
    return (
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <History className="w-4 h-4 text-[#0066ab]" aria-hidden="true" />
                    <span>Lịch Sử Quay Gần Đây ({logs.length})</span>
                </h2>
                <span className="text-[11px] font-semibold text-slate-600">ST: {storeDisplayLabel}</span>
            </div>

            {logs.length === 0 ? (
                <p className="text-xs text-slate-600 py-3 text-center">
                    Chưa có lượt quay số hoặc bốc thăm nào được ghi nhận tại ST này.
                </p>
            ) : (
                <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {logs.map((item, idx) => (
                        <li key={item.id || idx} className="py-2 flex items-start justify-between gap-2 text-xs">
                            <div className="min-w-0">
                                <p className="font-bold text-slate-900 break-words">{item.result_summary}</p>
                                <span className="text-[11px] text-slate-600">{item.created_by || 'Nhân sự ST'}</span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-600 tabular-nums shrink-0 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" aria-hidden="true" />
                                {new Date(item.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

