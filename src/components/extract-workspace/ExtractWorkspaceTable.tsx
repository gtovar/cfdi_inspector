import type { ExtractColumn, ExtractMode } from './types';

interface ExtractWorkspaceTableProps {
  activeDatasetType: ExtractMode;
  visibleExtractColumns: readonly ExtractColumn[];
  filteredExtractCount: number;
  extractPageStart: number;
  currentPageRows: Record<string, string>[];
  getExtractCellValue: (row: Record<string, string>, key: string) => string;
}

export default function ExtractWorkspaceTable({
  activeDatasetType,
  visibleExtractColumns,
  filteredExtractCount,
  extractPageStart,
  currentPageRows,
  getExtractCellValue,
}: ExtractWorkspaceTableProps) {
  if (visibleExtractColumns.length === 0) {
    return (
      <div className="p-16 text-center text-xs font-mono opacity-45">
        Todas las columnas estan ocultas. Usa los toggles de columnas o `Reset grid`.
      </div>
    );
  }

  if (filteredExtractCount === 0) {
    return (
      <div className="p-16 text-center text-xs font-mono opacity-45">
        {activeDatasetType === 'ingresos'
          ? 'No hay registros de ingresos para mostrar con el filtro actual.'
          : 'No hay registros de pagos para mostrar con el filtro actual.'}
      </div>
    );
  }

  return (
    <table className="w-full border-collapse">
      <thead className="sticky top-0 bg-[#E4E3E0] z-10 border-b border-[#141414]/10">
        <tr className="text-left text-[10px] font-mono uppercase opacity-50">
          {visibleExtractColumns.map((column) => (
            <th key={column.key} className="px-3 py-2 font-normal whitespace-nowrap">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {currentPageRows.map((row, index) => (
          <tr
            key={`${activeDatasetType}-${extractPageStart + index}`}
            className="border-b border-[#141414]/10 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
          >
            {visibleExtractColumns.map((column) => (
              <td
                key={column.key}
                className={`px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis ${
                  column.key === 'descripcion' ? 'text-[11px] max-w-[320px]' : 'text-[9px] font-mono max-w-[240px]'
                }`}
              >
                {getExtractCellValue(row, column.key) || '-'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
