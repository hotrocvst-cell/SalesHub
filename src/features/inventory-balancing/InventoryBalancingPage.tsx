import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Boxes,
    PackageSearch,
    UploadCloud,
    FileSpreadsheet,
    CheckCircle2,
    AlertTriangle,
    Info,
    Store,
    ArrowRight,
    Clock,
    RefreshCw,
    RotateCcw,
    X,
    Flame
} from 'lucide-react';
import { useExcelExportPermission } from '../../shared/hooks/useExcelExportPermission';
import { useAuth } from '../../shared/contexts/AuthContext';
import { isStoreMatch } from '../../core/lib/formatters';
import { fetchStores } from '../../core/lib/storage';
import { generateStandardReportCanvas } from '../../shared/utils/exportImage';
import type {
    InventoryRawRecord,
    ShortageProductItem,
    RebalanceMatchItem,
    StoreGroupedSupply,
    InventoryBalancingSavedConfig,
    ProductSalesVelocity
} from './types';
import {
    parseInventoryExcel,
    exportRebalanceToExcel,
    normalizeSearchStr,
    parseSalesVelocityExcel,
    getProductSalesVelocity
} from './utils/inventoryExcelHelper';
import {
    checkInventoryRebalanceTableReady,
    saveRebalanceConfig,
    loadRebalanceConfig
} from './services/inventoryRebalanceService';
import InventoryBalancingFilterBar from './components/InventoryBalancingFilterBar';
import ShortageSelectionStep from './components/ShortageSelectionStep';
import SourceSupplyStep from './components/SourceSupplyStep';
import RebalanceSuggestionView from './components/RebalanceSuggestionView';
import RebalanceSessionHistoryModal from './components/RebalanceSessionHistoryModal';

export default function InventoryBalancingPage() {
    // Thông tin tài khoản đăng nhập & phân quyền
    const { currentUser, isAdmin } = useAuth();

    // Phân quyền xuất Excel
    const { canExportExcel } = useExcelExportPermission('/can-ton-kho');

    // Ref chụp ảnh báo cáo chuẩn Portrait 8K
    const reportCaptureRef = useRef<HTMLDivElement>(null);

    // State dữ liệu chính
    const [rawRecords, setRawRecords] = useState<InventoryRawRecord[]>([]);
    const [targetStore, setTargetStore] = useState<string>('');
    const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
    const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
    const [isExportingImage, setIsExportingImage] = useState<boolean>(false);
    const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

    // State phân tích sức bán sản phẩm
    const [salesVelocityMap, setSalesVelocityMap] = useState<Record<string, ProductSalesVelocity>>({});
    const [salesVelocityFileName, setSalesVelocityFileName] = useState<string>('');
    const [isParsingSales, setIsParsingSales] = useState<boolean>(false);

    // Tổng số lượng bán từ file sức bán
    const totalSalesQty = useMemo(() => {
        return Object.values(salesVelocityMap).reduce((sum, v) => sum + (v.sales_qty || 0), 0);
    }, [salesVelocityMap]);

    // Cấu hình lọc nguồn Bước 2 & Bước 3
    const [sourceStoreFilter, setSourceStoreFilter] = useState<string>('');
    const [minSourceQty, setMinSourceQty] = useState<number>(2);
    // Tỷ lệ % số lượng cần xin theo tồn kho của siêu thị nguồn (mặc định 30%)
    const [requestPercent, setRequestPercent] = useState<number>(30);
    // Danh sách các siêu thị nguồn bị người dùng chủ động xóa bớt / loại trừ
    const [excludedStores, setExcludedStores] = useState<string[]>([]);

    // Checkbox list Ngành hàng & Nhóm hàng được chọn cho Bước 1 (null nghĩa là mặc định chọn tất cả)
    const [selectedCategories, setSelectedCategories] = useState<string[] | null>(null);
    const [selectedSubCategories, setSelectedSubCategories] = useState<string[] | null>(null);

    // Map lưu trạng thái chọn & số lượng xin của từng mã sản phẩm: { [product_code]: { isSelected, request_qty } }
    const [itemCustomState, setItemCustomState] = useState<Record<string, { isSelected: boolean; request_qty: number }>>({});

    // Map lưu trạng thái đánh dấu đã tạo lệnh xin hàng theo từng cặp kho nguồn và mã sản phẩm:
    // Key: `${source_store}__${product_code}` -> { is_ordered, ordered_at }
    const [orderedItemsMap, setOrderedItemsMap] = useState<Record<string, { is_ordered: boolean; ordered_at: string }>>({});

    // Map lưu trạng thái giữ / loại trừ sản phẩm cần xin hàng theo từng siêu thị: key `${source_store}__${product_code}`
    const [excludedStoreItemKeys, setExcludedStoreItemKeys] = useState<Record<string, boolean>>({});

    // Map điều chỉnh nhanh số lượng cần xin tùy chỉnh theo từng siêu thị: key `${source_store}__${product_code}`
    const [storeCustomQtyMap, setStoreCustomQtyMap] = useState<Record<string, number>>({});

    // Từ khóa loại trừ sản phẩm trong Bước 1 (ví dụ: Apple, iPhone, iPad...)
    const [excludeKeywords, setExcludeKeywords] = useState<string>('');

    // Trạng thái Cloud Banner
    const [tableReady, setTableReady] = useState<boolean>(true);
    const [storageType, setStorageType] = useState<'cloud' | 'local'>('local');
    const [syncStatus, setSyncStatus] = useState<'synced' | 'unsynced'>('synced');
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

    // 1. Kiểm tra tính sẵn sàng của Supabase Table khi load trang
    useEffect(() => {
        let mounted = true;
        checkInventoryRebalanceTableReady().then(ready => {
            if (mounted) setTableReady(ready);
        });
        return () => { mounted = false; };
    }, []);

    // 2. LỌC DANH SÁCH SẢN PHẨM CÓ TRONG FILE TRƯỚC, XÓA LẶP (Master Product Catalog)
    const masterProducts = useMemo(() => {
        const map = new Map<string, {
            product_code: string;
            product_name: string;
            category: string;
            sub_category: string;
            product_status?: string;
            unit?: string;
            model_code?: string;
        }>();

        rawRecords.forEach(r => {
            const code = r.product_code?.trim();
            if (!code) return;

            const existing = map.get(code);
            if (!existing) {
                map.set(code, {
                    product_code: code,
                    product_name: r.product_name?.trim() || '',
                    category: r.category?.trim() || 'Khác',
                    sub_category: r.sub_category?.trim() || 'Khác',
                    product_status: r.product_status?.trim() || 'Mới',
                    unit: r.unit,
                    model_code: r.model_code
                });
            } else {
                // Ưu tiên cập nhật thông tin tên, ngành, nhóm hàng nếu bản ghi trước bị khuyết
                if (!existing.product_name && r.product_name) existing.product_name = r.product_name.trim();
                if ((!existing.category || existing.category === 'Khác') && r.category) existing.category = r.category.trim();
                if ((!existing.sub_category || existing.sub_category === 'Khác') && r.sub_category) existing.sub_category = r.sub_category.trim();
                if (!existing.product_status && r.product_status) existing.product_status = r.product_status.trim();
                if (!existing.unit && r.unit) existing.unit = r.unit;
                if (!existing.model_code && r.model_code) existing.model_code = r.model_code;
            }
        });

        return Array.from(map.values());
    }, [rawRecords]);

    // 3. Danh sách tất cả các siêu thị có trong file
    const allFileStores = useMemo(() => {
        const set = new Set<string>();
        rawRecords.forEach(r => {
            if (r.store_name) set.add(r.store_name);
        });
        return Array.from(set).sort();
    }, [rawRecords]);

    // Danh mục siêu thị từ hệ thống (phục vụ chọn trước khi nạp file)
    const [systemStores, setSystemStores] = useState<string[]>([]);
    const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
    // Trạng thái phiên xin hàng được nạp khôi phục (phục vụ xem lại khi chưa nạp file Excel mới)
    const [restoredSession, setRestoredSession] = useState<InventoryBalancingSavedConfig | null>(null);

    // 0. Tải danh mục siêu thị hệ thống khi mount
    useEffect(() => {
        let mounted = true;
        fetchStores().then(res => {
            if (mounted && res.success && res.data) {
                const names = res.data.map(s => s.name?.trim()).filter(Boolean) as string[];
                setSystemStores(Array.from(new Set(names)).sort());
            }
        });
        return () => { mounted = false; };
    }, []);

    // Danh sách siêu thị được gán cho tài khoản (accessible_stores hoặc store_name)
    const userAssignedStores = useMemo(() => {
        const assigned = currentUser.accessible_stores && currentUser.accessible_stores.length > 0
            ? currentUser.accessible_stores
            : (currentUser.store_name ? [currentUser.store_name] : []);
        return assigned.map(s => s.trim()).filter(Boolean);
    }, [currentUser]);

    // 4. SIÊU THỊ PHỤ TRÁCH (XIN HÀNG): Luôn cho phép chọn siêu thị kể cả trước khi nạp file Excel!
    const userAllowedStores = useMemo(() => {
        // TRƯỜNG HỢP 1: ĐÃ NẠP FILE EXCEL VÀ CÓ DANH SÁCH SIÊU THỊ TRONG FILE
        if (allFileStores.length > 0) {
            if (isAdmin) return allFileStores;

            if (userAssignedStores.length > 0) {
                const matched = allFileStores.filter(fileStore =>
                    userAssignedStores.some(acc => isStoreMatch(fileStore, acc))
                );
                if (matched.length > 0) return matched;
                // Nếu file không có kho nào khớp, vẫn giữ kho của user để họ nhận biết
                return userAssignedStores;
            }
            return allFileStores;
        }

        // TRƯỜNG HỢP 2: KHI CHƯA NẠP FILE EXCEL -> USER VẪN ĐƯỢC CHỌN SIÊU THỊ ĐỂ NẠP CẤU HÌNH & LỆNH ĐÃ LƯU!
        if (userAssignedStores.length > 0) {
            return userAssignedStores;
        }

        if (isAdmin || userAssignedStores.length === 0) {
            return systemStores;
        }

        return [];
    }, [allFileStores, isAdmin, userAssignedStores, systemStores]);

    // Thông báo trạng thái siêu thị phụ trách dành cho user
    const currentUserStoreNotice = useMemo(() => {
        if (isAdmin) return undefined;
        if (userAssignedStores.length === 0) {
            return `Tài khoản (${currentUser.full_name || 'Người dùng'}) chưa được gán siêu thị phụ trách nào trong hồ sơ.`;
        }
        if (allFileStores.length > 0) {
            const hasMatch = allFileStores.some(fileStore =>
                userAssignedStores.some(acc => isStoreMatch(fileStore, acc))
            );
            if (!hasMatch) {
                return `Tài khoản phụ trách "${userAssignedStores.join(', ')}", không có trong ${allFileStores.length} kho của file này.`;
            }
        }
        return undefined;
    }, [isAdmin, currentUser, userAssignedStores, allFileStores]);

    // Tự động chọn siêu thị đầu tiên trong danh sách được phép
    useEffect(() => {
        if (userAllowedStores.length > 0) {
            if (!targetStore || !userAllowedStores.includes(targetStore)) {
                setTargetStore(userAllowedStores[0]);
            }
        } else {
            setTargetStore('');
        }
    }, [userAllowedStores, targetStore]);

    // 5. Tự động load cấu hình đã lưu khi đổi targetStore
    useEffect(() => {
        if (!targetStore) return;
        // Reset bộ lọc ngành/nhóm về mặc định khi chuyển sang siêu thị mới
        setSelectedCategories(null);
        setSelectedSubCategories(null);

        let isMounted = true;
        loadRebalanceConfig(targetStore).then(({ config, storageType: sType }) => {
            if (!isMounted || !config) return;
            setStorageType(sType);
            if (config.source_store_filter) setSourceStoreFilter(config.source_store_filter);
            if (config.min_source_qty) setMinSourceQty(config.min_source_qty);
            if (config.request_percent !== undefined) setRequestPercent(config.request_percent);
            if (config.excluded_source_stores) setExcludedStores(config.excluded_source_stores);
            if (config.selected_categories && config.selected_categories.length > 0) {
                setSelectedCategories(config.selected_categories);
            }
            if (config.selected_sub_categories && config.selected_sub_categories.length > 0) {
                setSelectedSubCategories(config.selected_sub_categories);
            }

            // Nạp lại trạng thái đánh dấu đã tạo lệnh xin hàng
            if (config.ordered_items) {
                setOrderedItemsMap(config.ordered_items);
            } else {
                setOrderedItemsMap({});
            }

            // Nạp lại trạng thái loại trừ / giữ lại sản phẩm theo siêu thị
            if (config.excluded_store_item_keys) {
                setExcludedStoreItemKeys(config.excluded_store_item_keys);
            } else {
                setExcludedStoreItemKeys({});
            }

            // Nạp lại số lượng tùy chỉnh theo siêu thị
            if (config.store_custom_qtys) {
                setStoreCustomQtyMap(config.store_custom_qtys);
            } else {
                setStoreCustomQtyMap({});
            }

            // Nạp lại từ khóa loại trừ sản phẩm Bước 1
            if (config.exclude_keywords) {
                setExcludeKeywords(config.exclude_keywords);
            } else {
                setExcludeKeywords('');
            }

            // Nạp lại trạng thái đã chọn
            if (config.selected_product_codes && config.selected_product_codes.length > 0) {
                const reqMap = config.request_qtys || {};
                setItemCustomState(prev => {
                    const next = { ...prev };
                    config.selected_product_codes.forEach(code => {
                        next[code] = {
                            isSelected: true,
                            request_qty: reqMap[code] || 1
                        };
                    });
                    return next;
                });
            }

            // Nạp lại dữ liệu sức bán đã lưu
            if (config.sales_velocity_map && Object.keys(config.sales_velocity_map).length > 0) {
                setSalesVelocityMap(config.sales_velocity_map);
            }
            if (config.sales_velocity_file_name) {
                setSalesVelocityFileName(config.sales_velocity_file_name);
            }

            // Nếu chưa có file Excel tồn kho mới, tự động kích hoạt chế độ xem phiên đã lưu gần nhất
            if (rawRecords.length === 0 && (config.snapshot_products?.length || config.selected_product_codes?.length)) {
                setRestoredSession(config);
            }
        });
        return () => { isMounted = false; };
    }, [targetStore, rawRecords.length]);

    // 6. BƯỚC 1: SỬ DỤNG DANH SÁCH SẢN PHẨM VỪA LỌC, KIỂM TRA TỒN KHO THEO KHO PHỤ TRÁCH, TRẢ LẠI DANH SÁCH SẢN PHẨM CẦN BỔ SUNG TỒN KHO (< 1 hoặc bằng 0)
    // 6.1. Danh sách toàn bộ ứng viên thiếu hàng (< 1) tại kho phụ trách
    const allShortageCandidates = useMemo(() => {
        if (!targetStore || masterProducts.length === 0) return [];

        const targetStockMap = new Map<string, {
            available_qty: number;
            product_status?: string;
            unit?: string;
            model_code?: string;
        }>();

        rawRecords.forEach(r => {
            if (r.store_name === targetStore) {
                const code = r.product_code?.trim();
                if (!code) return;
                const existing = targetStockMap.get(code);
                if (existing) {
                    existing.available_qty += (Number(r.available_qty) || 0);
                    if (r.product_status && !existing.product_status) existing.product_status = r.product_status;
                } else {
                    targetStockMap.set(code, {
                        available_qty: Number(r.available_qty) || 0,
                        product_status: r.product_status,
                        unit: r.unit,
                        model_code: r.model_code
                    });
                }
            }
        });

        const list: Array<{
            prod: typeof masterProducts[0];
            currentQty: number;
            status: string;
            unit?: string;
            model_code?: string;
        }> = [];

        masterProducts.forEach(prod => {
            const storeStock = targetStockMap.get(prod.product_code);
            const currentQty = storeStock ? storeStock.available_qty : 0;
            const status = storeStock?.product_status || prod.product_status || 'Mới';
            if (currentQty < 1) {
                list.push({
                    prod,
                    currentQty,
                    status,
                    unit: storeStock?.unit || prod.unit,
                    model_code: storeStock?.model_code || prod.model_code
                });
            }
        });

        return list;
    }, [targetStore, masterProducts, rawRecords]);

    // Toàn bộ ngành hàng có trong danh sách hàng thiếu
    const allShortageCategoryNames = useMemo(() => {
        const set = new Set<string>();
        allShortageCandidates.forEach(c => set.add(c.prod.category || 'Khác'));
        return Array.from(set);
    }, [allShortageCandidates]);

    // Ngành hàng đang được kích hoạt (nếu user chưa uncheck ngành nào thì mặc định lấy tất cả)
    const activeCategories = useMemo(() => {
        return selectedCategories !== null ? selectedCategories : allShortageCategoryNames;
    }, [selectedCategories, allShortageCategoryNames]);

    // Toàn bộ nhóm hàng thuộc các ngành hàng đang được kích hoạt
    const allAvailableSubCategoryNames = useMemo(() => {
        const set = new Set<string>();
        allShortageCandidates.forEach(c => {
            const cat = c.prod.category || 'Khác';
            if (activeCategories.includes(cat)) {
                set.add(c.prod.sub_category || 'Khác');
            }
        });
        return Array.from(set);
    }, [allShortageCandidates, activeCategories]);

    // Nhóm hàng đang được kích hoạt (nếu user chưa uncheck nhóm nào thì mặc định lấy tất cả nhóm khả dụng)
    const activeSubCategories = useMemo(() => {
        return selectedSubCategories !== null ? selectedSubCategories : allAvailableSubCategoryNames;
    }, [selectedSubCategories, allAvailableSubCategoryNames]);

    // 6.2. Danh sách shortageItems hoàn chỉnh:
    // Sản phẩm chỉ được chọn khi thuộc cả ngành hàng VÀ nhóm hàng đang được tick chọn, VÀ không nằm trong từ khóa bị loại trừ
    const shortageItems = useMemo<ShortageProductItem[]>(() => {
        const excludeTokens = (excludeKeywords || '')
            .split(/[,;]+/)
            .map(t => t.trim().toLowerCase())
            .filter(Boolean);

        return allShortageCandidates.map(({ prod, currentQty, status, unit, model_code }) => {
            const cat = prod.category || 'Khác';
            const sub = prod.sub_category || 'Khác';

            // Kiểm tra xem sản phẩm có nằm trong ngành hàng và nhóm hàng đang được chọn không
            const inCategoryScope = activeCategories.includes(cat) && activeSubCategories.includes(sub);

            // Kiểm tra từ khóa loại trừ
            const prodNameLower = (prod.product_name || '').toLowerCase();
            const prodCodeLower = (prod.product_code || '').toLowerCase();
            const isExcludedByKeyword = excludeTokens.length > 0 && excludeTokens.some(token =>
                prodNameLower.includes(token) || prodCodeLower.includes(token)
            );

            const custom = itemCustomState[prod.product_code];
            // isSelected = inCategoryScope && !isExcludedByKeyword && (custom ? custom.isSelected : true)
            const isSelected = inCategoryScope && !isExcludedByKeyword && (custom ? custom.isSelected : true);
            const request_qty = custom ? custom.request_qty : 1;

            return {
                id: `${targetStore}__${prod.product_code}`,
                store_name: targetStore,
                product_code: prod.product_code,
                product_name: prod.product_name,
                category: cat,
                sub_category: sub,
                product_status: status,
                available_qty: currentQty,
                unit,
                model_code,
                isSelected,
                request_qty
            };
        });
    }, [allShortageCandidates, activeCategories, activeSubCategories, excludeKeywords, itemCustomState, targetStore]);

    // Khi người dùng nạp một phiên mà chưa tải file Excel tồn kho mới:
    // Tự động khôi phục danh sách sản phẩm hàng thiếu từ snapshot của phiên
    const restoredShortageItems = useMemo<ShortageProductItem[]>(() => {
        if (rawRecords.length > 0 || !restoredSession) return [];

        if (restoredSession.snapshot_products && restoredSession.snapshot_products.length > 0) {
            return restoredSession.snapshot_products.map(sp => {
                const custom = itemCustomState[sp.product_code];
                const isSelected = custom ? custom.isSelected : true;
                const request_qty = custom ? custom.request_qty : (sp.request_qty || restoredSession.request_qtys?.[sp.product_code] || 1);
                return {
                    id: `${restoredSession.target_store}__${sp.product_code}`,
                    store_name: restoredSession.target_store,
                    product_code: sp.product_code,
                    product_name: sp.product_name,
                    category: sp.category || 'Hàng thiếu đã lưu',
                    sub_category: sp.sub_category || 'Phiên trước',
                    product_status: sp.product_status || 'Mới',
                    available_qty: 0,
                    unit: sp.unit || 'Cái',
                    model_code: sp.model_code,
                    isSelected,
                    request_qty
                };
            });
        }

        // Fallback phiên cũ không có snapshot_products (chỉ có selected_product_codes):
        return (restoredSession.selected_product_codes || []).map(code => {
            const custom = itemCustomState[code];
            const isSelected = custom ? custom.isSelected : true;
            const request_qty = custom ? custom.request_qty : (restoredSession.request_qtys?.[code] || 1);
            return {
                id: `${restoredSession.target_store}__${code}`,
                store_name: restoredSession.target_store,
                product_code: code,
                product_name: `Sản phẩm [${code}]`,
                category: 'Hàng thiếu đã lưu',
                sub_category: 'Phiên trước',
                product_status: 'Mới',
                available_qty: 0,
                unit: 'Cái',
                isSelected,
                request_qty
            };
        });
    }, [rawRecords.length, restoredSession, itemCustomState]);

    // Danh sách sản phẩm hàng thiếu thực tế dùng cho giao diện Bước 1 và thống kê
    const displayShortageItems = useMemo<ShortageProductItem[]>(() => {
        if (rawRecords.length > 0) return shortageItems;
        if (restoredSession) return restoredShortageItems;
        return [];
    }, [rawRecords.length, shortageItems, restoredSession, restoredShortageItems]);

    // Các hàm tương tác Bước 1
    const handleToggleSelectShortage = useCallback((id: string) => {
        const item = displayShortageItems.find(i => i.id === id);
        if (!item) return;
        const currentCustom = itemCustomState[item.product_code];
        const nextSelected = currentCustom ? !currentCustom.isSelected : !item.isSelected;
        setItemCustomState(prev => ({
            ...prev,
            [item.product_code]: {
                isSelected: nextSelected,
                request_qty: currentCustom ? currentCustom.request_qty : (item.request_qty || 1)
            }
        }));
    }, [displayShortageItems, itemCustomState]);

    const handleSelectAllShortage = useCallback((select: boolean) => {
        if (select) {
            setSelectedCategories(null);
            setSelectedSubCategories(null);
        }
        setItemCustomState(prev => {
            const next = { ...prev };
            displayShortageItems.forEach(item => {
                const currentQty = prev[item.product_code]?.request_qty || item.request_qty || 1;
                next[item.product_code] = {
                    isSelected: select,
                    request_qty: currentQty
                };
            });
            return next;
        });
    }, [displayShortageItems]);

    const handleUpdateQuantity = useCallback((id: string, qty: number) => {
        const item = displayShortageItems.find(i => i.id === id);
        if (!item) return;
        setItemCustomState(prev => ({
            ...prev,
            [item.product_code]: {
                isSelected: prev[item.product_code]?.isSelected ?? item.isSelected,
                request_qty: Math.max(1, qty)
            }
        }));
    }, [displayShortageItems]);

    // Xử lý loại trừ / khôi phục siêu thị nguồn không muốn xin
    const handleToggleExcludeStore = useCallback((storeName: string) => {
        setExcludedStores(prev => {
            if (prev.includes(storeName)) {
                return prev.filter(s => s !== storeName);
            } else {
                return [...prev, storeName];
            }
        });
    }, []);

    const handleResetExcludedStores = useCallback(() => {
        setExcludedStores([]);
    }, []);

    // Xử lý đánh dấu đã tạo lệnh xin hàng cho từng sản phẩm tại một kho nguồn cụ thể
    const handleToggleOrderedItem = useCallback((sourceStore: string, productCode: string) => {
        const key = `${sourceStore}__${productCode}`;
        setOrderedItemsMap(prev => {
            const next = { ...prev };
            if (next[key]?.is_ordered) {
                delete next[key];
            } else {
                next[key] = {
                    is_ordered: true,
                    ordered_at: new Date().toISOString()
                };
            }
            return next;
        });
    }, []);

    // Đánh dấu tất cả sản phẩm của 1 siêu thị nguồn là đã tạo lệnh (hoặc bỏ đánh dấu)
    const handleBatchSetStoreOrdered = useCallback((sourceStore: string, productCodes: string[], isOrdered: boolean) => {
        setOrderedItemsMap(prev => {
            const next = { ...prev };
            const now = new Date().toISOString();
            productCodes.forEach(code => {
                const key = `${sourceStore}__${code}`;
                if (isOrdered) {
                    next[key] = { is_ordered: true, ordered_at: now };
                } else {
                    delete next[key];
                }
            });
            return next;
        });
    }, []);

    // Toggle loại trừ hoặc giữ lại sản phẩm cần xin hàng theo siêu thị
    const handleToggleExcludeStoreItem = useCallback((sourceStore: string, productCode: string) => {
        const key = `${sourceStore}__${productCode}`;
        setExcludedStoreItemKeys(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    }, []);

    // Điều chỉnh nhanh số lượng cần xin cho từng sản phẩm theo siêu thị
    const handleChangeStoreItemQty = useCallback((sourceStore: string, productCode: string, qty: number) => {
        const key = `${sourceStore}__${productCode}`;
        setStoreCustomQtyMap(prev => ({
            ...prev,
            [key]: qty
        }));
    }, []);

    // 5. BƯỚC 2: Lọc các siêu thị nguồn có tồn >= minSourceQty & khớp điều kiện chứa tên
    const matchingSourceRecords = useMemo(() => {
        if (!targetStore || rawRecords.length === 0) return [];

        const tokens = sourceStoreFilter
            .split(/[,;\s]+/)
            .map(t => normalizeSearchStr(t))
            .filter(Boolean);

        return rawRecords.filter(r => {
            // Không lấy siêu thị đang phụ trách
            if (r.store_name === targetStore) return false;
            // Không lấy siêu thị đã bị người dùng xóa bớt / loại trừ
            if (excludedStores.includes(r.store_name)) return false;
            // Số lượng có thể bán >= minSourceQty
            if (r.available_qty < minSourceQty) return false;

            // Nếu có điều kiện lọc tên siêu thị (ABC, XYA, 123...)
            if (tokens.length > 0) {
                const normStore = normalizeSearchStr(r.store_name);
                const isMatch = tokens.some(t => normStore.includes(t));
                if (!isMatch) return false;
            }

            return true;
        });
    }, [rawRecords, targetStore, minSourceQty, sourceStoreFilter, excludedStores]);

    // Số lượng siêu thị nguồn khớp điều kiện
    const matchingSourceStoresCount = useMemo(() => {
        const set = new Set<string>();
        matchingSourceRecords.forEach(r => set.add(r.store_name));
        return set.size;
    }, [matchingSourceRecords]);

    // 6. BƯỚC 3: Ghép nối 1 và 2 -> Danh sách gợi ý xin hàng tồn kho
    const { rebalanceMatches, groupedByStore } = useMemo(() => {
        const selectedItems = shortageItems.filter(i => i.isSelected);

        // Map sản phẩm nguồn theo product_code: { [code]: Array<{ store_name, available_qty }> }
        const sourceMap = new Map<string, Array<{ store_name: string; available_qty: number }>>();
        matchingSourceRecords.forEach(r => {
            if (!sourceMap.has(r.product_code)) {
                sourceMap.set(r.product_code, []);
            }
            sourceMap.get(r.product_code)!.push({
                store_name: r.store_name,
                available_qty: r.available_qty
            });
        });

        // Ghép nối từng mã sản phẩm cần xin
        const matches: RebalanceMatchItem[] = selectedItems.map(item => {
            const sources = sourceMap.get(item.product_code) || [];
            // Sắp xếp siêu thị có tồn nhiều nhất lên đầu
            const sortedSources = [...sources].sort((a, b) => b.available_qty - a.available_qty);

            const sourceStoresList = sortedSources.map(s => {
                // SỐ LƯỢNG CẦN XIN = 30% (HOẶC REQUEST_PERCENT) SỐ TỒN KHO CỦA SẢN PHẨM THEO KHO CẦN XIN
                const pctQty = Math.round(s.available_qty * (requestPercent / 100));
                const calculatedQty = Math.min(s.available_qty, Math.max(1, pctQty));
                return {
                    store_name: s.store_name,
                    available_qty: s.available_qty,
                    can_request_qty: calculatedQty,
                    suggested_qty: calculatedQty
                };
            });

            const totalAvailable = sortedSources.reduce((sum, s) => sum + s.available_qty, 0);
            const defaultNeeded = sourceStoresList.length > 0 ? sourceStoresList[0].can_request_qty : item.request_qty;

            return {
                product_code: item.product_code,
                product_name: item.product_name,
                category: item.category,
                sub_category: item.sub_category,
                product_status: item.product_status,
                target_store: item.store_name,
                current_qty: item.available_qty,
                needed_qty: defaultNeeded,
                source_stores: sourceStoresList,
                total_source_available: totalAvailable,
                hasSource: sourceStoresList.length > 0
            };
        });

        // Gom nhóm theo siêu thị đối tác (Group by Source Store)
        const storeGroupMap = new Map<string, StoreGroupedSupply>();
        matches.forEach(m => {
            m.source_stores.forEach(s => {
                if (!storeGroupMap.has(s.store_name)) {
                    storeGroupMap.set(s.store_name, {
                        store_name: s.store_name,
                        total_matched_products: 0,
                        total_available_qty: 0,
                        items: []
                    });
                }
                const entry = storeGroupMap.get(s.store_name)!;
                entry.total_matched_products++;
                entry.total_available_qty += s.available_qty;
                entry.items.push({
                    product_code: m.product_code,
                    product_name: m.product_name,
                    category: m.category,
                    sub_category: m.sub_category,
                    product_status: m.product_status,
                    available_qty: s.available_qty,
                    needed_qty: s.can_request_qty,
                    suggested_qty: s.can_request_qty
                });
            });
        });

        // Sắp xếp các siêu thị cung cấp được nhiều mã nhất lên đầu
        const grouped = Array.from(storeGroupMap.values()).sort(
            (a, b) => b.total_matched_products - a.total_matched_products || b.total_available_qty - a.total_available_qty
        );

        return { rebalanceMatches: matches, groupedByStore: grouped };
    }, [shortageItems, matchingSourceRecords, requestPercent]);

    // Danh sách gợi ý xin hàng thực tế (hỗ trợ cả dữ liệu trực tiếp từ file và dữ liệu khôi phục từ phiên)
    const { displayMatches, displayGroupedByStore } = useMemo(() => {
        if (rawRecords.length > 0) {
            return {
                displayMatches: rebalanceMatches,
                displayGroupedByStore: groupedByStore
            };
        }

        // Tái hiện danh sách gợi ý & siêu thị đối tác từ restoredSession
        if (restoredSession) {
            const matches: RebalanceMatchItem[] = [];
            const storeGroupMap = new Map<string, StoreGroupedSupply>();

            // 1. Tái hiện từ snapshot_matches nếu có
            if (restoredSession.snapshot_matches && restoredSession.snapshot_matches.length > 0) {
                const productMap = new Map<string, ShortageProductItem>();
                displayShortageItems.forEach(i => productMap.set(i.product_code, i));

                restoredSession.snapshot_matches.forEach(sm => {
                    const prod = productMap.get(sm.product_code);
                    const sourceStores = (sm.source_stores || []).map(s => ({
                        store_name: s.store_name,
                        available_qty: s.available_qty,
                        can_request_qty: s.can_request_qty,
                        suggested_qty: s.can_request_qty
                    }));

                    matches.push({
                        product_code: sm.product_code,
                        product_name: prod ? prod.product_name : `Sản phẩm [${sm.product_code}]`,
                        category: prod?.category || 'Khác',
                        sub_category: prod?.sub_category || 'Khác',
                        product_status: prod?.product_status || 'Mới',
                        target_store: restoredSession.target_store,
                        current_qty: 0,
                        needed_qty: sourceStores.length > 0 ? sourceStores[0].can_request_qty : 1,
                        source_stores: sourceStores,
                        total_source_available: sourceStores.reduce((sum, s) => sum + s.available_qty, 0),
                        hasSource: sourceStores.length > 0
                    });

                    sourceStores.forEach(s => {
                        if (!storeGroupMap.has(s.store_name)) {
                            storeGroupMap.set(s.store_name, {
                                store_name: s.store_name,
                                total_matched_products: 0,
                                total_available_qty: 0,
                                items: []
                            });
                        }
                        const entry = storeGroupMap.get(s.store_name)!;
                        entry.total_matched_products++;
                        entry.total_available_qty += s.available_qty;
                        entry.items.push({
                            product_code: sm.product_code,
                            product_name: prod ? prod.product_name : `Sản phẩm [${sm.product_code}]`,
                            category: prod?.category || 'Khác',
                            sub_category: prod?.sub_category || 'Khác',
                            product_status: prod?.product_status || 'Mới',
                            available_qty: s.available_qty,
                            needed_qty: s.can_request_qty,
                            suggested_qty: s.can_request_qty
                        });
                    });
                });
            } else if (restoredSession.ordered_items && Object.keys(restoredSession.ordered_items).length > 0) {
                // Tái hiện từ ordered_items
                const productMap = new Map<string, ShortageProductItem>();
                displayShortageItems.forEach(i => productMap.set(i.product_code, i));

                Object.entries(restoredSession.ordered_items).forEach(([key, _]) => {
                    const [srcStore, pCode] = key.split('__');
                    if (!srcStore || !pCode) return;
                    const prod = productMap.get(pCode);
                    if (!storeGroupMap.has(srcStore)) {
                        storeGroupMap.set(srcStore, {
                            store_name: srcStore,
                            total_matched_products: 0,
                            total_available_qty: 0,
                            items: []
                        });
                    }
                    const entry = storeGroupMap.get(srcStore)!;
                    entry.total_matched_products++;
                    entry.total_available_qty += 1;
                    entry.items.push({
                        product_code: pCode,
                        product_name: prod ? prod.product_name : `Sản phẩm [${pCode}]`,
                        category: prod?.category || 'Khác',
                        sub_category: prod?.sub_category || 'Khác',
                        product_status: prod?.product_status || 'Mới',
                        available_qty: 1,
                        needed_qty: 1,
                        suggested_qty: 1
                    });
                });
            }

            const groups = Array.from(storeGroupMap.values()).sort(
                (a, b) => b.total_matched_products - a.total_matched_products || b.total_available_qty - a.total_available_qty
            );

            return {
                displayMatches: matches,
                displayGroupedByStore: groups
            };
        }

        return {
            displayMatches: [],
            displayGroupedByStore: []
        };
    }, [rawRecords.length, rebalanceMatches, groupedByStore, restoredSession, displayShortageItems]);

    // 7. Xử lý tải lên file Excel
    const handleFileUpload = async (file: File) => {
        setIsLoadingData(true);
        try {
            const records = await parseInventoryExcel(file);
            setRawRecords(records);
            setRestoredSession(null);
            setActiveStep(1);

            const uniqueStores = Array.from(new Set(records.map(r => r.store_name))).filter(Boolean);
            const uniqueProductCodes = Array.from(new Set(records.map(r => r.product_code))).filter(Boolean);

            if (uniqueStores.length === 0) {
                alert(`Đã đọc ${records.length.toLocaleString('vi-VN')} dòng dữ liệu nhưng không phát hiện được cột Tên siêu thị phù hợp trong file "${file.name}".`);
            } else {
                const assigned = currentUser.accessible_stores && currentUser.accessible_stores.length > 0
                    ? currentUser.accessible_stores
                    : (currentUser.store_name ? [currentUser.store_name] : []);

                const allowed = isAdmin ? uniqueStores : uniqueStores.filter(fs => assigned.some(acc => isStoreMatch(fs, acc)));

                if (!isAdmin && allowed.length === 0) {
                    alert(`Nạp thành công ${records.length.toLocaleString('vi-VN')} dòng từ file "${file.name}"!\n• Đã lọc ${uniqueProductCodes.length.toLocaleString('vi-VN')} mã sản phẩm duy nhất từ ${uniqueStores.length} kho.\n⚠️ Chú ý: Tài khoản của bạn (${currentUser.full_name}) phụ trách "${assigned.join(', ') || 'Chưa gán'}", không tìm thấy trong file này.`);
                } else {
                    alert(`Nạp thành công ${records.length.toLocaleString('vi-VN')} dòng tồn kho từ file "${file.name}"!\n• Đã lọc ${uniqueProductCodes.length.toLocaleString('vi-VN')} mã sản phẩm duy nhất (đã xóa lặp)\n• Phát hiện ${uniqueStores.length} kho trong file (${allowed.length} kho bạn phụ trách).`);
                }
            }
        } catch (err: unknown) {
            console.error('Lỗi đọc file Excel:', err);
            const msg = err instanceof Error ? err.message : String(err);
            alert(`Không thể đọc file: ${msg}`);
        } finally {
            setIsLoadingData(false);
        }
    };

    // 7b. Xử lý tải lên file Sức Bán (Cột AF: Mã SP, AG: Tên SP, AJ: Số lượng, N='Đã xuất', AS='Chưa trả')
    const handleSalesFileUpload = async (file: File) => {
        setIsParsingSales(true);
        try {
            const result = await parseSalesVelocityExcel(file);
            setSalesVelocityMap(result.salesMap);
            setSalesVelocityFileName(file.name);
            if (result.matchedRecords === 0) {
                alert(
                    `⚠️ Đã đọc file "${file.name}" (${result.totalRecords.toLocaleString('vi-VN')} dòng) nhưng chưa phát hiện dòng dữ liệu bán hàng nào thỏa điều kiện!\n` +
                    `• Vui lòng kiểm tra lại file có chứa cột Mã sản phẩm và Số lượng bán.`
                );
            } else {
                alert(
                    `Phân tích sức bán thành công từ file "${file.name}"!\n` +
                    `• Tổng số dòng đọc được: ${result.totalRecords.toLocaleString('vi-VN')} dòng\n` +
                    `• Số dòng bán hàng ghi nhận: ${result.matchedRecords.toLocaleString('vi-VN')} dòng\n` +
                    `• Phát hiện ${result.uniqueProductsCount.toLocaleString('vi-VN')} mã sản phẩm có sức bán với tổng số lượng: ${result.totalSalesQty.toLocaleString('vi-VN')} máy.`
                );
            }
        } catch (err: unknown) {
            console.error('Lỗi phân tích file sức bán:', err);
            const msg = err instanceof Error ? err.message : String(err);
            alert(`Không thể đọc file sức bán: ${msg}`);
        } finally {
            setIsParsingSales(false);
        }
    };

    const handleClearSalesVelocity = () => {
        setSalesVelocityMap({});
        setSalesVelocityFileName('');
    };

    // 8. Lưu cấu hình lên Cloud / Local
    const handleSaveConfig = async () => {
        if (!targetStore) return;
        setIsSavingConfig(true);
        try {
            const selectedCodes = shortageItems.filter(i => i.isSelected).map(i => i.product_code);
            const reqQtys: Record<string, number> = {};
            shortageItems.forEach(i => {
                if (i.isSelected) reqQtys[i.product_code] = i.request_qty;
            });

            const config: InventoryBalancingSavedConfig = {
                target_store: targetStore,
                config_name: `Cân tồn kho ${targetStore}`,
                selected_product_codes: selectedCodes,
                request_qtys: reqQtys,
                ordered_items: orderedItemsMap,
                excluded_store_item_keys: excludedStoreItemKeys,
                store_custom_qtys: storeCustomQtyMap,
                exclude_keywords: excludeKeywords,
                source_store_filter: sourceStoreFilter,
                min_source_qty: minSourceQty,
                request_percent: requestPercent,
                excluded_source_stores: excludedStores,
                selected_categories: activeCategories,
                selected_sub_categories: activeSubCategories,
                sales_velocity_map: salesVelocityMap,
                sales_velocity_file_name: salesVelocityFileName,
                snapshot_products: displayShortageItems.filter(i => i.isSelected).map(i => ({
                    product_code: i.product_code,
                    product_name: i.product_name,
                    category: i.category,
                    sub_category: i.sub_category,
                    product_status: i.product_status,
                    unit: i.unit,
                    model_code: i.model_code,
                    request_qty: i.request_qty
                })),
                snapshot_matches: displayMatches.filter(m => m.hasSource).map(m => ({
                    product_code: m.product_code,
                    source_stores: m.source_stores.map(s => ({
                        store_name: s.store_name,
                        available_qty: s.available_qty,
                        can_request_qty: s.can_request_qty
                    }))
                })),
                raw_records_count: rawRecords.length,
                updated_at: new Date().toISOString()
            };

            const result = await saveRebalanceConfig(config);
            setStorageType(result.storageType);
            setSyncStatus('synced');
            setLastSyncTime(new Date().toISOString());

            if (result.storageType === 'cloud') {
                alert(`Đã lưu cấu hình cân tồn kho & trạng thái lệnh xin hàng thành công lên Supabase Cloud cho siêu thị: ${targetStore}!`);
            } else {
                alert(`Đã lưu danh sách vào bộ nhớ cục bộ (Local cache). Hãy kiểm tra kết nối bảng Supabase Cloud.`);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            alert(`Lỗi khi lưu: ${msg}`);
        } finally {
            setIsSavingConfig(false);
        }
    };

    // 10. Xuất ảnh báo cáo Zalo chuẩn Portrait 8K không watermark (Rule 1 & Rule 2)
    const handleExportImage = async () => {
        if (!reportCaptureRef.current) return;
        setIsExportingImage(true);
        try {
            // Tạm thời chuyển sang Bước 3 nếu chưa ở Bước 3
            if (activeStep !== 3) setActiveStep(3);
            await new Promise(r => setTimeout(r, 200));

            const canvas = await generateStandardReportCanvas(reportCaptureRef.current, {
                targetWidth: 860,
                kpiColumns: 4
            });

            if (!canvas) throw new Error('Không thể tạo canvas');

            const link = document.createElement('a');
            const cleanStore = targetStore.split('-')[0].trim() || 'ST';
            link.download = `Can_Ton_Kho_${cleanStore}_${new Date().toISOString().slice(0, 10)}.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Lỗi xuất ảnh:', err);
            alert('Không thể xuất ảnh báo cáo. Vui lòng thử lại.');
        } finally {
            setIsExportingImage(false);
        }
    };

    // 11. Xuất file Excel
    const handleExportExcel = async () => {
        if (displayMatches.length === 0) {
            alert('Không có dữ liệu gợi ý để xuất Excel!');
            return;
        }
        try {
            await exportRebalanceToExcel(targetStore, displayMatches, displayGroupedByStore, salesVelocityMap);
        } catch (err) {
            console.error('Lỗi xuất Excel:', err);
            alert('Lỗi xuất file Excel.');
        }
    };

    // Reset dữ liệu
    const handleReset = () => {
        if (confirm('Bạn có chắc chắn muốn làm mới toàn bộ dữ liệu?')) {
            setRawRecords([]);
            setRestoredSession(null);
            setSalesVelocityMap({});
            setSalesVelocityFileName('');
            setTargetStore('');
            setItemCustomState({});
            setOrderedItemsMap({});
            setExcludedStoreItemKeys({});
            setStoreCustomQtyMap({});
            setExcludeKeywords('');
            setSourceStoreFilter('');
            setExcludedStores([]);
            setSelectedCategories(null);
            setSelectedSubCategories(null);
            setActiveStep(1);
        }
    };

    const selectedShortageCount = useMemo(() => {
        return displayShortageItems.filter(i => i.isSelected).length;
    }, [displayShortageItems]);

    const matchedSuggestionsCount = useMemo(() => {
        return displayMatches.filter(m => m.hasSource).length;
    }, [displayMatches]);

    const savedOrdersCount = useMemo(() => {
        return Object.values(orderedItemsMap).filter(v => v.is_ordered).length;
    }, [orderedItemsMap]);

    const handleApplySession = useCallback((session: InventoryBalancingSavedConfig) => {
        setRestoredSession(session);
        if (session.target_store && session.target_store !== targetStore) {
            setTargetStore(session.target_store);
        }
        if (session.source_store_filter) setSourceStoreFilter(session.source_store_filter);
        if (session.min_source_qty) setMinSourceQty(session.min_source_qty);
        if (session.request_percent !== undefined && session.request_percent !== null) {
            setRequestPercent(session.request_percent);
        }
        if (session.excluded_source_stores) setExcludedStores(session.excluded_source_stores);
        if (session.selected_categories && session.selected_categories.length > 0) {
            setSelectedCategories(session.selected_categories);
        }
        if (session.selected_sub_categories && session.selected_sub_categories.length > 0) {
            setSelectedSubCategories(session.selected_sub_categories);
        }

        if (session.ordered_items) {
            setOrderedItemsMap(session.ordered_items);
        } else {
            setOrderedItemsMap({});
        }

        if (session.excluded_store_item_keys) {
            setExcludedStoreItemKeys(session.excluded_store_item_keys);
        } else {
            setExcludedStoreItemKeys({});
        }

        if (session.store_custom_qtys) {
            setStoreCustomQtyMap(session.store_custom_qtys);
        } else {
            setStoreCustomQtyMap({});
        }

        if (session.exclude_keywords) {
            setExcludeKeywords(session.exclude_keywords);
        } else {
            setExcludeKeywords('');
        }

        if (session.sales_velocity_map) {
            setSalesVelocityMap(session.sales_velocity_map);
        } else {
            setSalesVelocityMap({});
        }

        if (session.sales_velocity_file_name) {
            setSalesVelocityFileName(session.sales_velocity_file_name);
        } else {
            setSalesVelocityFileName('');
        }

        const codes = session.selected_product_codes || session.snapshot_products?.map(p => p.product_code) || [];
        if (codes.length > 0) {
            const reqMap = session.request_qtys || {};
            setItemCustomState(prev => {
                const next = { ...prev };
                codes.forEach(code => {
                    next[code] = {
                        isSelected: true,
                        request_qty: reqMap[code] || 1
                    };
                });
                return next;
            });
        }

        // Tự động chuyển bước phù hợp (nếu đã có lệnh xin thì sang Bước 3, ngược lại vào Bước 1)
        const hasOrders = session.ordered_items && Object.values(session.ordered_items).some(v => v.is_ordered);
        if (hasOrders) {
            setActiveStep(3);
        } else {
            setActiveStep(1);
        }
    }, [targetStore]);

    return (
        <div className="p-2 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-4">
            {/* TIÊU ĐỀ TRANG */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2" data-export-ignore="true" data-html2canvas-ignore="true">
                <div className="flex items-center gap-3">
                    <span className="p-2.5 rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-200">
                        <Boxes className="w-6 h-6" />
                    </span>
                    <div>
                        <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <span>Cân Tồn Kho & Xin Hàng</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                Tiện ích
                            </span>
                        </h1>
                        <p className="text-xs text-slate-500">
                            Lọc sản phẩm thiếu • Tìm siêu thị có tồn kho • Gợi ý xin hàng thông minh
                        </p>
                    </div>
                </div>
            </div>

            {/* BANNER BÁO CÁO TRẠNG THÁI KẾT NỐI & ĐỒNG BỘ TINH GỌN */}
            <div
                data-export-ignore="true"
                data-html2canvas-ignore="true"
                className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-white border border-slate-200/90 rounded-xl text-xs shadow-2xs"
            >
                <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-1.5 font-bold">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${storageType === 'cloud' ? 'bg-emerald-500 shadow-sm shadow-emerald-300' : 'bg-amber-500 shadow-sm shadow-amber-300'}`} />
                        <span className={storageType === 'cloud' ? 'text-emerald-800' : 'text-amber-800'}>
                            {storageType === 'cloud' ? 'Đã kết nối Supabase Cloud' : 'Lưu trữ cục bộ (Bộ nhớ máy)'}
                        </span>
                    </div>

                    <span className="text-slate-300">|</span>

                    <div className="text-slate-500 text-[11px] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                            {lastSyncTime
                                ? `Cập nhật: ${new Date(lastSyncTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(lastSyncTime).toLocaleDateString('vi-VN')}`
                                : 'Chưa cập nhật'}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleSaveConfig}
                    disabled={isSavingConfig || !targetStore}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer shadow-2xs ${isSavingConfig || !targetStore
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                    title={targetStore ? 'Đồng bộ & lưu dữ liệu ngay lên Cloud' : 'Vui lòng chọn Siêu thị trước khi đồng bộ'}
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSavingConfig ? 'animate-spin text-emerald-600' : 'text-emerald-600'}`} />
                    <span>{isSavingConfig ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
                </button>
            </div>

            {/* THANH BỘ LỌC CỐT LÕI (TUÂN THỦ RULE 10: SIÊU THỊ RIÊNG 1 DÒNG ĐẦU TIÊN) */}
            <InventoryBalancingFilterBar
                storesList={userAllowedStores}
                targetStore={targetStore}
                onTargetStoreChange={setTargetStore}
                activeStep={activeStep}
                onStepChange={setActiveStep}
                onFileUpload={handleFileUpload}
                onResetData={handleReset}
                onExportImage={handleExportImage}
                onExportExcel={handleExportExcel}
                onOpenHistory={() => setShowHistoryModal(true)}
                savedOrdersCount={savedOrdersCount}
                canExportExcel={canExportExcel}
                isExportingImage={isExportingImage}
                isLoadingData={isLoadingData}
                totalRows={rawRecords.length}
                shortageCount={displayShortageItems.length}
                selectedShortageCount={selectedShortageCount}
                matchingSourcesCount={matchingSourceStoresCount}
                matchedSuggestionsCount={matchedSuggestionsCount}
                totalMasterProductsCount={masterProducts.length}
                totalFileStoresCount={allFileStores.length}
                currentUserStoreNotice={currentUserStoreNotice}
                onSalesFileUpload={handleSalesFileUpload}
                salesVelocityCount={Object.keys(salesVelocityMap).length}
                totalSalesQty={totalSalesQty}
                salesVelocityFileName={salesVelocityFileName}
                onClearSalesVelocity={handleClearSalesVelocity}
                isParsingSales={isParsingSales}
            />

            {/* NẾU CHƯA CÓ DỮ LIỆU FILE VÀ CHƯA NẠP PHIÊN NÀO: MÀN HÌNH CHÀO MỪNG / KHỞI TẠO */}
            {rawRecords.length === 0 && !restoredSession && !isLoadingData && (
                <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-6 sm:p-10 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                        <PackageSearch className="w-7 h-7" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                        <h3 className="text-base font-extrabold text-slate-800">
                            Chưa nạp dữ liệu tồn kho mới
                        </h3>
                        <p className="text-xs text-slate-500">
                            Bạn đã có thể chọn Siêu thị phụ trách ở thanh bộ lọc phía trên để xem các lệnh đã lưu, hoặc tải lên file Excel để bắt đầu phân tích.
                        </p>
                    </div>

                    {/* THẺ TRẠNG THÁI SIÊU THỊ ĐANG CHỌN (NẾU ĐÃ CHỌN KHO) */}
                    {targetStore && (
                        <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200 rounded-xl p-4 max-w-lg mx-auto text-left space-y-2.5 shadow-2xs">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="p-1 rounded-md bg-blue-600 text-white">
                                        <Store className="w-3.5 h-3.5" />
                                    </span>
                                    <span className="text-xs font-black text-slate-800">
                                        {targetStore}
                                    </span>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white text-blue-700 border border-blue-200">
                                    {storageType === 'cloud' ? '🟢 Supabase Cloud' : '💾 LocalStorage'}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-white p-2 rounded-lg border border-blue-100 flex items-center justify-between">
                                    <span className="text-slate-500 text-[11px]">Hàng thiếu đã lưu:</span>
                                    <span className="font-mono font-bold text-blue-700">
                                        {Object.keys(itemCustomState).length} mã
                                    </span>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-blue-100 flex items-center justify-between">
                                    <span className="text-slate-500 text-[11px]">Lệnh xin đã tạo:</span>
                                    <span className="font-mono font-bold text-emerald-700">
                                        {savedOrdersCount} món
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1">
                                <span className="text-[11px] text-slate-500 truncate">
                                    {savedOrdersCount > 0
                                        ? `Đã tải ${savedOrdersCount} món hàng đã tạo lệnh xin gần nhất.`
                                        : 'Chưa có lệnh xin hàng nào được lưu.'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowHistoryModal(true)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer shrink-0"
                                >
                                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                                    <span>Lịch sử phiên</span>
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        {/* Nút nạp file tồn kho */}
                        <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-200 transition-all cursor-pointer">
                            <UploadCloud className="w-4 h-4" />
                            <span>Tải File Excel Tồn Kho</span>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(file);
                                }}
                            />
                        </label>

                        {/* Nút nạp file sức bán */}
                        <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl shadow-xs transition-all cursor-pointer">
                            <Flame className="w-4 h-4 text-amber-600 fill-amber-500" />
                            <span>{Object.keys(salesVelocityMap).length > 0 ? `Đã có sức bán (${Object.keys(salesVelocityMap).length} mã)` : 'Tải File Sức Bán'}</span>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleSalesFileUpload(file);
                                }}
                            />
                        </label>
                    </div>
                </div>
            )}

            {/* HIỂN THỊ NỘI DUNG THEO TỪNG BƯỚC QUY TRÌNH (KHI ĐÃ CÓ FILE HOẶC ĐÃ NẠP PHIÊN LƯU TRỮ) */}
            {(rawRecords.length > 0 || restoredSession !== null) && (
                <>
                    {/* BANNER THÔNG BÁO KHI ĐANG XEM PHIÊN KHÔI PHỤC (CHƯA NẠP FILE MỚI) */}
                    {rawRecords.length === 0 && restoredSession !== null && (
                        <div
                            data-export-ignore="true"
                            data-html2canvas-ignore="true"
                            className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                        >
                            <div className="flex items-center gap-2.5">
                                <span className="p-2 rounded-lg bg-blue-600 text-white shadow-xs shrink-0">
                                    <RotateCcw className="w-4 h-4" />
                                </span>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs sm:text-sm font-extrabold text-blue-950">
                                            Đang hiển thị phiên: {restoredSession.config_name || restoredSession.target_store}
                                        </span>
                                        <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                                            Khôi phục ngày {new Date(restoredSession.updated_at).toLocaleString('vi-VN')}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-blue-700 mt-0.5">
                                        Bao gồm <b>{displayShortageItems.length}</b> mã hàng thiếu và <b>{savedOrdersCount}</b> lệnh xin hàng. Bạn có thể xuất Excel, xuất ảnh, sao chép Zalo hoặc tải lên file Excel mới bất kỳ lúc nào.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 rounded-lg border border-blue-300 shadow-2xs transition-colors cursor-pointer">
                                    <UploadCloud className="w-3.5 h-3.5" />
                                    <span>Tải file Excel mới</span>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileUpload(file);
                                        }}
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setRestoredSession(null)}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-blue-100/60 rounded-lg transition-colors cursor-pointer"
                                    title="Đóng chế độ xem phiên đã khôi phục"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* BƯỚC 1: LỌC HÀNG THIẾU (< 1) */}
                    {activeStep === 1 && (
                        <ShortageSelectionStep
                            targetStore={targetStore}
                            items={displayShortageItems}
                            selectedCategories={activeCategories}
                            onSelectedCategoriesChange={setSelectedCategories}
                            selectedSubCategories={activeSubCategories}
                            onSelectedSubCategoriesChange={setSelectedSubCategories}
                            excludeKeywords={excludeKeywords}
                            onExcludeKeywordsChange={setExcludeKeywords}
                            onToggleSelect={handleToggleSelectShortage}
                            onSelectAll={handleSelectAllShortage}
                            onUpdateQuantity={handleUpdateQuantity}
                            onSaveConfig={handleSaveConfig}
                            onNextStep={() => setActiveStep(2)}
                            isSaving={isSavingConfig}
                            salesVelocityMap={salesVelocityMap}
                        />
                    )}

                    {/* BƯỚC 2: CẤU HÌNH NGUỒN DƯ (>= 2) */}
                    {activeStep === 2 && (
                        <SourceSupplyStep
                            targetStore={targetStore}
                            rawRecords={rawRecords}
                            sourceStoreFilter={sourceStoreFilter}
                            onSourceStoreFilterChange={setSourceStoreFilter}
                            minSourceQty={minSourceQty}
                            onMinSourceQtyChange={setMinSourceQty}
                            requestPercent={requestPercent}
                            onRequestPercentChange={setRequestPercent}
                            excludedStores={excludedStores}
                            onToggleExcludeStore={handleToggleExcludeStore}
                            onResetExcludedStores={handleResetExcludedStores}
                            onPrevStep={() => setActiveStep(1)}
                            onNextStep={() => setActiveStep(3)}
                        />
                    )}

                    {/* BƯỚC 3: KẾT HỢP GỢI Ý XIN HÀNG */}
                    {activeStep === 3 && (
                        <RebalanceSuggestionView
                            targetStore={targetStore}
                            matches={displayMatches}
                            groupedByStore={displayGroupedByStore}
                            minSourceQty={minSourceQty}
                            sourceStoreFilter={sourceStoreFilter}
                            requestPercent={requestPercent}
                            onRequestPercentChange={setRequestPercent}
                            orderedItemsMap={orderedItemsMap}
                            onToggleOrderedItem={handleToggleOrderedItem}
                            onBatchSetStoreOrdered={handleBatchSetStoreOrdered}
                            excludedStoreItemKeys={excludedStoreItemKeys}
                            onToggleExcludeStoreItem={handleToggleExcludeStoreItem}
                            storeCustomQtyMap={storeCustomQtyMap}
                            onChangeStoreItemQty={handleChangeStoreItemQty}
                            onSaveConfig={handleSaveConfig}
                            isSavingConfig={isSavingConfig}
                            onPrevStep={() => setActiveStep(2)}
                            onExportImage={handleExportImage}
                            onExportExcel={handleExportExcel}
                            canExportExcel={canExportExcel}
                            isExportingImage={isExportingImage}
                            reportCaptureRef={reportCaptureRef}
                            salesVelocityMap={salesVelocityMap}
                        />
                    )}
                </>
            )}

            {/* MODAL LỊCH SỬ CÁC PHIÊN XIN HÀNG */}
            <RebalanceSessionHistoryModal
                isOpen={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
                targetStore={targetStore}
                onApplySession={handleApplySession}
            />
        </div>
    );
}
