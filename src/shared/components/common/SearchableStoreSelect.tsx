import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Store, Search, X, Check, ChevronDown } from 'lucide-react';
import type { StoreItem } from '../../../core/lib/storage';

interface Props {
    stores: StoreItem[];
    value: string;
    onChange: (storeName: string) => void;
    placeholder?: string;
    disabled?: boolean;
    error?: string;
}

/**
 * Hiển thị nhãn siêu thị kèm mã siêu thị ở đầu để dễ tra cứu
 * Ví dụ: "[10335] AAR_BRV_VTA - 290 Trương Công Định"
 */
export function formatStoreWithCode(store: StoreItem | { name: string; code?: string }): string {
    if (!store) return '';
    const code = store.code?.trim();
    const name = store.name?.trim();
    if (code) {
        // Nếu tên đã bắt đầu bằng mã thì không lặp lại
        if (name.startsWith(code)) {
            return name;
        }
        return `[${code}] ${name}`;
    }
    return name;
}

export default function SearchableStoreSelect({
    stores,
    value,
    onChange,
    placeholder = '-- Nhập tìm kiếm hoặc chọn siêu thị công tác --',
    disabled = false,
    error
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Tìm đối tượng siêu thị đang được chọn
    const selectedStore = useMemo(() => {
        if (!value) return null;
        return stores.find(s => s.name === value || s.code === value) || null;
    }, [stores, value]);

    // Lọc danh sách siêu thị theo từ khóa tìm kiếm (theo mã hoặc tên)
    const filteredStores = useMemo(() => {
        const cleanTerm = searchTerm.trim().toLowerCase();
        if (!cleanTerm) return stores;
        return stores.filter(s => {
            const name = (s.name || '').toLowerCase();
            const code = (s.code || '').toLowerCase();
            const address = (s.address || '').toLowerCase();
            return name.includes(cleanTerm) || code.includes(cleanTerm) || address.includes(cleanTerm);
        });
    }, [stores, searchTerm]);

    // Đóng dropdown khi click bên ngoài
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus vào input tìm kiếm khi mở dropdown
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (storeName: string) => {
        onChange(storeName);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearchTerm('');
    };

    return (
        <div ref={wrapperRef} className="relative w-full text-xs">
            {/* Box hiển thị giá trị hiện tại */}
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 transition cursor-pointer select-none ${
                    disabled
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        : error
                        ? 'bg-rose-50/50 border-rose-300 text-rose-900 focus:ring-2 focus:ring-rose-400'
                        : isOpen
                        ? 'bg-white border-blue-500 ring-2 ring-blue-400/20 shadow-xs'
                        : 'bg-slate-50 hover:bg-white border-slate-200 hover:border-slate-300'
                }`}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Store className={`w-4 h-4 shrink-0 ${value ? 'text-blue-600' : 'text-slate-400'}`} />
                    {selectedStore ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                            {selectedStore.code && (
                                <span className="font-mono font-black text-[11px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded shrink-0">
                                    {selectedStore.code}
                                </span>
                            )}
                            <span className="font-bold text-slate-900 truncate">
                                {selectedStore.name}
                            </span>
                        </div>
                    ) : value ? (
                        <span className="font-bold text-slate-900 truncate">{value}</span>
                    ) : (
                        <span className="text-slate-400 font-medium truncate">{placeholder}</span>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {value && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 hover:bg-slate-200/70 rounded-full text-slate-400 hover:text-slate-600 transition"
                            title="Xóa lựa chọn"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* Dropdown danh sách */}
            {isOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-72 flex flex-col">
                    {/* Ô nhập tìm kiếm */}
                    <div className="p-2 border-b border-slate-100 bg-slate-50/70 sticky top-0">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Gõ mã siêu thị (VD: 10335) hoặc tên siêu thị..."
                                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        <div className="text-[10px] text-slate-400 px-1 pt-1 flex justify-between">
                            <span>Tìm thấy <b>{filteredStores.length}</b> siêu thị</span>
                            <span>Ưu tiên tìm theo Mã ST ở đầu</span>
                        </div>
                    </div>

                    {/* Danh sách cuộn */}
                    <div className="overflow-y-auto max-h-56 divide-y divide-slate-50 p-1">
                        {filteredStores.length === 0 ? (
                            <div className="p-4 text-center text-slate-400 text-xs">
                                Không tìm thấy siêu thị nào khớp với từ khóa "{searchTerm}"
                            </div>
                        ) : (
                            filteredStores.map((st) => {
                                const isSelected = st.name === value;
                                return (
                                    <div
                                        key={st.id || st.code || st.name}
                                        onClick={() => handleSelect(st.name)}
                                        className={`px-3 py-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition ${
                                            isSelected
                                                ? 'bg-blue-50 text-blue-900 font-bold'
                                                : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            {st.code ? (
                                                <span className="font-mono font-black text-[11px] bg-slate-100 text-indigo-800 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                                                    {st.code}
                                                </span>
                                            ) : (
                                                <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                                            )}
                                            <div className="min-w-0">
                                                <div className="font-bold text-xs truncate">
                                                    {st.name}
                                                </div>
                                                {st.address && (
                                                    <div className="text-[10px] text-slate-400 truncate">
                                                        {st.address}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <Check className="w-4 h-4 text-blue-600 shrink-0" />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {error && (
                <p className="text-[11px] text-rose-600 font-semibold mt-1 animate-in fade-in">
                    {error}
                </p>
            )}
        </div>
    );
}
