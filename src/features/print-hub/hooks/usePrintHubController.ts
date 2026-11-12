import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchEmployees, fetchStores } from '../../../core/lib/storage';
import type { EmployeeItem, StoreItem } from '../../../core/lib/storage';
import {
  formatStoreDisplayName,
  getShortStoreName,
  isStoreMatch,
} from '../../../core/lib/formatters';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { useUserStoreFilter } from '../../../shared/hooks/useUserStoreFilter';
import { DECOR_CEILING_FILES, DECOR_CUTOUT_GROUPS } from '../data/decorCatalog';
import { PRINT_TOOLS_CATALOG, getExactTemplateByRel } from '../data/printCatalog';
import {
  deletePrintPreset,
  fetchStorePrintPresets,
  upsertPrintPreset,
} from '../services/printPresetCloudService';
import type {
  BagQrRow,
  PaperSize,
  PrintCategoryKey,
  PrintPresetPayload,
  PrintPresetRecord,
} from '../types';
import {
  BAG_PRESET_ALL_COUNTERS,
  renderBagCodeSheetHtml,
} from '../utils/bagCodeSheetBuilder';
import { injectStorePlaceholders, type BatchFieldSlot } from '../utils/exactSheetEngine';
import type { ExactPaperHandle } from '../components/ExactPaperWorkspace';

export function usePrintHubController() {
  const { currentUser, isAdmin } = useAuth();
  const paperHandleRef = useRef<ExactPaperHandle | null>(null);

  const [stores, setStores] = useState<StoreItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('all');

  const { allowedStores, isLockedToSingleStore, canViewAllStores } = useUserStoreFilter(
    stores,
    selectedStore,
    setSelectedStore
  );

  const [activeCategory, setActiveCategory] = useState<PrintCategoryKey>('sticker');
  const [activeToolId, setActiveToolId] = useState<string>('stk_ptg');
  const [activeVariantRel, setActiveVariantRel] = useState<string>('in-sticker/in-ptg-6s.html');
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [searchQuery, setSearchQuery] = useState('');

  const [syncAllCards, setSyncAllCards] = useState(true);
  const [batchSlots, setBatchSlots] = useState<BatchFieldSlot[]>([]);
  const [cardCount, setCardCount] = useState(0);
  const [resetCounter, setResetCounter] = useState(0);

  const [bagRows, setBagRows] = useState<BagQrRow[]>(() => [...BAG_PRESET_ALL_COUNTERS]);
  const [bagSheetHtml, setBagSheetHtml] = useState('');

  const [decorCeilingVariant, setDecorCeilingVariant] = useState(1);
  const [decorCutoutGroup, setDecorCutoutGroup] = useState<'hoa' | 'sao' | 'ong' | 'buom'>('hoa');
  const [decorCutoutVariant, setDecorCutoutVariant] = useState(1);
  const [decorCopies, setDecorCopies] = useState<1 | 2>(1);

  const [presets, setPresets] = useState<PrintPresetRecord[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [storageType, setStorageType] = useState<'cloud' | 'local'>('cloud');
  const [tableReady, setTableReady] = useState(true);
  const [savingPreset, setSavingPreset] = useState(false);

  useEffect(() => {
    Promise.all([fetchStores(), fetchEmployees()])
      .then(([s, e]) => {
        setStores(Array.isArray(s) ? s : s?.data || []);
        setEmployees(Array.isArray(e) ? e : e?.data || []);
      })
      .catch(() => {
        setStores([]);
        setEmployees([]);
      });
  }, []);

  const activeStoreFull = useMemo(() => {
    if (!selectedStore || selectedStore === 'all') {
      return allowedStores[0] ? formatStoreDisplayName(allowedStores[0].name) : 'CỬA HÀNG ST';
    }
    return formatStoreDisplayName(selectedStore);
  }, [selectedStore, allowedStores]);

  const activeStoreShort = useMemo(() => getShortStoreName(activeStoreFull), [activeStoreFull]);

  const storeEmployees = useMemo(() => {
    const active = employees.filter((e) => e.is_active !== false && e.status !== 'inactive');
    if (!selectedStore || selectedStore === 'all') return active;
    return active.filter((e) => isStoreMatch(e.store_name, selectedStore, stores));
  }, [employees, selectedStore, stores]);

  const activeTool = useMemo(
    () => PRINT_TOOLS_CATALOG.find((t) => t.id === activeToolId) || PRINT_TOOLS_CATALOG[0],
    [activeToolId]
  );

  const selectTool = useCallback((toolId: string) => {
    const found = PRINT_TOOLS_CATALOG.find((t) => t.id === toolId);
    if (!found) return;
    setActiveToolId(found.id);
    setActiveCategory(found.category);
    const firstVar = found.variants[0];
    if (firstVar) {
      setActiveVariantRel(firstVar.rel);
      setPaperSize(firstVar.paperSize || 'A4');
    }
    setActivePresetId(null);
  }, []);

  useEffect(() => {
    if (activeToolId !== 'wrk_codetui') return;
    let cancelled = false;
    void renderBagCodeSheetHtml(bagRows).then((html) => {
      if (!cancelled) setBagSheetHtml(html);
    });
    return () => {
      cancelled = true;
    };
  }, [activeToolId, bagRows]);

  const loadPresets = useCallback(async () => {
    const res = await fetchStorePrintPresets(selectedStore || 'all', activeToolId);
    setPresets(res.data);
    setStorageType(res.storageType);
    setTableReady(res.tableReady);
  }, [selectedStore, activeToolId]);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  const exactTemplate = useMemo(
    () => getExactTemplateByRel(activeVariantRel),
    [activeVariantRel]
  );

  const { scopedCss, renderedHtml } = useMemo(() => {
    if (activeCategory === 'decor') {
      const file =
        activeToolId === 'dec_ceiling'
          ? DECOR_CEILING_FILES.find((f) => f.variant === decorCeilingVariant) || DECOR_CEILING_FILES[0]
          : (DECOR_CUTOUT_GROUPS[decorCutoutGroup]?.files || []).find(
              (f) => f.num === decorCutoutVariant
            ) || DECOR_CUTOUT_GROUPS.hoa.files[0];

      const decorCss =
        decorCopies === 2
          ? '#sal-print-paper .decor-wrap { display:grid; grid-template-rows:1fr 1fr; height:1055px; gap:10px; } #sal-print-paper .decor-cell { display:flex; align-items:center; justify-content:center; border:1px dashed #cbd5e1; overflow:hidden; } #sal-print-paper img { max-width:100%; max-height:100%; object-fit:contain; }'
          : '#sal-print-paper .decor-wrap { display:flex; align-items:center; justify-content:center; height:1055px; } #sal-print-paper img { max-width:100%; max-height:100%; object-fit:contain; }';

      const decorHtml =
        decorCopies === 2
          ? `<div class="decor-wrap"><div class="decor-cell"><img src="${file.src}" alt="Trang trí ST" /></div><div class="decor-cell"><img src="${file.src}" alt="Trang trí ST" /></div></div>`
          : `<div class="decor-wrap"><img src="${file.src}" alt="Trang trí ST" /></div>`;
      return { scopedCss: decorCss, renderedHtml: decorHtml };
    }

    const baseHtml = exactTemplate?.html || '';
    const htmlWithData =
      activeToolId === 'wrk_codetui'
        ? bagSheetHtml
        : injectStorePlaceholders(baseHtml, activeStoreShort, activeStoreFull);

    return { scopedCss: exactTemplate?.css || '', renderedHtml: htmlWithData };
  }, [
    activeCategory,
    activeToolId,
    decorCeilingVariant,
    decorCutoutGroup,
    decorCutoutVariant,
    decorCopies,
    exactTemplate,
    bagSheetHtml,
    activeStoreShort,
    activeStoreFull,
  ]);

  const handleBatchStateReady = useCallback((slots: BatchFieldSlot[], count: number) => {
    setBatchSlots(slots);
    setCardCount(count);
  }, []);

  const handleBatchSlotChange = (slotIdx: number, nextValue: string) => {
    setBatchSlots((prev) =>
      prev.map((s) => (s.slotIdx === slotIdx ? { ...s, value: nextValue } : s))
    );
    paperHandleRef.current?.applyBatchSlot(slotIdx, nextValue, syncAllCards);
  };

  const handleSavePreset = async (presetName: string) => {
    setSavingPreset(true);
    const basePayload: PrintPresetPayload = {
      variantRel: activeVariantRel,
      paperSize,
      bagRows: activeToolId === 'wrk_codetui' ? bagRows : undefined,
      decorVariant: activeToolId === 'dec_ceiling' ? decorCeilingVariant : decorCutoutVariant,
      decorGroup: activeToolId === 'dec_cutouts' ? decorCutoutGroup : undefined,
      decorCopies: activeCategory === 'decor' ? decorCopies : undefined,
    };
    const finalPayload = paperHandleRef.current
      ? paperHandleRef.current.captureSnapshot(basePayload)
      : basePayload;

    const res = await upsertPrintPreset({
      storeName: selectedStore || 'all',
      toolId: activeToolId,
      presetName,
      paperSize,
      configJson: finalPayload,
      createdBy: currentUser?.full_name || currentUser?.employee_id || '',
    });
    setStorageType(res.storageType);
    setTableReady(res.tableReady);
    setActivePresetId(res.record.id);
    setSavingPreset(false);
    await loadPresets();
  };

  const handleApplyPreset = (preset: PrintPresetRecord) => {
    setActivePresetId(preset.id);
    const p = preset.config_json;
    if (p.variantRel) setActiveVariantRel(p.variantRel);
    setPaperSize(p.paperSize || preset.paper_size || 'A4');
    if (p.bagRows) setBagRows(p.bagRows);
    if (p.decorGroup) setDecorCutoutGroup(p.decorGroup);
    if (p.decorVariant) {
      if (activeToolId === 'dec_ceiling') setDecorCeilingVariant(p.decorVariant);
      else setDecorCutoutVariant(p.decorVariant);
    }
    if (p.decorCopies) setDecorCopies(p.decorCopies);
    setTimeout(() => paperHandleRef.current?.applySnapshot(p), 60);
  };

  const handleDeletePreset = async (preset: PrintPresetRecord) => {
    await deletePrintPreset(preset.id, selectedStore || 'all');
    if (activePresetId === preset.id) setActivePresetId(null);
    await loadPresets();
  };

  return {
    isAdmin,
    paperHandleRef,
    allowedStores,
    isLockedToSingleStore,
    canViewAllStores,
    selectedStore,
    setSelectedStore,
    activeStoreShort,
    storeEmployees,
    activeCategory,
    activeToolId,
    activeTool,
    activeVariantRel,
    setActiveVariantRel,
    paperSize,
    setPaperSize,
    searchQuery,
    setSearchQuery,
    selectTool,
    syncAllCards,
    setSyncAllCards,
    batchSlots,
    cardCount,
    resetCounter,
    setResetCounter,
    bagRows,
    setBagRows,
    decorCeilingVariant,
    setDecorCeilingVariant,
    decorCutoutGroup,
    setDecorCutoutGroup,
    decorCutoutVariant,
    setDecorCutoutVariant,
    decorCopies,
    setDecorCopies,
    presets,
    activePresetId,
    setActivePresetId,
    storageType,
    tableReady,
    savingPreset,
    scopedCss,
    renderedHtml,
    handleBatchStateReady,
    handleBatchSlotChange,
    handleSavePreset,
    handleApplyPreset,
    handleDeletePreset,
  };
}

