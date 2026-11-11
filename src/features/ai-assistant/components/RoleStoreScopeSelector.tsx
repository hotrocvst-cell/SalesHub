import React from 'react';
import { Shield, Store } from 'lucide-react';
import { ROLE_SCOPE_OPTIONS } from '../types/aiAssistantTypes';
import type { StoreItem } from '../../../core/lib/storage';
import { formatStoreDisplayName } from '../../../core/lib/formatters';

interface Props {
    allowedRoles: string[];
    allowedStores: string[];
    availableStores: StoreItem[];
    onChangeRoles: (roles: string[]) => void;
    onChangeStores: (stores: string[]) => void;
}

export default function RoleStoreScopeSelector({
    allowedRoles,
    allowedStores,
    availableStores,
    onChangeRoles,
    onChangeStores
}: Props) {
    const handleRoleToggle = (roleVal: string) => {
        if (roleVal === 'ALL') {
            onChangeRoles(['ALL']);
            return;
        }
        const withoutAll = allowedRoles.filter((r) => r !== 'ALL');
        if (withoutAll.includes(roleVal)) {
            const next = withoutAll.filter((r) => r !== roleVal);
            onChangeRoles(next.length > 0 ? next : ['ALL']);
        } else {
            onChangeRoles([...withoutAll, roleVal]);
        }
    };

    const handleStoreScopeChange = (storeVal: string) => {
        if (storeVal === 'ALL') {
            onChangeStores(['ALL']);
            return;
        }
        const withoutAll = allowedStores.filter((s) => s !== 'ALL');
        if (withoutAll.includes(storeVal)) {
            const next = withoutAll.filter((s) => s !== storeVal);
            onChangeStores(next.length > 0 ? next : ['ALL']);
        } else {
            onChangeStores([...withoutAll, storeVal]);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-600 shrink-0" aria-hidden="true" />
                    <span>Phân quyền vai trò được tra cứu:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {ROLE_SCOPE_OPTIONS.map((opt) => {
                        const active = allowedRoles.includes(opt.value);
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                aria-pressed={active}
                                onClick={() => handleRoleToggle(opt.value)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                    active
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                {opt.shortLabel}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>Phạm vi ST áp dụng:</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    <button
                        type="button"
                        aria-pressed={allowedStores.includes('ALL')}
                        onClick={() => handleStoreScopeChange('ALL')}
                        className={`px-2 py-1 rounded-lg text-[10.5px] font-bold border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                            allowedStores.includes('ALL')
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                        Toàn bộ ST
                    </button>
                    {availableStores.map((st) => {
                        const active = allowedStores.includes(st.name);
                        return (
                            <button
                                key={st.id || st.code || st.name}
                                type="button"
                                aria-pressed={active}
                                onClick={() => handleStoreScopeChange(st.name)}
                                className={`px-2 py-1 rounded-lg text-[10.5px] font-bold border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                                    active
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                {formatStoreDisplayName(st.name)}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

