export interface InventoryRawRecord {
    store_name: string;
    product_code: string;
    product_name: string;
    category: string;
    sub_category: string;
    product_status: string;
    available_qty: number;
    unit?: string;
    model_code?: string;
}

export interface ShortageProductItem {
    id: string; // unique key: store_name + '_' + product_code
    store_name: string;
    product_code: string;
    product_name: string;
    category: string;
    sub_category: string;
    product_status: string;
    available_qty: number; // < 1 (0 or negative)
    unit?: string;
    model_code?: string;
    isSelected: boolean;
    request_qty: number; // default 1
    note?: string;
}

export interface SourceStoreItem {
    store_name: string;
    available_qty: number;
    can_request_qty: number; // Tỷ lệ % (mặc định 30%) số tồn kho của sản phẩm theo kho cần xin
    suggested_qty?: number;
}

export interface RebalanceMatchItem {
    product_code: string;
    product_name: string;
    category: string;
    sub_category: string;
    product_status: string;
    target_store: string;
    current_qty: number;
    needed_qty: number;
    source_stores: SourceStoreItem[];
    total_source_available: number;
    hasSource: boolean;
}

export interface StoreGroupedSupply {
    store_name: string;
    total_matched_products: number;
    total_available_qty: number;
    total_suggested_qty?: number;
    items: Array<{
        product_code: string;
        product_name: string;
        category: string;
        sub_category: string;
        product_status: string;
        available_qty: number;
        needed_qty: number;
        suggested_qty?: number;
    }>;
}

export interface OrderedItemRecord {
    is_ordered: boolean;
    ordered_at: string;
    note?: string;
}

export interface SnapshotProductItem {
    product_code: string;
    product_name: string;
    category?: string;
    sub_category?: string;
    product_status?: string;
    unit?: string;
    model_code?: string;
    request_qty?: number;
}

export interface SnapshotSupplyMatch {
    product_code: string;
    source_stores: Array<{
        store_name: string;
        available_qty: number;
        can_request_qty: number;
    }>;
}

export interface ProductSalesVelocity {
    product_code: string;
    product_name?: string;
    sales_qty: number;     // Tổng số lượng bán (tổng cột AJ thỏa điều kiện: N='Đã xuất' & AS='Chưa trả')
    order_count?: number;  // Số lần/đơn xuất bán
}

export interface InventoryBalancingSavedConfig {
    id?: string;
    target_store: string;
    config_name: string;
    selected_product_codes: string[];
    request_qtys: Record<string, number>;
    source_store_filter: string;
    min_source_qty: number;
    request_percent?: number; // Tỷ lệ % cần xin theo tồn kho nguồn (mặc định 30%)
    excluded_source_stores?: string[];
    selected_categories?: string[];
    selected_sub_categories?: string[];
    ordered_items?: Record<string, OrderedItemRecord>; // key: `${source_store}__${product_code}`
    excluded_store_item_keys?: Record<string, boolean>; // key: `${source_store}__${product_code}`
    store_custom_qtys?: Record<string, number>; // key: `${source_store}__${product_code}`
    exclude_keywords?: string; // Từ khóa loại trừ sản phẩm trong Bước 1
    snapshot_products?: SnapshotProductItem[]; // Ảnh chụp danh sách sản phẩm hàng thiếu
    snapshot_matches?: SnapshotSupplyMatch[]; // Ảnh chụp danh sách gợi ý siêu thị nguồn
    raw_records_count?: number; // Tổng số dòng dữ liệu kho tại thời điểm lưu
    sales_velocity_map?: Record<string, ProductSalesVelocity>; // Bản đồ sức bán sản phẩm
    sales_velocity_file_name?: string;
    updated_at: string;
}


