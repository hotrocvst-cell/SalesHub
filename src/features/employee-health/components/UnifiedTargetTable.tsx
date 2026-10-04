import { useMemo } from 'react';
import type { EmployeeItem, CampaignDictItem } from '../../../core/lib/storage';
import { getShortStoreName } from '../../../core/lib/formatters';
import { Coins, Trophy, Users } from 'lucide-react';

interface Props {
    employees: EmployeeItem[];
    campaigns: CampaignDictItem[];
    revenueTargets: Record<string, number>;
    campaignTargets: Record<string, Record<string, number>>;
    onRevenueChange: (empId: string, val: number) => void;
    onCampaignChange: (empId: string, rawKey: string, val: number) => void;
}

export default function UnifiedTargetTable({
    employees,
    campaigns,
    revenueTargets,
    campaignTargets,
    onRevenueChange,
    onCampaignChange
}: Props) {
    // Tính tổng cộng doanh thu và thi đua
    const totals = useMemo(() => {
        let totalRev = 0;
        const totalCamps: Record<string, number> = {};
        campaigns.forEach(c => { totalCamps[c.raw_key] = 0; });

        employees.forEach(emp => {
            const rev = revenueTargets[emp.employee_id] || 0;
            totalRev += rev;

            const cMap = campaignTargets[emp.employee_id] || {};
            campaigns.forEach(c => {
                totalCamps[c.raw_key] += (cMap[c.raw_key] || 0);
            });
        });

        return { totalRev, totalCamps };
    }, [employees, campaigns, revenueTargets, campaignTargets]);

    return (
        <div data-report-table="true" className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden font-avo">
            <div className="overflow-x-auto max-h-[680px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse font-avo report-table">
                    <thead className="sticky top-0 z-20 shadow-xs">
                        <tr className="bg-slate-900 text-white font-extrabold uppercase tracking-wider text-[11px]">
                            <th className="p-3 w-12 text-center border-r border-slate-800">STT</th>
                            <th className="p-3 w-24 border-r border-slate-800">Mã NV</th>
                            <th className="p-3 min-w-[180px] border-r border-slate-800">Họ và Tên</th>
                            <th className="p-3 min-w-[160px] border-r border-slate-800">Siêu Thị</th>
                            
                            {/* Cột Target Doanh Thu */}
                            <th className="p-3 min-w-[170px] bg-blue-900/90 text-right border-r border-blue-800">
                                <div className="flex items-center justify-end gap-1.5 text-blue-200">
                                    <Coins className="w-4 h-4 text-amber-300" />
                                    <span>Target Doanh Thu (VNĐ)</span>
                                </div>
                            </th>

                            {/* Các cột Target Thi Đua */}
                            {campaigns.map(c => (
                                <th key={c.raw_key} className="p-3 min-w-[140px] bg-amber-950/90 text-right border-r border-amber-900/60">
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-1 text-amber-200">
                                            <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                            <span className="truncate max-w-[130px]" title={c.display_name}>
                                                {c.display_name}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-amber-400/80 font-normal lowercase">
                                            ({c.unit || 'cái'}) [{c.raw_key}]
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                        {employees.length === 0 ? (
                            <tr>
                                <td colSpan={5 + campaigns.length} className="py-12 text-center text-slate-400 font-medium">
                                    Không có nhân viên nào phù hợp với bộ lọc hiện tại.
                                </td>
                            </tr>
                        ) : (
                            employees.map((emp, idx) => {
                                const rev = revenueTargets[emp.employee_id] ?? 0;
                                const campMap = campaignTargets[emp.employee_id] || {};

                                return (
                                    <tr key={emp.employee_id} className="hover:bg-slate-50/80 transition group">
                                        <td className="p-2.5 text-center font-mono text-slate-400 font-semibold border-r border-slate-100">
                                            {idx + 1}
                                        </td>
                                        <td className="p-2.5 font-mono font-bold text-blue-700 border-r border-slate-100">
                                            {emp.employee_id}
                                        </td>
                                        <td className="p-2.5 font-extrabold text-slate-800 border-r border-slate-100">
                                            <div className="flex items-center justify-between">
                                                <span>{emp.full_name}</span>
                                                <span className="text-[10px] text-slate-400 font-normal hidden xl:inline">
                                                    {emp.role || emp.job_title}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-2.5 text-slate-600 font-medium truncate max-w-[180px] border-r border-slate-100" title={emp.store_name}>
                                            {getShortStoreName(emp.store_name)}
                                        </td>

                                        {/* Input Target Doanh Thu */}
                                        <td className="p-1.5 text-right bg-blue-50/30 border-r border-slate-100">
                                            <input
                                                type="number"
                                                min={0}
                                                step={1000000}
                                                value={rev || ''}
                                                onChange={e => onRevenueChange(emp.employee_id, Number(e.target.value) || 0)}
                                                placeholder="0"
                                                className="w-full text-right font-mono font-extrabold text-blue-900 bg-white border border-slate-200 group-hover:border-blue-300 focus:border-blue-600 px-2 py-1.5 rounded-lg text-xs outline-hidden shadow-2xs focus:ring-2 focus:ring-blue-500/20"
                                            />
                                        </td>

                                        {/* Inputs Target Thi Đua */}
                                        {campaigns.map(c => {
                                            const val = campMap[c.raw_key] ?? 0;
                                            return (
                                                <td key={c.raw_key} className="p-1.5 text-right bg-amber-50/20 border-r border-slate-100">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step={1}
                                                        value={val || ''}
                                                        onChange={e => onCampaignChange(emp.employee_id, c.raw_key, Number(e.target.value) || 0)}
                                                        placeholder="0"
                                                        className="w-full text-right font-mono font-bold text-amber-950 bg-white border border-slate-200 group-hover:border-amber-300 focus:border-amber-600 px-2 py-1.5 rounded-lg text-xs outline-hidden shadow-2xs focus:ring-2 focus:ring-amber-500/20"
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>

                    {/* HÀNG TỔNG CỘNG FOOTER */}
                    {employees.length > 0 && (
                        <tfoot className="sticky bottom-0 z-10 bg-slate-900 text-white font-extrabold shadow-lg">
                            <tr>
                                <td colSpan={4} className="p-3 text-right uppercase tracking-wider text-xs border-r border-slate-800">
                                    <div className="flex items-center justify-end gap-1.5">
                                        <Users className="w-4 h-4 text-blue-400" />
                                        <span>Tổng Mục Tiêu ({employees.length} nhân sự):</span>
                                    </div>
                                </td>

                                {/* Tổng Doanh Thu */}
                                <td className="p-3 text-right font-mono text-sm text-amber-300 border-r border-blue-900 bg-blue-950">
                                    {totals.totalRev.toLocaleString('vi-VN')} đ
                                </td>

                                {/* Tổng Thi Đua */}
                                {campaigns.map(c => (
                                    <td key={c.raw_key} className="p-3 text-right font-mono text-xs text-amber-200 border-r border-amber-900/60 bg-amber-950">
                                        {(totals.totalCamps[c.raw_key] || 0).toLocaleString('vi-VN')}
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}
