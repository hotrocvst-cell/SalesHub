import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Users, Shuffle, Copy, Check, Save, AlertCircle } from 'lucide-react';
import type { EmployeeItem } from '../../../core/lib/storage';
import { getShortenedEmployeeName } from '../../../core/lib/formatters';
import type { TeamSplitterConfig } from '../types';
import {
    parseLinesList,
    splitIntoBalancedTeams,
    playFeedbackTone,
    createSpinTicker,
    unlockSoundEngine
} from '../utils/randomUtils';
import { triggerConfettiBurst } from '../utils/confettiBurst';

interface Props {
    config: TeamSplitterConfig;
    storeEmployees: EmployeeItem[];
    storeLabel: string;
    soundEnabled: boolean;
    onChangeConfig: (next: TeamSplitterConfig) => void;
    onSaveConfig: (next: TeamSplitterConfig) => void;
    onRecordResult: (summary: string, payload: Record<string, unknown>) => void;
}

const TEAM_CARD_STYLES = [
    'bg-sky-50/70 border-sky-200 text-sky-950',
    'bg-emerald-50/70 border-emerald-200 text-emerald-950',
    'bg-amber-50/70 border-amber-200 text-amber-950',
    'bg-rose-50/70 border-rose-200 text-rose-950',
    'bg-teal-50/70 border-teal-200 text-teal-950',
    'bg-slate-50 border-slate-300 text-slate-900'
];

export default function TeamSplitterTool({
    config,
    storeEmployees,
    storeLabel,
    soundEnabled,
    onChangeConfig,
    onSaveConfig,
    onRecordResult
}: Props) {
    const [teams, setTeams] = useState<string[][]>([]);
    const [isSplitting, setIsSplitting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const intervalRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);

    const clearTimers = () => {
        if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    useEffect(() => {
        return clearTimers;
    }, []);

    const members = useMemo(() => parseLinesList(config.rawMembersText), [config.rawMembersText]);

    const handleLoadStoreEmployees = () => {
        if (storeEmployees.length === 0) {
            setErrorMsg(`ST ${storeLabel} chưa có nhân sự nào trong danh bạ.`);
            return;
        }
        setErrorMsg('');
        const lines = storeEmployees.map(e => getShortenedEmployeeName(e.full_name || e.employee_id));
        const next: TeamSplitterConfig = { ...config, rawMembersText: lines.join('\n') };
        onChangeConfig(next);
        onSaveConfig(next);
    };

    const handleSplit = () => {
        if (isSplitting) return;
        setErrorMsg('');
        setCopied(false);

        if (members.length < 2) {
            setErrorMsg('Cần nhập ít nhất 2 thành viên (mỗi dòng 1 người) để chia đội.');
            return;
        }
        if (config.teamCount < 2 || config.teamCount > 20) {
            setErrorMsg('Số đội cần chia phải từ 2 đến 20.');
            return;
        }
        if (config.teamCount > members.length) {
            setErrorMsg(`Số đội (${config.teamCount}) không thể lớn hơn số thành viên (${members.length}).`);
            return;
        }

        if (soundEnabled) unlockSoundEngine();
        clearTimers();
        setIsSplitting(true);

        const ticker = soundEnabled ? createSpinTicker('slot', 85) : null;
        ticker?.tick();

        intervalRef.current = window.setInterval(() => {
            setTeams(splitIntoBalancedTeams(members, config.teamCount));
            ticker?.tick();
        }, 95);

        timeoutRef.current = window.setTimeout(() => {
            clearTimers();
            const resultTeams = splitIntoBalancedTeams(members, config.teamCount);
            setTeams(resultTeams);
            setIsSplitting(false);
            if (soundEnabled) playFeedbackTone('win');
            triggerConfettiBurst({ originY: 0.48, particleCount: 65 });
            onSaveConfig(config);

            const prefix = config.teamPrefix.trim() || 'Đội';
            const summaryStr = resultTeams
                .map((t, idx) => `${prefix} ${idx + 1} (${t.length} người): ${t.join(', ')}`)
                .join(' | ');
            onRecordResult(`Chia ${members.length} thành viên thành ${resultTeams.length} đội`, {
                teamCount: resultTeams.length,
                totalMembers: members.length,
                detail: summaryStr
            });
        }, 620);
    };

    const handleCopyTeams = () => {
        if (teams.length === 0) return;
        const prefix = config.teamPrefix.trim() || 'Đội';
        const text = teams
            .map((t, idx) => `${prefix} ${idx + 1} (${t.length}):\n${t.map((m, mIdx) => `  ${mIdx + 1}. ${m}`).join('\n')}`)
            .join('\n\n');
        navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                        <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                            Chia Đội Ngẫu Nhiên
                        </h2>
                        <p className="text-xs text-slate-600 tabular-nums">
                            Tổng thành viên: <strong className="text-[#0066ab]">{members.length}</strong> • Chia đều tự động
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {storeEmployees.length > 0 && (
                            <button
                                type="button"
                                onClick={handleLoadStoreEmployees}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-sky-50 hover:bg-sky-100 text-[#0066ab] border border-sky-200 inline-flex items-center gap-1 transition cursor-pointer"
                            >
                                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Nạp NV {storeLabel} ({storeEmployees.length})</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => onSaveConfig(config)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 transition cursor-pointer"
                        >
                            <Save className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Lưu danh sách</span>
                        </button>
                    </div>
                </div>

                <div>
                    <label htmlFor="ts-members" className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Danh sách thành viên (mỗi dòng 1 người)
                    </label>
                    <textarea
                        id="ts-members"
                        rows={6}
                        value={config.rawMembersText}
                        onChange={e => onChangeConfig({ ...config, rawMembersText: e.target.value })}
                        placeholder="Nhập hoặc dán tên từng thành viên trên mỗi dòng..."
                        className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-500 outline-none focus:bg-white focus:ring-2 focus:ring-[#0066ab]"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="ts-count" className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Số đội muốn chia
                        </label>
                        <input
                            id="ts-count"
                            type="number"
                            min={2}
                            max={20}
                            value={config.teamCount}
                            onChange={e => onChangeConfig({ ...config, teamCount: Math.max(2, Math.min(20, parseInt(e.target.value || '2', 10))) })}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 tabular-nums outline-none focus:bg-white focus:ring-2 focus:ring-[#0066ab]"
                        />
                    </div>
                    <div>
                        <label htmlFor="ts-prefix" className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Tên gọi đội
                        </label>
                        <input
                            id="ts-prefix"
                            type="text"
                            value={config.teamPrefix}
                            onChange={e => onChangeConfig({ ...config, teamPrefix: e.target.value })}
                            placeholder="Đội"
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 placeholder-slate-500 outline-none focus:bg-white focus:ring-2 focus:ring-[#0066ab]"
                        />
                    </div>
                </div>

                {errorMsg && (
                    <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={handleSplit}
                        disabled={isSplitting}
                        className="flex-1 min-w-[180px] py-3 px-4 bg-gradient-to-r from-[#0066ab] to-[#0369a1] hover:from-[#005591] hover:to-[#0284c7] disabled:opacity-60 text-white rounded-xl text-sm font-black inline-flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-[0.99]"
                    >
                        <Shuffle className="w-4 h-4" aria-hidden="true" />
                        <span>{isSplitting ? 'Đang xáo trộn...' : 'CHIA ĐỘI NGẪU NHIÊN'}</span>
                    </button>

                    {teams.length > 0 && !isSplitting && (
                        <button
                            type="button"
                            onClick={handleCopyTeams}
                            className="px-4 py-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 inline-flex items-center gap-1.5 transition cursor-pointer"
                        >
                            {copied ? <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                            <span>{copied ? 'Đã sao chép' : 'Sao chép kết quả'}</span>
                        </button>
                    )}
                </div>
            </div>

            {teams.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {teams.map((membersInTeam, idx) => {
                        const prefix = config.teamPrefix.trim() || 'Đội';
                        const cardStyle = TEAM_CARD_STYLES[idx % TEAM_CARD_STYLES.length];
                        return (
                            <div
                                key={`${idx}-${isSplitting ? 'mix' : 'done'}`}
                                className={`rounded-2xl border p-4 shadow-xs space-y-2.5 ${cardStyle} ${isSplitting ? 'opacity-80' : 'vt-pop'}`}
                            >
                                <div className="flex items-center justify-between border-b border-current/15 pb-2">
                                    <h3 className="text-sm font-black">
                                        {prefix} {idx + 1}
                                    </h3>
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/85 text-slate-900 border border-slate-200 tabular-nums">
                                        {membersInTeam.length} người
                                    </span>
                                </div>
                                <ol className="space-y-1 text-xs font-bold">
                                    {membersInTeam.map((m, mIdx) => (
                                        <li key={`${m}-${mIdx}`} className="flex items-center gap-2">
                                            <span className="w-5 text-[11px] font-mono text-slate-600 tabular-nums shrink-0">
                                                {mIdx + 1}.
                                            </span>
                                            <span className="text-slate-900 break-words">{m}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
