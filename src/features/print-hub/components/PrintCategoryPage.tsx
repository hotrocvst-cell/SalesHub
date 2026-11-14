import React from 'react';
import '../exactPrintFonts.css';
import CloudDataSyncStatusBanner from '../../../shared/components/report/CloudDataSyncStatusBanner';
import { ExactDecorTool } from './ExactDecorTool';
import { ExactPaperWorkspace } from './ExactPaperWorkspace';
import { PrintHubCatalogHeader } from './PrintHubCatalogHeader';
import { PrintPresetBar } from './PrintPresetBar';
import { QuickBatchFillBar } from './QuickBatchFillBar';
import { usePrintHubController } from '../hooks/usePrintHubController';
import { PRINT_PRESETS_SQL_DDL } from '../services/printPresetCloudService';
import type { PrintCategoryKey } from '../types';

export interface PrintCategoryPageProps {
  fixedCategory?: PrintCategoryKey;
  pageTitle?: string;
}

export const PrintCategoryPage: React.FC<PrintCategoryPageProps> = ({
  fixedCategory,
  pageTitle,
}) => {
  const c = usePrintHubController({ fixedCategory });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-2.5 pb-10 sm:p-4">
      <CloudDataSyncStatusBanner
        storageType={c.storageType}
        syncStatus="synced"
        tableReady={c.tableReady}
        tableName="sales_print_presets"
        sqlDdl={c.isAdmin ? PRINT_PRESETS_SQL_DDL : undefined}
        compact
      />

      <PrintHubCatalogHeader
        selectedStore={c.selectedStore}
        onStoreChange={c.setSelectedStore}
        allowedStores={c.allowedStores}
        isLockedToSingleStore={c.isLockedToSingleStore}
        canViewAllStores={c.canViewAllStores}
        activeCategory={c.activeCategory}
        fixedCategory={fixedCategory}
        pageTitle={pageTitle}
        activeTool={c.activeTool}
        activeVariantRel={c.activeVariantRel}
        searchQuery={c.searchQuery}
        onSearchChange={c.setSearchQuery}
        onSelectTool={c.selectTool}
        onSelectVariant={(rel, size) => {
          c.setActiveVariantRel(rel);
          c.setPaperSize(size || 'A4');
          c.setActivePresetId(null);
        }}
      />

      <PrintPresetBar
        presets={c.presets}
        activePresetId={c.activePresetId}
        saving={c.savingPreset}
        onSavePreset={c.handleSavePreset}
        onApplyPreset={c.handleApplyPreset}
        onDeletePreset={c.handleDeletePreset}
      />

      <ExactPaperWorkspace
        ref={c.paperHandleRef}
        title={c.activeTool.name}
        variantRel={c.activeVariantRel}
        scopedCss={c.scopedCss}
        renderedHtml={c.renderedHtml}
        paperSize={c.paperSize}
        onPaperSizeChange={c.setPaperSize}
        resetCounter={c.resetCounter}
        onResetDefault={() => {
          c.setActivePresetId(null);
          c.setResetCounter((prev) => prev + 1);
        }}
        fileNameBase={`${c.activeTool.id}_${c.activeStoreShort}`}
        onBatchStateReady={c.handleBatchStateReady}
        topControlsSlot={
          c.activeCategory === 'decor' ? (
            <ExactDecorTool
              toolId={c.activeToolId}
              ceilingVariant={c.decorCeilingVariant}
              cutoutGroup={c.decorCutoutGroup}
              cutoutVariant={c.decorCutoutVariant}
              copiesPerSheet={c.decorCopies}
              onCeilingChange={c.setDecorCeilingVariant}
              onCutoutGroupChange={c.setDecorCutoutGroup}
              onCutoutVariantChange={c.setDecorCutoutVariant}
              onCopiesChange={c.setDecorCopies}
            />
          ) : (
            <QuickBatchFillBar
              toolId={c.activeToolId}
              cardCount={c.cardCount}
              slots={c.batchSlots}
              syncAllCards={c.syncAllCards}
              onToggleSyncAll={() => c.setSyncAllCards((prev) => !prev)}
              onSlotChange={c.handleBatchSlotChange}
              storeEmployeeCount={c.storeEmployees.length}
              onLoadStoreEmployees={() => c.paperHandleRef.current?.fillEmployees(c.storeEmployees)}
              bagRows={c.bagRows}
              onBagRowsChange={c.setBagRows}
            />
          )
        }
      />
    </div>
  );
};

