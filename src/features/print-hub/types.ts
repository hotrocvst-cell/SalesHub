export type PrintCategoryKey = 'sticker' | 'popup' | 'sales' | 'work' | 'decor';

export type PaperSize = 'A4' | 'A5';

export interface PrintTemplateVariant {
  label: string;
  rel: string;
  paperSize?: PaperSize;
}

export interface PrintToolMeta {
  id: string;
  category: PrintCategoryKey;
  name: string;
  shortDesc: string;
  variants: PrintTemplateVariant[];
}

export interface ExactTemplateEntry {
  rel: string;
  title: string;
  css: string;
  html: string;
}

export interface BagQrRow {
  code: string;
  name: string;
}

export interface PrintPresetPayload {
  variantRel: string;
  paperSize: PaperSize;
  inputValues?: string[];
  checkboxStates?: boolean[];
  editableHtmls?: string[];
  bagRows?: BagQrRow[];
  decorVariant?: number;
  decorGroup?: 'hoa' | 'sao' | 'ong' | 'buom';
  decorCopies?: 1 | 2;
}

export interface PrintPresetRecord {
  id: string;
  store_name: string;
  tool_id: string;
  preset_name: string;
  paper_size: PaperSize;
  config_json: PrintPresetPayload;
  created_by?: string;
  updated_at?: string;
}
