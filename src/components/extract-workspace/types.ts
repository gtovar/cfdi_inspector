import type { ColumnFiltersState, SortingState, Table } from '@tanstack/react-table';

export interface ExtractColumn {
  key: string;
  label: string;
}

export type ExtractMode = 'ingresos' | 'pagos';
export type ExtractSortDirection = 'asc' | 'desc';

export interface ExtractGridController {
  extractColumns: readonly ExtractColumn[];
  activeHiddenColumns: string[];
  columnOrder: string[];
  columnFilters: ColumnFiltersState;
  extractColumnFilterKey: string;
  extractSearchTerm: string;
  sorting: SortingState;
  extractPageSize: number;
  filteredExtractCount: number;
  safeExtractPage: number;
  extractTotalPages: number;
  extractPageStart: number;
  selectedRowCount: number;
  allPageRowsSelected: boolean;
  table: Table<Record<string, string>>;
  setColumnFilterKey: (value: string) => void;
  setColumnFilterValue: (columnKey: string, value: string) => void;
  setSearchTerm: (value: string) => void;
  setSorting: (value: SortingState) => void;
  setSortKey: (value: string) => void;
  toggleSortDirection: () => void;
  setPageSize: (value: number) => void;
  resetGrid: () => void;
  toggleColumn: (columnKey: string, hidden: boolean) => void;
  moveColumn: (columnKey: string, direction: 'left' | 'right') => void;
  toggleAllPageRowsSelected: () => void;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
}
