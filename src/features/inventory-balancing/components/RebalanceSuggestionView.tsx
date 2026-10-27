import React, { useState, useMemo } from 'react';
import {
    Package,
    Store,
    Copy,
    Check,
    CheckCheck,
    Save,
    Download,
    ArrowLeft,
    CheckCircle2,
    AlertCircle,
    Send,
    ExternalLink,
    Sparkles,
    ChevronDown,
    ChevronUp,
    Filter,
    Search,
    X,
    FileSpreadsheet,
    MinusCircle,
    RotateCcw,
    Flame
} from 'lucide-react';
import type { RebalanceMatchItem, StoreGroupedSupply, ProductSalesVelocity } from '../types';
import {
    generateZaloOverallMessage,
    generateZaloStoreSpecificMessage,
    exportStoreTransferRequestExcel,
    getProductSalesVelocity
} from '../utils/inventoryExcelHelper';

interface RebalanceSuggestionViewProps {
    targetStore: string;
    matches: RebalanceMatchItem[];
    groupedByStore: StoreGroupedSupply[];
    minSourceQty: number;
    sourceStoreFilter: string;
    requestPercent?: number;
    onRequestPercentChange?: (pct: number) => void;
    orderedItemsMap?: Record<string, { is_ordered: boolean; ordered_at: string }>;
    onToggleOrderedItem?: (sourceStore: string, productCode: string) => void;
    onBatchSetStoreOrdered?: (sourceStore: string, productCodes: string[], isOrdered: boolean) => void;
    excludedStoreItemKeys?: Record<string, boolean>;
    onToggleExcludeStoreItem?: (sourceStore: string, productCode: string) => void;
    storeCustomQtyMap?: Record<string, number>;
    onChangeStoreItemQty?: (sourceStore: string, productCode: string, qty: number) => void;
    onSaveConfig?: () => void;
    isSavingConfig?: boolean;
    onPrevStep: () => void;
    onExportImage?: () => void;
    onExportExcel?: () => void;
    canExportExcel?: boolean;
    isExportingImage?: boolean;
    reportCaptureRef: React.RefObject<HTMLDivElement>;
    salesVelocityMap?: Record<string, ProductSalesVelocity>;
}

export default function RebalanceSuggestionView({
    targetStore,
    matches,
    groupedByStore,
    minSourceQty,
    sourceStoreFilter,
    requestPercent = 30,
    onRequestPercentChange,
    orderedItemsMap = {},
    onToggleOrderedItem,
    onBatchSetStoreOrdered,
    excludedStoreItemKeys = {},
    onToggleExcludeStoreItem,
    storeCustomQtyMap = {},
    onChangeStoreItemQty,
    onSaveConfig,
    isSavingConfig = false,
    onPrevStep,
    onExportImage,
    onExportExcel,
    canExportExcel = false,
    isExportingImage = false,
    reportCaptureRef,
    salesVelocityMap
}: RebalanceSuggestionViewProps) {
    // Chế độ xem: 'product' (Theo Sản Phẩm) | 'store' (Theo Siêu Thị Đối Tác)
    const [viewMode, setViewMode] = useState<'product' | 'store'>('product');
    const [copiedAll, setCopiedAll] = useState<boolean>(false);
    const [copiedStoreMap, setCopiedStoreMap] = useState<Record<string, boolean>>({});
    // Mặc định tick chọn bộ lọc "Chỉ mã có nguồn"
    const [filterOnlyHasSource, setFilterOnlyHasSource] = useState<boolean>(true);
    // Bộ lọc chỉ mã có sức bán
    const [filterOnlyHasSales, setFilterOnlyHasSales] = useState<boolean>(false);
    // Hai input tìm kiếm lọc song song: theo sản phẩm và theo siêu thị
    const [searchProductKeyword, setSearchProductKeyword] = useState<string>('');
    const [searchStoreKeyword, setSearchStoreKeyword] = useState<string>('');
    // Bộ lọc trạng thái lệnh khi xem theo siêu thị: 'ALL' (Tất cả) | 'UNORDERED' (Chưa tạo lệnh - Ẩn đã tạo) | 'ORDERED' (Đã tạo lệnh)
    const [orderedFilterMode, setOrderedFilterMode] = useState<'ALL' | 'UNORDERED' | 'ORDERED'>('ALL');

    // Tổng số lượng lệnh xin hàng đã đánh dấu
    const totalOrderedPairs = useMemo(() => {
        if (!orderedItemsMap) return 0;
        return Object.values(orderedItemsMap).filter(v => v.is_ordered).length;
    }, [orderedItemsMap]);

    // Thống kê cốt lõi
    const stats = useMemo(() => {
        const total = matches.length;
        const matched = matches.filter(m => m.hasSource).length;
        const unmatched = total - matched;
        const totalNeeded = matches.reduce((sum, m) => sum + m.needed_qty, 0);
        const totalSourceAvailable = matches.reduce((sum, m) => sum + m.total_source_available, 0);
        const partnerStoresCount = groupedByStore.length;
        return {
            total,
            matched,
            unmatched,
            totalNeeded,
            totalSourceAvailable,
            partnerStoresCount
        };
    }, [matches, groupedByStore]);

    // Lọc theo tùy chọn chỉ xem có nguồn & text tìm kiếm sản phẩm / siêu thị
    const displayedMatches = useMemo(() => {
        let list = filterOnlyHasSource ? matches.filter(m => m.hasSource) : matches;

        const pKw = (searchProductKeyword || '').toLowerCase().trim();
        const sKw = (searchStoreKeyword || '').toLowerCase().trim();

        if (pKw) {
            list = list.filter(m => {
                const matchCode = (m.product_code || '').toLowerCase().includes(pKw);
                const matchName = (m.product_name || '').toLowerCase().includes(pKw);
                const matchCat = (m.category || '').toLowerCase().includes(pKw) || (m.sub_category || '').toLowerCase().includes(pKw);
                return matchCode || matchName || matchCat;
            });
        }

        if (sKw) {
            list = list.filter(m =>
                (m.source_stores || []).some(s => (s.store_name || '').toLowerCase().includes(sKw))
            );
        }

        // Lọc theo sức bán nếu bật
        if (filterOnlyHasSales && salesVelocityMap) {
            list = list.filter(m => {
                const vel = getProductSalesVelocity(salesVelocityMap, m.product_code);
                return vel && vel.sales_qty > 0;
            });
        }

        return list;
    }, [matches, filterOnlyHasSource, searchProductKeyword, searchStoreKeyword, filterOnlyHasSales, salesVelocityMap]);

    // Lọc danh sách theo siêu thị đối tác, từ khóa tìm kiếm (SP & Siêu thị hoạt động song song) và trạng thái tạo lệnh
    // Khi đang xem theo siêu thị: Danh sách sản phẩm bên trong được sắp xếp theo tên sản phẩm A-Z
    const displayedGroupedByStore = useMemo(() => {
        const pKw = (searchProductKeyword || '').toLowerCase().trim();
        const sKw = (searchStoreKeyword || '').toLowerCase().trim();

        return groupedByStore
            .map(g => {
                if (!g) return null;
                // 1. Lọc theo tên siêu thị đối tác (nếu có nhập)
                if (sKw) {
                    const matchStore = (g.store_name || '').toLowerCase().includes(sKw);
                    if (!matchStore) return null;
                }

                // 2. Lọc các sản phẩm trong siêu thị này khớp với từ khóa sản phẩm (nếu có nhập)
                let items = g.items || [];
                if (pKw) {
                    items = items.filter(item =>
                        (item.product_code || '').toLowerCase().includes(pKw) ||
                        (item.product_name || '').toLowerCase().includes(pKw) ||
                        (item.category || '').toLowerCase().includes(pKw) ||
                        (item.sub_category || '').toLowerCase().includes(pKw)
                    );
                }

                // 3. Lọc theo trạng thái lệnh xin hàng (orderedFilterMode)
                if (orderedFilterMode === 'UNORDERED') {
                    // Ẩn các sản phẩm xác nhận đã tạo lệnh
                    items = items.filter(item => {
                        const orderKey = `${g.store_name}__${item.product_code}`;
                        return !orderedItemsMap?.[orderKey]?.is_ordered;
                    });
                } else if (orderedFilterMode === 'ORDERED') {
                    // Chỉ hiển thị các sản phẩm đã xác nhận tạo lệnh
                    items = items.filter(item => {
                        const orderKey = `${g.store_name}__${item.product_code}`;
                        return Boolean(orderedItemsMap?.[orderKey]?.is_ordered);
                    });
                }

                // 3b. Lọc theo sức bán nếu người dùng bật
                if (filterOnlyHasSales && salesVelocityMap) {
                    items = items.filter(item => {
                        const vel = getProductSalesVelocity(salesVelocityMap, item.product_code);
                        return vel && vel.sales_qty > 0;
                    });
                }

                if (items.length === 0) return null;

                // 4. SẮP XẾP DANH SÁCH SẢN PHẨM THEO TÊN SẢN PHẨM (A-Z)
                const sortedItems = [...items].sort((a, b) =>
                    (a.product_name || '').localeCompare(b.product_name || '', 'vi', { sensitivity: 'base' })
                );

                return {
                    ...g,
                    items: sortedItems,
                    total_matched_products: sortedItems.length,
                    total_available_qty: sortedItems.reduce((sum, it) => sum + (it.available_qty || 0), 0)
                };
            })
            .filter((g): g is StoreGroupedSupply => g !== null);
    }, [groupedByStore, searchProductKeyword, searchStoreKeyword, orderedFilterMode, orderedItemsMap, filterOnlyHasSales, salesVelocityMap]);

    // Trạng thái tìm kiếm và nhãn hiển thị khi không có kết quả
    const hasAnySearch = Boolean(searchProductKeyword.trim() || searchStoreKeyword.trim());
    const searchDisplayLabel = useMemo(() => {
        const parts = [];
        if (searchProductKeyword.trim()) parts.push(`Sản phẩm: "${searchProductKeyword.trim()}"`);
        if (searchStoreKeyword.trim()) parts.push(`Siêu thị: "${searchStoreKeyword.trim()}"`);
        return parts.join(' • ');
    }, [searchProductKeyword, searchStoreKeyword]);

    // Sao chép tin Zalo chung
    const handleCopyAllZalo = async () => {
        const text = generateZaloOverallMessage(targetStore, matches);
        try {
            await navigator.clipboard.writeText(text);
            setCopiedAll(true);
            setTimeout(() => setCopiedAll(false), 2500);
        } catch (e) {
            console.error('Không thể copy:', e);
        }
    };

    // Sao chép tin Zalo cho riêng 1 siêu thị đối tác
    const handleCopyStoreZalo = async (supply: StoreGroupedSupply) => {
        const text = generateZaloStoreSpecificMessage(targetStore, supply);
        try {
            await navigator.clipboard.writeText(text);
            setCopiedStoreMap(prev => ({ ...prev, [supply.store_name]: true }));
            setTimeout(() => {
                setCopiedStoreMap(prev => ({ ...prev, [supply.store_name]: false }));
            }, 2500);
        } catch (e) {
            console.error('Không thể copy:', e);
        }
    };

    // Xuất file Excel danh sách xin hàng theo từng siêu thị (4 cột chuẩn ERP: Mã SP, Tên SP, IMEI, SL yêu cầu)
    // Tự động loại trừ các mã sản phẩm người dùng đã bấm 'Loại trừ' và áp dụng số lượng đã chỉnh sửa
    const [exportingStore, setExportingStore] = useState<string | null>(null);
    const handleExportStoreExcel = async (storeSupply: StoreGroupedSupply) => {
        setExportingStore(storeSupply.store_name);
        try {
            // Lọc các sản phẩm không bị loại trừ và gắn đúng số lượng yêu cầu tùy chỉnh
            const validItems = storeSupply.items
                .filter(item => !excludedStoreItemKeys[`${storeSupply.store_name}__${item.product_code}`])
                .map(item => {
                    const key = `${storeSupply.store_name}__${item.product_code}`;
                    const customQty = storeCustomQtyMap[key];
                    return {
                        ...item,
                        suggested_qty: customQty !== undefined ? customQty : (item.suggested_qty ?? item.needed_qty ?? 1)
                    };
                });

            if (validItems.length === 0) {
                alert(`Tất cả sản phẩm của siêu thị "${storeSupply.store_name}" đang bị loại trừ. Vui lòng giữ lại ít nhất 1 sản phẩm để xuất file Excel.`);
                return;
            }

            const fileName = await exportStoreTransferRequestExcel(
                storeSupply.store_name,
                validItems,
                searchProductKeyword || searchStoreKeyword
            );
            console.log('[SalesHub] Đã xuất file xin hàng:', fileName);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            alert(`Lỗi khi xuất file Excel xin hàng: ${msg}`);
        } finally {
            setExportingStore(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* THANH ĐIỀU KHIỂN & HÀNH ĐỘNG BƯỚC 3 (TỐI ƯU GIAO DIỆN PC TRỰC QUAN & RÕ RÀNG) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4" data-export-ignore="true" data-html2canvas-ignore="true">
                {/* HÀNG 1: TIÊU ĐỀ & CÁC NÚT THAO TÁC CHÍNH */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onPrevStep}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-xl border border-slate-200 transition-all cursor-pointer shadow-2xs shrink-0"
                            title="Quay lại Bước 2 (Điều chỉnh bộ lọc nguồn)"
                        >
                            <ArrowLeft className="w-4 h-4 text-slate-600" />
                            <span className="hidden sm:inline">Quay lại Bước 2</span>
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-white text-[11px] font-black uppercase tracking-wider shadow-2xs">
                                    Bước 3 / 3
                                </span>
                                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                    Danh Sách Gợi Ý Xin Chuyển Hàng
                                </h2>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span>Siêu thị xin: <b className="text-blue-700 font-bold">{targetStore || 'Chưa chọn'}</b></span>
                                <span className="text-slate-300">•</span>
                                <span>Điều kiện tồn nguồn: <span className="font-semibold text-slate-700">≥ {minSourceQty} máy</span></span>
                                <span className="text-slate-300">•</span>
                                <span>Tỷ lệ xin: <span className="font-bold text-emerald-700">{requestPercent}%</span></span>
                                {sourceStoreFilter && (
                                    <>
                                        <span className="text-slate-300">•</span>
                                        <span>Lọc ST nguồn: <b className="text-purple-700">{sourceStoreFilter}</b></span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* NÚT THAO TÁC CHÍNH */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Nút Lưu cấu hình & Lệnh xin hàng lên Cloud */}
                        {onSaveConfig && (
                            <button
                                type="button"
                                onClick={onSaveConfig}
                                disabled={isSavingConfig}
                                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                                title="Lưu các đánh dấu đã tạo lệnh xin hàng lên Supabase Cloud"
                            >
                                <Save className="w-4 h-4" />
                                <span>{isSavingConfig ? 'Đang lưu...' : 'Lưu lệnh đã tạo'}</span>
                                {totalOrderedPairs > 0 && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-800 text-white text-[10px] font-mono font-black shadow-inner">
                                        {totalOrderedPairs}
                                    </span>
                                )}
                            </button>
                        )}

                        {/* Sao chép tin nhắn Zalo tổng hợp */}
                        <button
                            type="button"
                            onClick={handleCopyAllZalo}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl shadow-xs transition-colors cursor-pointer"
                            title="Sao chép mẫu tin nhắn Zalo định dạng sẵn gửi Group Vùng / Quản lý"
                        >
                            {copiedAll ? (
                                <>
                                    <Check className="w-4 h-4 text-emerald-600" />
                                    <span className="text-emerald-700">Đã chép tin Zalo!</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4 text-blue-600" />
                                    <span>Copy Tin Zalo</span>
                                </>
                            )}
                        </button>

                        {/* Khi đang xem theo siêu thị: Cho phép xuất Excel xin hàng 4 cột ERP */}
                        {viewMode === 'store' && displayedGroupedByStore.length > 0 && (
                            <button
                                type="button"
                                onClick={async () => {
                                    if (displayedGroupedByStore.length === 1) {
                                        await handleExportStoreExcel(displayedGroupedByStore[0]);
                                        return;
                                    }
                                    if (confirm(`Bạn có muốn xuất lần lượt ${displayedGroupedByStore.length} file Excel xin hàng cho các siêu thị đang hiển thị?`)) {
                                        for (const s of displayedGroupedByStore) {
                                            await handleExportStoreExcel(s);
                                            await new Promise(r => setTimeout(r, 250));
                                        }
                                    }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl shadow-xs transition-colors cursor-pointer"
                                title="Xuất file Excel xin hàng (4 cột ERP) theo từng siêu thị đối tác"
                            >
                                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                                <span>Xuất Excel theo ST {displayedGroupedByStore.length === 1 ? `(${displayedGroupedByStore[0].store_name.split('-')[0].trim()})` : `(${displayedGroupedByStore.length} ST)`}</span>
                            </button>
                        )}

                        {/* Xuất Excel toàn bộ nếu có quyền */}
                        {canExportExcel && onExportExcel && (
                            <button
                                type="button"
                                onClick={onExportExcel}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl shadow-xs transition-colors cursor-pointer"
                                title="Xuất toàn bộ bảng gợi ý ra file Excel"
                            >
                                <Download className="w-4 h-4 text-emerald-600" />
                                <span>Xuất Excel Tổng</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* HÀNG 2: TAB CHUYỂN CHẾ ĐỘ XEM & ĐIỀU CHỈNH TỶ LỆ XIN HÀNG */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* TAB CHUYỂN CHẾ ĐỘ XEM */}
                    <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl gap-1 shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode('product')}
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                viewMode === 'product'
                                    ? 'bg-white text-blue-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Package className="w-4 h-4" />
                            <span>Theo Sản Phẩm</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                                viewMode === 'product' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
                            }`}>
                                {displayedMatches.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setViewMode('store')}
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                viewMode === 'store'
                                    ? 'bg-white text-emerald-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Store className="w-4 h-4" />
                            <span>Theo Siêu Thị Đối Tác</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                                viewMode === 'store' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                            }`}>
                                {displayedGroupedByStore.length}
                            </span>
                        </button>
                    </div>

                    {/* ĐIỀU CHỈNH % TỶ LỆ XIN HÀNG */}
                    {onRequestPercentChange && (
                        <div className="flex items-center gap-2 bg-emerald-50/80 border border-emerald-200/90 px-3 py-1.5 rounded-xl text-xs shrink-0">
                            <span className="font-bold text-emerald-900 text-xs whitespace-nowrap">Tỷ lệ xin hàng:</span>
                            <select
                                value={requestPercent}
                                onChange={(e) => onRequestPercentChange(Number(e.target.value))}
                                className="font-black text-emerald-900 bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                            >
                                <option value={10}>10% tồn kho</option>
                                <option value={20}>20% tồn kho</option>
                                <option value={30}>30% (Chuẩn)</option>
                                <option value={40}>40% tồn kho</option>
                                <option value={50}>50% tồn kho</option>
                                <option value={70}>70% tồn kho</option>
                                <option value={100}>100% (Xin hết tồn)</option>
                            </select>
                            <div className="hidden sm:flex items-center gap-1 pl-1">
                                {[20, 30, 50].map(pct => (
                                    <button
                                        key={pct}
                                        type="button"
                                        onClick={() => onRequestPercentChange(pct)}
                                        className={`px-2 py-0.5 text-[11px] rounded-md font-bold transition-all cursor-pointer ${
                                            requestPercent === pct
                                                ? 'bg-emerald-600 text-white shadow-2xs'
                                                : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                        }`}
                                    >
                                        {pct}%
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* HÀNG 3: THANH TÌM KIẾM SẢN PHẨM / SIÊU THỊ & BỘ LỌC CHIP NHANH */}
                <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-100">
                    {/* 1. INPUT LỌC THEO TÊN / MÃ SẢN PHẨM */}
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={searchProductKeyword}
                            onChange={(e) => setSearchProductKeyword(e.target.value)}
                            placeholder="Tìm theo tên hoặc mã SP..."
                            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs transition-all"
                        />
                        {searchProductKeyword && (
                            <button
                                type="button"
                                onClick={() => setSearchProductKeyword('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                title="Xóa tìm sản phẩm"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* 2. INPUT LỌC THEO TÊN SIÊU THỊ ĐỐI TÁC (KHI XEM THEO SIÊU THỊ) */}
                    {viewMode === 'store' && (
                        <div className="relative flex-1 min-w-[240px]">
                            <Store className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={searchStoreKeyword}
                                onChange={(e) => setSearchStoreKeyword(e.target.value)}
                                placeholder="Tìm theo tên siêu thị đối tác..."
                                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-emerald-300 bg-emerald-50/40 text-emerald-950 placeholder:text-emerald-700/60 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium shadow-2xs transition-all"
                            />
                            {searchStoreKeyword && (
                                <button
                                    type="button"
                                    onClick={() => setSearchStoreKeyword('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-600 hover:text-emerald-800 p-0.5 cursor-pointer"
                                    title="Xóa tìm siêu thị"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* 3. CHECKBOX CHỈ MÃ CÓ NGUỒN */}
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none shrink-0 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 shadow-2xs transition-colors">
                        <input
                            type="checkbox"
                            checked={filterOnlyHasSource}
                            onChange={(e) => setFilterOnlyHasSource(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="font-semibold">Chỉ mã có nguồn ({stats.matched})</span>
                    </label>

                    {/* 4. CHECKBOX CHỈ MÃ CÓ SỨC BÁN */}
                    {salesVelocityMap && Object.keys(salesVelocityMap).length > 0 && (
                        <label className={`inline-flex items-center gap-2 text-xs cursor-pointer select-none shrink-0 px-3 py-2 rounded-xl border shadow-2xs transition-all ${
                            filterOnlyHasSales
                                ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                                : 'bg-amber-50/60 text-amber-800 border-amber-200 hover:bg-amber-100'
                        }`}>
                            <input
                                type="checkbox"
                                checked={filterOnlyHasSales}
                                onChange={(e) => setFilterOnlyHasSales(e.target.checked)}
                                className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                            <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                            <span className="font-semibold">Chỉ mã có sức bán (&gt;0)</span>
                        </label>
                    )}
                </div>

                {/* HÀNG 4 (KHI XEM THEO SIÊU THỊ): BỘ LỌC TRẠNG THÁI LỆNH ĐÃ TẠO */}
                {viewMode === 'store' && (
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                                <Filter className="w-3.5 h-3.5 text-slate-400" />
                                <span>Lọc lệnh xin:</span>
                            </span>
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                                <button
                                    type="button"
                                    onClick={() => setOrderedFilterMode('ALL')}
                                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                                        orderedFilterMode === 'ALL'
                                            ? 'bg-white text-slate-800 shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Tất cả ({displayedGroupedByStore.length} ST)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOrderedFilterMode('UNORDERED')}
                                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                                        orderedFilterMode === 'UNORDERED'
                                            ? 'bg-amber-500 text-white shadow-2xs'
                                            : 'text-amber-800 hover:text-amber-900 hover:bg-amber-100/60'
                                    }`}
                                    title="Chỉ hiển thị các siêu thị còn mặt hàng chưa tạo lệnh"
                                >
                                    <span>Chưa tạo lệnh (Ẩn đã tạo)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOrderedFilterMode('ORDERED')}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                                        orderedFilterMode === 'ORDERED'
                                            ? 'bg-emerald-600 text-white shadow-2xs'
                                            : 'text-emerald-800 hover:text-emerald-900 hover:bg-emerald-100/60'
                                    }`}
                                    title="Chỉ hiển thị các mặt hàng đã xác nhận tạo lệnh"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Đã tạo lệnh</span>
                                    {totalOrderedPairs > 0 && (
                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                                            orderedFilterMode === 'ORDERED' ? 'bg-white text-emerald-800' : 'bg-emerald-200 text-emerald-900'
                                        }`}>
                                            {totalOrderedPairs}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Thống kê nhanh số sản phẩm đã loại trừ nếu có */}
                        {Object.values(excludedStoreItemKeys).filter(Boolean).length > 0 && (
                            <div className="text-xs text-amber-800 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Đang loại trừ <b>{Object.values(excludedStoreItemKeys).filter(Boolean).length}</b> sản phẩm khỏi danh sách xin</span>
                            </div>
                        )}
                    </div>
                )}

                {/* BANNER THÔNG BÁO TỪ KHÓA ĐANG LỌC */}
                {(searchProductKeyword || searchStoreKeyword) && (
                    <div className="text-xs text-blue-700 bg-blue-50/80 px-3 py-1.5 rounded-xl border border-blue-200 flex items-center justify-between">
                        <span>
                            Đang lọc: {searchProductKeyword && <span>Sản phẩm <b>"{searchProductKeyword}"</b> </span>}
                            {searchProductKeyword && searchStoreKeyword && <span>• </span>}
                            {searchStoreKeyword && <span>Siêu thị <b>"{searchStoreKeyword}"</b> </span>}
                            • Khớp <b>{displayedMatches.length}</b> sản phẩm / <b>{displayedGroupedByStore.length}</b> siêu thị
                        </span>
                        <button
                            type="button"
                            onClick={() => { setSearchProductKeyword(''); setSearchStoreKeyword(''); }}
                            className="text-blue-800 hover:underline font-bold cursor-pointer"
                        >
                            Đặt lại
                        </button>
                    </div>
                )}
            </div>

            {/* VÙNG HIỂN THỊ KẾT QUẢ GỢI Ý & VÙNG CHỤP ẢNH BÁO CÁO (TỐI ƯU CÂN ĐỐI RỘNG RÃI TRÊN PC) */}
            <div
                ref={reportCaptureRef}
                data-report-table="true"
                className="w-full bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 shadow-xs space-y-4"
            >
                {/* HEADER BÁO CÁO KHI XUẤT ẢNH */}
                <div className="border-b border-slate-200 pb-3 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-blue-100 text-blue-800 mb-1">
                                SalesHub Inventory Balancing
                            </div>
                            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                GỢI Ý XIN CHUYỂN TỒN KHO SIÊU THỊ
                            </h1>
                            <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap items-center gap-2">
                                <span>Siêu thị đề xuất xin: <b className="text-blue-700 font-bold">{targetStore}</b></span>
                                {totalOrderedPairs > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        Đã tạo {totalOrderedPairs} lệnh xin
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="text-right text-[11px] text-slate-500">
                            <div>Ngày đề xuất: <b className="text-slate-700">{new Date().toLocaleDateString('vi-VN')}</b></div>
                            <div>Điều kiện nguồn: <span className="font-semibold text-emerald-700">Tồn ≥ {minSourceQty} • Xin {requestPercent}% tồn</span></div>
                            {sourceStoreFilter && (
                                <div className="text-[10px] text-slate-400">Lọc ST: {sourceStoreFilter}</div>
                            )}
                        </div>
                    </div>

                    {/* KPI CARDS TRONG BÁO CÁO */}
                    <div data-kpi-grid="true" className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100">
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <div className="text-[10px] font-bold text-slate-500 uppercase">Mã hàng cần xin</div>
                            <div className="text-base sm:text-lg font-black text-slate-800">
                                {stats.total} <span className="text-xs font-normal text-slate-500">mã</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                                Tỷ lệ xin: <b className="text-emerald-700 font-bold">{requestPercent}% tồn kho</b>
                            </div>
                        </div>

                        <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                            <div className="text-[10px] font-bold text-emerald-700 uppercase">Có nguồn chia sẻ</div>
                            <div className="text-base sm:text-lg font-black text-emerald-700">
                                {stats.matched} <span className="text-xs font-normal text-emerald-600">mã</span>
                            </div>
                        </div>

                        <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-200">
                            <div className="text-[10px] font-bold text-blue-700 uppercase">Siêu thị có thể hỗ trợ</div>
                            <div className="text-base sm:text-lg font-black text-blue-700">
                                {stats.partnerStoresCount} <span className="text-xs font-normal text-blue-600">ST</span>
                            </div>
                        </div>

                        <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                            <div className="text-[10px] font-bold text-amber-700 uppercase">Chưa tìm thấy nguồn</div>
                            <div className="text-base sm:text-lg font-black text-amber-700">
                                {stats.unmatched} <span className="text-xs font-normal text-amber-600">mã</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* NỘI DUNG HIỂN THỊ THEO CHẾ ĐỘ XEM */}

                {/* 1. CHẾ ĐỘ: THEO SẢN PHẨM */}
                {viewMode === 'product' && (
                    <div className="space-y-3">
                        {displayedMatches.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs">
                                {hasAnySearch
                                    ? `Không tìm thấy sản phẩm nào khớp với bộ lọc (${searchDisplayLabel}).`
                                    : 'Không có sản phẩm nào để hiển thị.'
                                }
                            </div>
                        ) : (
                            displayedMatches.map((item, idx) => {
                                const vel = salesVelocityMap ? getProductSalesVelocity(salesVelocityMap, item.product_code) : null;

                                // Tính số lượng và số siêu thị đã tạo lệnh xin cho sản phẩm này
                                const orderedSources = item.source_stores.filter(source => {
                                    const orderKey = `${source.store_name}__${item.product_code}`;
                                    return Boolean(orderedItemsMap?.[orderKey]?.is_ordered) && !excludedStoreItemKeys?.[orderKey];
                                });

                                const totalOrderedQty = orderedSources.reduce((sum, source) => {
                                    const orderKey = `${source.store_name}__${item.product_code}`;
                                    const customQty = storeCustomQtyMap?.[orderKey];
                                    const qty = customQty !== undefined ? customQty : (source.can_request_qty || 1);
                                    return sum + qty;
                                }, 0);

                                const orderedStoresCount = orderedSources.length;
                                const isFullyOrdered = totalOrderedQty >= item.needed_qty && item.needed_qty > 0;

                                return (
                                <div
                                    key={item.product_code}
                                    className={`p-3 sm:p-4 rounded-xl border transition-all ${
                                        isFullyOrdered
                                            ? 'bg-emerald-50/25 border-emerald-300 shadow-2xs'
                                            : totalOrderedQty > 0
                                                ? 'bg-blue-50/20 border-blue-300 shadow-2xs'
                                                : item.hasSource
                                                    ? 'bg-white border-slate-200 hover:border-blue-300'
                                                    : 'bg-amber-50/40 border-amber-200'
                                    }`}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="w-5 text-center text-slate-400 font-mono text-xs font-bold">
                                                    {idx + 1}.
                                                </span>
                                                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                                                    {item.product_code}
                                                </span>
                                                {totalOrderedQty > 0 && (
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-2xs ${
                                                        isFullyOrdered
                                                            ? 'bg-emerald-600 text-white border-emerald-700'
                                                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                                    }`}>
                                                        <CheckCircle2 className={`w-3 h-3 ${isFullyOrdered ? 'text-white' : 'text-emerald-700'}`} />
                                                        <span>Đã xin: <b>{totalOrderedQty} máy</b> ({orderedStoresCount} ST)</span>
                                                    </span>
                                                )}
                                                {salesVelocityMap && Object.keys(salesVelocityMap).length > 0 && (
                                                    vel && vel.sales_qty > 0 ? (
                                                        <span
                                                            className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300 font-bold font-mono inline-flex items-center gap-1 shadow-2xs"
                                                            title={`Sức bán: ${vel.sales_qty} máy trong kỳ`}
                                                        >
                                                            <Flame className="w-3 h-3 text-amber-600 fill-amber-500" />
                                                            Sức bán: {vel.sales_qty}
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400 border border-slate-200 font-mono"
                                                            title="Chưa có dữ liệu bán ra trong kỳ"
                                                        >
                                                            Sức bán: 0
                                                        </span>
                                                    )
                                                )}
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                                    {item.category} • {item.sub_category}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    {item.product_status || 'Mới'}
                                                </span>
                                            </div>
                                            <div className="text-xs sm:text-sm font-bold text-slate-900 mt-1 pl-6">
                                                {item.product_name}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2.5 shrink-0 pl-6 sm:pl-0">
                                            {salesVelocityMap && Object.keys(salesVelocityMap).length > 0 && (
                                                <div className="text-right bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">
                                                    <span className="text-[10px] uppercase text-slate-500 font-bold block">Sức bán</span>
                                                    <span className={`text-xs sm:text-sm font-black font-mono ${vel && vel.sales_qty > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                                                        {vel ? `${vel.sales_qty} máy` : '0'}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="text-right bg-rose-50/70 px-2.5 py-1 rounded-lg border border-rose-200">
                                                <span className="text-[10px] uppercase text-rose-800 font-bold block">Đề xuất xin</span>
                                                <span className="text-xs sm:text-sm font-black text-rose-600 font-mono">
                                                    {item.needed_qty} máy
                                                </span>
                                            </div>
                                            <div className={`text-right px-2.5 py-1 rounded-lg border transition-colors ${
                                                totalOrderedQty > 0
                                                    ? 'bg-emerald-50 border-emerald-300'
                                                    : 'bg-slate-50 border-slate-200/80'
                                            }`}>
                                                <span className={`text-[10px] uppercase font-bold block ${
                                                    totalOrderedQty > 0 ? 'text-emerald-800' : 'text-slate-500'
                                                }`}>
                                                    Đã tạo lệnh
                                                </span>
                                                <span className={`text-xs sm:text-sm font-black font-mono flex items-center justify-end gap-1 ${
                                                    totalOrderedQty > 0 ? 'text-emerald-700' : 'text-slate-400'
                                                }`}>
                                                    {totalOrderedQty > 0 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                                                    {totalOrderedQty} máy
                                                </span>
                                            </div>
                                            <div className="text-right bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">
                                                <span className="text-[10px] uppercase text-slate-500 font-bold block">Tồn hiện tại</span>
                                                <span className="text-xs sm:text-sm font-black text-slate-600 font-mono">
                                                    {item.current_qty}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* DANH SÁCH SIÊU THỊ CÓ NGUỒN DƯ */}
                                    <div className="mt-2.5 pt-2 border-t border-slate-100 pl-6">
                                        <div className="text-[11px] font-bold text-slate-700 mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                                            {item.hasSource ? (
                                                <>
                                                    <span className="flex items-center gap-1.5">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                        <span>Có <b>{item.source_stores.length}</b> siêu thị đang có sẵn hàng (≥ {minSourceQty}):</span>
                                                    </span>
                                                    {totalOrderedQty > 0 && (
                                                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-md">
                                                            Đã chốt xin: <b>{totalOrderedQty}</b> / {item.needed_qty} máy (từ {orderedStoresCount}/{item.source_stores.length} ST)
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                                    <span className="text-amber-800 font-semibold">Chưa tìm thấy siêu thị đối tác nào có tồn ≥ {minSourceQty}</span>
                                                </div>
                                            )}
                                        </div>

                                        {item.hasSource && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {item.source_stores.map(source => {
                                                    const orderKey = `${source.store_name}__${item.product_code}`;
                                                    const isOrdered = Boolean(orderedItemsMap?.[orderKey]?.is_ordered);
                                                    const customQty = storeCustomQtyMap?.[orderKey];
                                                    const qtyToRequest = customQty !== undefined ? customQty : (source.can_request_qty || 1);
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={source.store_name}
                                                            onClick={() => onToggleOrderedItem?.(source.store_name, item.product_code)}
                                                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border transition-all cursor-pointer ${
                                                                isOrdered
                                                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs font-semibold'
                                                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                                                            }`}
                                                            title={isOrdered ? 'Đã tạo lệnh xin từ siêu thị này! Bấm để bỏ chọn' : `Bấm để đánh dấu đã tạo lệnh xin ${qtyToRequest} máy từ "${source.store_name}"`}
                                                        >
                                                            <span className="font-medium text-[11px] truncate max-w-[260px]" title={source.store_name}>
                                                                {source.store_name}
                                                            </span>
                                                            <span className={`font-mono font-bold text-[10px] px-1.5 py-0.2 rounded-full shrink-0 ${
                                                                isOrdered ? 'bg-white text-emerald-800' : 'bg-emerald-600 text-white'
                                                            }`}>
                                                                Tồn: {source.available_qty} → Xin: {qtyToRequest}
                                                            </span>
                                                            {isOrdered && (
                                                                <span className="text-[10px] bg-emerald-800/80 text-white px-1 rounded font-bold">
                                                                    ✓ Đã xin ({qtyToRequest})
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                )}

                {/* 2. CHẾ ĐỘ: THEO SIÊU THỊ ĐỐI TÁC */}
                {viewMode === 'store' && (
                    <div className="space-y-3">
                        {displayedGroupedByStore.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs">
                                {hasAnySearch
                                    ? `Không tìm thấy siêu thị hoặc sản phẩm nào khớp với bộ lọc (${searchDisplayLabel}).`
                                    : 'Chưa có siêu thị đối tác nào có sẵn các mặt hàng thiếu của bạn.'
                                }
                            </div>
                        ) : (
                            displayedGroupedByStore.map((storeSupply, idx) => {
                                const storeItemCodes = storeSupply.items.map(i => i.product_code);
                                const storeOrderedCount = storeSupply.items.filter(
                                    i => orderedItemsMap?.[`${storeSupply.store_name}__${i.product_code}`]?.is_ordered
                                ).length;
                                const isAllOrdered = storeSupply.items.length > 0 && storeOrderedCount === storeSupply.items.length;

                                // Danh sách các mặt hàng đang được giữ lại (không bị loại trừ)
                                const activeItems = storeSupply.items.filter(
                                    it => !excludedStoreItemKeys[`${storeSupply.store_name}__${it.product_code}`]
                                );
                                const excludedCount = storeSupply.items.length - activeItems.length;

                                // Tổng số lượng gợi ý xin của các sản phẩm đang được giữ lại (tính theo số lượng tùy chỉnh hoặc mặc định)
                                const storeTotalSuggested = activeItems.reduce((s, it) => {
                                    const key = `${storeSupply.store_name}__${it.product_code}`;
                                    const customQty = storeCustomQtyMap[key];
                                    return s + (customQty !== undefined ? customQty : (it.suggested_qty ?? it.needed_qty ?? 1));
                                }, 0);

                                return (
                                    <div
                                        key={storeSupply.store_name}
                                        className={`border rounded-xl p-3 sm:p-4 transition-all shadow-xs ${
                                            isAllOrdered
                                                ? 'bg-emerald-50/20 border-emerald-300'
                                                : 'bg-white border-slate-200 hover:border-emerald-300'
                                        }`}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate" title={storeSupply.store_name}>
                                                            {storeSupply.store_name}
                                                        </h3>
                                                        {storeOrderedCount > 0 && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                                Đã xin: {storeOrderedCount}/{storeSupply.items.length} mã
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        Có thể chia sẻ: <b className="text-emerald-700">{activeItems.length}/{storeSupply.total_matched_products} mã</b>
                                                        {excludedCount > 0 && (
                                                            <span className="text-amber-700 font-bold ml-1">
                                                                (Đã loại trừ {excludedCount})
                                                            </span>
                                                        )}
                                                        {' '}• Tổng tồn: <b className="text-emerald-700">{storeSupply.total_available_qty} máy</b>
                                                        {' '}• Gợi ý xin ({requestPercent}%): <b className="text-emerald-800 font-bold">{storeTotalSuggested} máy</b>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto" data-html2canvas-ignore="true">
                                                {/* Nút đánh dấu tất cả sản phẩm của ST này */}
                                                {onBatchSetStoreOrdered && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onBatchSetStoreOrdered(storeSupply.store_name, storeItemCodes, !isAllOrdered)}
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border transition-colors cursor-pointer ${
                                                            isAllOrdered
                                                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'
                                                                : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                                                        }`}
                                                        title={isAllOrdered ? 'Hủy đánh dấu tất cả mặt hàng của siêu thị này' : 'Đánh dấu đã tạo lệnh xin tất cả mặt hàng của siêu thị này'}
                                                    >
                                                        <CheckCheck className="w-3.5 h-3.5" />
                                                        <span>{isAllOrdered ? 'Đã xin cả ST (Bỏ)' : 'Đã tạo lệnh cả ST'}</span>
                                                    </button>
                                                )}

                                                {/* Nút xuất file Excel xin hàng 4 cột ERP (Mã SP, Tên SP, IMEI trống, SL yêu cầu) */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleExportStoreExcel(storeSupply)}
                                                    disabled={exportingStore === storeSupply.store_name || activeItems.length === 0}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                                                    title={`Xuất file Excel danh sách xin hàng gửi cho ${storeSupply.store_name} (4 cột import ERP: Mã sản phẩm, Tên sản phẩm, IMEI để trống, Số lượng yêu cầu)`}
                                                >
                                                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                                                    <span>{exportingStore === storeSupply.store_name ? 'Đang xuất...' : `Xuất Excel xin hàng (${activeItems.length})`}</span>
                                                </button>

                                                {/* Nút chép tin Zalo */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyStoreZalo(storeSupply)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                                                    title="Sao chép tin nhắn Zalo gửi riêng cho Quản lý siêu thị này"
                                                >
                                                    {copiedStoreMap[storeSupply.store_name] ? (
                                                        <>
                                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                            <span>Đã chép tin!</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3.5 h-3.5 text-emerald-600" />
                                                            <span>Chép tin gửi ST</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* DANH SÁCH MÃ SẢN PHẨM MÀ SIÊU THỊ ĐÓ CÓ */}
                                        <div className="mt-2.5 divide-y divide-slate-100">
                                            {storeSupply.items.map((item) => {
                                                const orderKey = `${storeSupply.store_name}__${item.product_code}`;
                                                const isItemOrdered = Boolean(orderedItemsMap?.[orderKey]?.is_ordered);
                                                const orderedAt = orderedItemsMap?.[orderKey]?.ordered_at;
                                                const isItemExcluded = Boolean(excludedStoreItemKeys[orderKey]);
                                                const vel = salesVelocityMap ? getProductSalesVelocity(salesVelocityMap, item.product_code) : null;

                                                const currentQty = storeCustomQtyMap[orderKey] !== undefined
                                                    ? storeCustomQtyMap[orderKey]
                                                    : (item.suggested_qty ?? item.needed_qty ?? 1);

                                                return (
                                                    <div
                                                        key={item.product_code}
                                                        className={`py-2 px-2 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2 rounded-lg border transition-all ${
                                                            isItemExcluded
                                                                ? 'bg-slate-100/70 border-dashed border-slate-300 opacity-60'
                                                                : isItemOrdered
                                                                    ? 'bg-emerald-50/60 border-emerald-200'
                                                                    : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
                                                        }`}
                                                    >
                                                        <div className="min-w-0 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                                            <span className={`font-mono font-bold text-[11px] shrink-0 ${isItemExcluded ? 'text-slate-400' : 'text-blue-700'}`}>
                                                                [{item.product_code}]
                                                            </span>
                                                            <span
                                                                className={`font-medium truncate ${
                                                                    isItemExcluded
                                                                        ? 'line-through text-slate-400'
                                                                        : isItemOrdered
                                                                            ? 'text-emerald-950 font-bold'
                                                                            : 'text-slate-800'
                                                                }`}
                                                                title={item.product_name}
                                                            >
                                                                {item.product_name}
                                                            </span>
                                                            {salesVelocityMap && Object.keys(salesVelocityMap).length > 0 && (
                                                                vel && vel.sales_qty > 0 ? (
                                                                    <span
                                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-900 border border-amber-300 font-mono shrink-0 shadow-2xs"
                                                                        title={`Sản phẩm này có sức bán: ${vel.sales_qty} máy trong kỳ`}
                                                                    >
                                                                        <Flame className="w-3 h-3 text-amber-600 fill-amber-500" />
                                                                        Bán: {vel.sales_qty}
                                                                    </span>
                                                                ) : (
                                                                    <span
                                                                        className="text-[10px] px-1.5 py-0.5 rounded text-slate-400 bg-slate-50 border border-slate-200 font-mono shrink-0"
                                                                        title="Chưa phát hiện số lượng bán trong kỳ"
                                                                    >
                                                                        Bán: 0
                                                                    </span>
                                                                )
                                                            )}
                                                            {isItemExcluded && (
                                                                <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded font-bold shrink-0">
                                                                    Đã loại trừ
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end sm:self-auto" data-html2canvas-ignore="true">
                                                            {/* Tồn sẵn của kho nguồn */}
                                                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 font-mono">
                                                                ST có: {item.available_qty}
                                                            </span>

                                                            {/* Input số lượng cần xin tùy chỉnh nhanh */}
                                                            <div
                                                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border transition-all ${
                                                                    isItemExcluded
                                                                        ? 'bg-slate-100 border-slate-200 text-slate-400'
                                                                        : 'bg-blue-50/90 border-blue-200 text-blue-900 focus-within:ring-2 focus-within:ring-blue-400'
                                                                }`}
                                                                title={`Nhập nhanh số lượng cần xin từ siêu thị này (Tồn sẵn: ${item.available_qty})`}
                                                            >
                                                                <span className="text-[10px] font-bold whitespace-nowrap">Xin:</span>
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    max={item.available_qty}
                                                                    value={currentQty}
                                                                    disabled={isItemExcluded}
                                                                    onChange={(e) => {
                                                                        const raw = parseInt(e.target.value, 10);
                                                                        if (!isNaN(raw)) {
                                                                            const clamped = Math.max(1, Math.min(item.available_qty, raw));
                                                                            onChangeStoreItemQty?.(storeSupply.store_name, item.product_code, clamped);
                                                                        }
                                                                    }}
                                                                    className="w-12 text-center font-mono font-black text-xs bg-white border border-blue-300 rounded px-1 py-0.5 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer"
                                                                />
                                                                <span className="text-[10px] text-slate-500 font-medium">/{item.available_qty}</span>
                                                            </div>

                                                            {/* Nút Giữ lại / Loại trừ sản phẩm khỏi danh sách xin hàng */}
                                                            {onToggleExcludeStoreItem && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onToggleExcludeStoreItem(storeSupply.store_name, item.product_code)}
                                                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                                                        isItemExcluded
                                                                            ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 shadow-2xs'
                                                                            : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 border border-slate-200'
                                                                    }`}
                                                                    title={isItemExcluded ? 'Bấm để khôi phục và giữ lại sản phẩm này trong danh sách xin' : 'Bấm để loại trừ sản phẩm này khỏi lệnh xin'}
                                                                >
                                                                    {isItemExcluded ? (
                                                                        <>
                                                                            <RotateCcw className="w-3.5 h-3.5 text-amber-800" />
                                                                            <span>Giữ lại</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <MinusCircle className="w-3.5 h-3.5 text-slate-400" />
                                                                            <span>Loại trừ</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                            )}

                                                            {/* Nút Đã tạo lệnh / Chưa tạo */}
                                                            {onToggleOrderedItem && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onToggleOrderedItem(storeSupply.store_name, item.product_code)}
                                                                    disabled={isItemExcluded}
                                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                                                        isItemOrdered
                                                                            ? 'bg-emerald-600 text-white hover:bg-rose-600 shadow-2xs'
                                                                            : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200'
                                                                    }`}
                                                                    title={isItemOrdered && orderedAt ? `Đã tạo lệnh lúc ${new Date(orderedAt).toLocaleTimeString('vi-VN')} - Bấm để hủy` : 'Bấm để đánh dấu đã tạo lệnh xin hàng cho mã này'}
                                                                >
                                                                    {isItemOrdered ? (
                                                                        <>
                                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                                            <span>Đã tạo</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <span className="w-3 h-3 rounded-full border border-slate-400 shrink-0" />
                                                                            <span>Chưa tạo</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}


            </div>
        </div>
    );
}
