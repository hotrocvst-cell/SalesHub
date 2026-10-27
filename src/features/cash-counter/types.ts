export interface DenominationItem {
    val: number;
    label: string;
    color: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
}

export const DENOMINATIONS: DenominationItem[] = [
    { val: 500000, label: '500.000 đ', color: 'cyan', bgClass: 'bg-cyan-50/80', textClass: 'text-cyan-800', borderClass: 'border-cyan-200' },
    { val: 200000, label: '200.000 đ', color: 'rose', bgClass: 'bg-rose-50/80', textClass: 'text-rose-800', borderClass: 'border-rose-200' },
    { val: 100000, label: '100.000 đ', color: 'emerald', bgClass: 'bg-emerald-50/80', textClass: 'text-emerald-800', borderClass: 'border-emerald-200' },
    { val: 50000, label: '50.000 đ', color: 'pink', bgClass: 'bg-pink-50/80', textClass: 'text-pink-800', borderClass: 'border-pink-200' },
    { val: 20000, label: '20.000 đ', color: 'blue', bgClass: 'bg-blue-50/80', textClass: 'text-blue-800', borderClass: 'border-blue-200' },
    { val: 10000, label: '10.000 đ', color: 'amber', bgClass: 'bg-amber-50/80', textClass: 'text-amber-800', borderClass: 'border-amber-200' },
    { val: 5000, label: '5.000 đ', color: 'indigo', bgClass: 'bg-indigo-50/80', textClass: 'text-indigo-800', borderClass: 'border-indigo-200' },
    { val: 2000, label: '2.000 đ', color: 'orange', bgClass: 'bg-orange-50/80', textClass: 'text-orange-800', borderClass: 'border-orange-200' },
    { val: 1000, label: '1.000 đ', color: 'purple', bgClass: 'bg-purple-50/80', textClass: 'text-purple-800', borderClass: 'border-purple-200' },
];

export interface CashAuditRecord {
    id: number | string;
    time: string;
    store_name?: string;
    user_code?: string;
    note: string;
    target: number;
    total: number;
    diff: number;
    details: Record<string | number, number>;
    created_at?: string;
}

export const CASH_HISTORY_LOCAL_KEY = 'cash_history_portal';

export const CASH_COUNT_TABLE_NAME = 'cash_count_records';

export const CASH_COUNT_SQL_DDL = `-- BẢNG LƯU TRỮ LỊCH SỬ KIỂM QUỸ CA TRỰC (CHUYÊN VIÊN SIÊU THỊ)
CREATE TABLE IF NOT EXISTS public.cash_count_records (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    store_name TEXT,
    user_code TEXT,
    note TEXT,
    target_cash NUMERIC NOT NULL DEFAULT 0,
    total_counted NUMERIC NOT NULL DEFAULT 0,
    difference NUMERIC NOT NULL DEFAULT 0,
    details JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Kích hoạt RLS bảo mật
ALTER TABLE public.cash_count_records ENABLE ROW LEVEL SECURITY;

-- Cho phép đọc / ghi dữ liệu kiểm quỹ
DROP POLICY IF EXISTS "Allow all cash_count_records" ON public.cash_count_records;
CREATE POLICY "Allow all cash_count_records" ON public.cash_count_records FOR ALL USING (true);
`;
