export type Row = Record<string, any>;
export type Page = {
  items: Row[];
  total: number;
  offset: number;
  limit: number;
};
export const emptyPage: Page = { items: [], total: 0, offset: 0, limit: 100 };
