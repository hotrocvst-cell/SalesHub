export const DECOR_CEILING_FILES = [1, 2, 3, 4].map((variant) => ({
  variant,
  label: `Dây treo trần Mẫu 0${variant}`,
  src: `/print-assets/decor/bgframe-treo-tran-0${variant}.png`,
}));

export const DECOR_CUTOUT_GROUPS: Record<
  'hoa' | 'sao' | 'ong' | 'buom',
  { label: string; files: Array<{ num: number; src: string }> }
> = {
  hoa: {
    label: 'Bông hoa (01–05)',
    files: [1, 2, 3, 4, 5].map((num) => ({
      num,
      src: `/print-assets/decor/bgframe-hoa-0${num}.png`,
    })),
  },
  sao: {
    label: 'Ngôi sao (01–04)',
    files: [1, 2, 3, 4].map((num) => ({
      num,
      src: `/print-assets/decor/bgframe-sao-0${num}.jpg`,
    })),
  },
  ong: {
    label: 'Chú Ong (01–07)',
    files: [1, 2, 3, 4, 5, 6, 7].map((num) => ({
      num,
      src: `/print-assets/decor/bgframe-ong-0${num}.${num <= 4 ? 'png' : 'jpg'}`,
    })),
  },
  buom: {
    label: 'Cánh Bướm (01–08)',
    files: [1, 2, 3, 4, 5, 6, 7, 8].map((num) => ({
      num,
      src: `/print-assets/decor/bgframe-buom-0${num}.${num <= 2 ? 'png' : 'jpg'}`,
    })),
  },
};

