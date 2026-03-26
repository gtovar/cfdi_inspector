import { useEffect, useMemo, useState } from 'react';
import type { CFDIIngresoRow, CFDIPagoRow } from '../../cfdi/public';

export type ExtractMode = 'ingresos' | 'pagos';
export type ExtractSortDirection = 'asc' | 'desc';

export interface ExtractColumn {
  key: string;
  label: string;
}

function getExtractCellValue(row: Record<string, string>, key: string) {
  return row[key] ?? '';
}

function asRecord(row: CFDIIngresoRow | CFDIPagoRow): Record<string, string> {
  return row as unknown as Record<string, string>;
}

export function useExtractGridState(params: {
  activeDatasetType: ExtractMode;
  ingresoRows: CFDIIngresoRow[];
  pagoRows: CFDIPagoRow[];
  extractColumns: readonly ExtractColumn[];
}) {
  const { activeDatasetType, ingresoRows, pagoRows, extractColumns } = params;
  const [extractSearchTerm, setExtractSearchTerm] = useState('');
  const [extractColumnFilterKey, setExtractColumnFilterKey] = useState<string>('all');
  const [extractPage, setExtractPage] = useState(1);
  const [extractPageSize, setExtractPageSize] = useState(100);
  const [extractSortKey, setExtractSortKey] = useState<string>('descripcion');
  const [extractSortDirection, setExtractSortDirection] = useState<ExtractSortDirection>('asc');
  const [hiddenIngresoColumns, setHiddenIngresoColumns] = useState<string[]>([]);
  const [hiddenPagoColumns, setHiddenPagoColumns] = useState<string[]>([]);

  const activeExtractBaseRows = activeDatasetType === 'ingresos' ? ingresoRows : pagoRows;
  const activeHiddenColumns = activeDatasetType === 'ingresos' ? hiddenIngresoColumns : hiddenPagoColumns;
  const visibleExtractColumns = extractColumns.filter((column) => !activeHiddenColumns.includes(column.key));

  const filteredExtractRows = activeExtractBaseRows.filter((row) => {
    const search = extractSearchTerm.trim().toLowerCase();
    if (!search) return true;

    if (extractColumnFilterKey === 'all') {
      return Object.values(row).some((value) => String(value).toLowerCase().includes(search));
    }

    return getExtractCellValue(asRecord(row), extractColumnFilterKey).toLowerCase().includes(search);
  });

  const sortedExtractRows = useMemo(() => {
    const rows = [...filteredExtractRows];
    rows.sort((left, right) => {
      const leftValue = getExtractCellValue(asRecord(left), extractSortKey).toLowerCase();
      const rightValue = getExtractCellValue(asRecord(right), extractSortKey).toLowerCase();

      const leftNumber = Number(leftValue);
      const rightNumber = Number(rightValue);
      const bothNumeric = !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && leftValue !== '' && rightValue !== '';

      if (bothNumeric) {
        return extractSortDirection === 'asc' ? leftNumber - rightNumber : rightNumber - leftNumber;
      }

      const comparison = leftValue.localeCompare(rightValue, 'es', { numeric: true, sensitivity: 'base' });
      return extractSortDirection === 'asc' ? comparison : -comparison;
    });
    return rows;
  }, [filteredExtractRows, extractSortDirection, extractSortKey]);

  const filteredExtractCount = sortedExtractRows.length;
  const extractTotalPages = Math.max(1, Math.ceil(filteredExtractCount / extractPageSize));
  const safeExtractPage = Math.min(extractPage, extractTotalPages);
  const extractPageStart = filteredExtractCount === 0 ? 0 : (safeExtractPage - 1) * extractPageSize;
  const currentPageRows = sortedExtractRows.slice(extractPageStart, extractPageStart + extractPageSize);

  useEffect(() => {
    if (extractPage > extractTotalPages) {
      setExtractPage(extractTotalPages);
    }
  }, [extractPage, extractTotalPages]);

  function resetForNewAnalysis(nextProfile: ExtractMode) {
    setExtractSearchTerm('');
    setExtractColumnFilterKey('all');
    setExtractPage(1);
    setExtractPageSize(100);
    setExtractSortKey(nextProfile === 'pagos' ? 'fechaPago' : 'descripcion');
    setExtractSortDirection('asc');
    setHiddenIngresoColumns([]);
    setHiddenPagoColumns([]);
  }

  function resetGrid() {
    setExtractSearchTerm('');
    setExtractColumnFilterKey('all');
    setExtractPage(1);
    setExtractPageSize(100);
    setExtractSortKey(activeDatasetType === 'pagos' ? 'fechaPago' : 'descripcion');
    setExtractSortDirection('asc');
    if (activeDatasetType === 'ingresos') {
      setHiddenIngresoColumns([]);
    } else {
      setHiddenPagoColumns([]);
    }
  }

  function toggleColumn(columnKey: string, hidden: boolean) {
    if (activeDatasetType === 'ingresos') {
      setHiddenIngresoColumns((current) =>
        hidden ? current.filter((key) => key !== columnKey) : [...current, columnKey],
      );
      return;
    }

    setHiddenPagoColumns((current) =>
      hidden ? current.filter((key) => key !== columnKey) : [...current, columnKey],
    );
  }

  function resetAll() {
    setExtractSearchTerm('');
    setExtractColumnFilterKey('all');
    setExtractPage(1);
    setExtractPageSize(100);
    setExtractSortKey('descripcion');
    setExtractSortDirection('asc');
    setHiddenIngresoColumns([]);
    setHiddenPagoColumns([]);
  }

  return {
    extractSearchTerm,
    setExtractSearchTerm,
    extractColumnFilterKey,
    setExtractColumnFilterKey,
    extractPage,
    setExtractPage,
    extractPageSize,
    setExtractPageSize,
    extractSortKey,
    setExtractSortKey,
    extractSortDirection,
    setExtractSortDirection,
    hiddenIngresoColumns,
    hiddenPagoColumns,
    activeHiddenColumns,
    visibleExtractColumns,
    filteredExtractRows,
    sortedExtractRows,
    filteredExtractCount,
    extractTotalPages,
    safeExtractPage,
    extractPageStart,
    currentPageRows,
    getExtractCellValue,
    resetForNewAnalysis,
    resetGrid,
    toggleColumn,
    resetAll,
  };
}
