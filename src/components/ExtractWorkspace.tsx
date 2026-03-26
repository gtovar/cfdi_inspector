interface ExtractColumn {
  key: string;
  label: string;
}

type ExtractMode = 'ingresos' | 'pagos';
type ExtractSortDirection = 'asc' | 'desc';

interface ExtractWorkspaceProps {
  embedded?: boolean;
  activeDatasetType: ExtractMode;
  extractColumns: readonly ExtractColumn[];
  extractColumnFilterKey: string;
  extractSearchTerm: string;
  extractSortKey: string;
  extractSortDirection: ExtractSortDirection;
  extractPageSize: number;
  activeHiddenColumns: string[];
  visibleExtractColumns: readonly ExtractColumn[];
  filteredExtractCount: number;
  safeExtractPage: number;
  extractTotalPages: number;
  extractPageStart: number;
  currentPageRows: Record<string, string>[];
  getExtractCellValue: (row: Record<string, string>, key: string) => string;
  onColumnFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSortKeyChange: (value: string) => void;
  onSortDirectionToggle: () => void;
  onPageSizeChange: (value: number) => void;
  onResetGrid: () => void;
  onToggleColumn: (columnKey: string, hidden: boolean) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export default function ExtractWorkspace({
  embedded = false,
  activeDatasetType,
  extractColumns,
  extractColumnFilterKey,
  extractSearchTerm,
  extractSortKey,
  extractSortDirection,
  extractPageSize,
  activeHiddenColumns,
  visibleExtractColumns,
  filteredExtractCount,
  safeExtractPage,
  extractTotalPages,
  extractPageStart,
  currentPageRows,
  getExtractCellValue,
  onColumnFilterChange,
  onSearchChange,
  onSortKeyChange,
  onSortDirectionToggle,
  onPageSizeChange,
  onResetGrid,
  onToggleColumn,
  onPrevPage,
  onNextPage,
}: ExtractWorkspaceProps) {
  return (
    <section className={embedded ? 'flex-1 min-h-0 border-t border-[#141414] bg-white/10 flex flex-col' : 'flex-1 flex flex-col overflow-hidden relative'}>
      {embedded ? null : (
        <div className="grid grid-cols-3 border-b border-[#141414]">
          <div className="p-4 border-r border-[#141414]">
            <p className="text-[10px] font-mono uppercase opacity-50">
              {activeDatasetType === 'ingresos' ? 'Unidad de lectura' : 'Unidad de extracción'}
            </p>
            <p className="text-xs font-bold mt-1">
              {activeDatasetType === 'ingresos' ? 'Una fila por concepto e impuesto' : 'Una fila por documento relacionado e impuesto DR'}
            </p>
          </div>
          <div className="p-4 border-r border-[#141414]">
            <p className="text-[10px] font-mono uppercase opacity-50">Origen</p>
            <p className="text-xs font-bold mt-1">
              {activeDatasetType === 'ingresos' ? 'Conceptos / Traslados / Retenciones' : 'Pago / DoctoRelacionado / DR'}
            </p>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-mono uppercase opacity-50">Vista</p>
            <p className="text-xs font-bold mt-1">Grid paginada sobre dataset completo</p>
          </div>
        </div>
      )}

      <div className="p-4 border-b border-[#141414] flex items-center justify-between bg-white/50">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-70">
            <span>Buscar en</span>
            <select
              value={extractColumnFilterKey}
              onChange={(e) => onColumnFilterChange(e.target.value)}
              className="border border-[#141414]/20 bg-transparent px-2 py-2 text-[10px] font-mono"
            >
              <option value="all">Todas</option>
              {extractColumns.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
          <div className="relative w-80">
            <input
              type="text"
              placeholder={`Buscar en ${extractColumnFilterKey === 'all' ? 'todas las columnas' : extractColumns.find((column) => column.key === extractColumnFilterKey)?.label ?? 'columna'}...`}
              className="w-full pl-9 pr-4 py-2 text-xs font-mono bg-transparent border border-[#141414]/20 focus:border-[#141414] outline-none transition-colors"
              value={extractSearchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-70">
            <span>Ordenar por</span>
            <select
              value={extractSortKey}
              onChange={(e) => onSortKeyChange(e.target.value)}
              className="border border-[#141414]/20 bg-transparent px-2 py-2 text-[10px] font-mono"
            >
              {extractColumns.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={onSortDirectionToggle}
            className="border border-[#141414]/20 px-3 py-2 text-[10px] font-mono uppercase tracking-widest hover:border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
          >
            {extractSortDirection === 'asc' ? 'Asc' : 'Desc'}
          </button>
          <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-70">
            <span>Filas por pagina</span>
            <select
              value={extractPageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="border border-[#141414]/20 bg-transparent px-2 py-2 text-[10px] font-mono"
            >
              {[50, 100, 250, 500, 1000].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={onResetGrid}
            className="border border-[#141414]/20 px-3 py-2 text-[10px] font-mono uppercase tracking-widest hover:border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
          >
            Reset grid
          </button>
        </div>
      </div>

      <div className="border-b border-[#141414]/10 bg-[#E4E3E0] px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest opacity-45">Columnas</span>
          {extractColumns.map((column) => {
            const hidden = activeHiddenColumns.includes(column.key);
            return (
              <button
                key={column.key}
                onClick={() => onToggleColumn(column.key, hidden)}
                className={`px-2.5 py-1 border text-[10px] font-mono uppercase tracking-widest transition-colors ${
                  hidden
                    ? 'border-[#141414]/10 text-[#141414]/35 bg-white/50'
                    : 'border-[#141414]/25 bg-[#141414] text-[#E4E3E0]'
                }`}
              >
                {column.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {visibleExtractColumns.length === 0 ? (
          <div className="p-16 text-center text-xs font-mono opacity-45">
            Todas las columnas estan ocultas. Usa los toggles de columnas o `Reset grid`.
          </div>
        ) : filteredExtractCount > 0 ? (
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
        ) : (
          <div className="p-16 text-center text-xs font-mono opacity-45">
            {activeDatasetType === 'ingresos'
              ? 'No hay registros de ingresos para mostrar con el filtro actual.'
              : 'No hay registros de pagos para mostrar con el filtro actual.'}
          </div>
        )}
      </div>
      <div className="p-4 border-t border-[#141414] bg-white/95 backdrop-blur-sm flex items-center justify-between shrink-0">
        <div className="flex flex-col">
          <p className="text-[10px] font-mono uppercase tracking-widest opacity-50">
            Pagina {safeExtractPage} de {extractTotalPages}
          </p>
          <p className="text-[10px] font-mono opacity-60 mt-1">
            {filteredExtractCount === 0
              ? 'Registros 0 de 0'
              : `Registros ${extractPageStart + 1}-${Math.min(extractPageStart + currentPageRows.length, filteredExtractCount)} de ${filteredExtractCount}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevPage}
            disabled={safeExtractPage === 1}
            className="px-3 py-2 border border-[#141414]/20 text-[10px] font-mono uppercase tracking-widest disabled:opacity-30 hover:border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
          >
            Anterior
          </button>
          <button
            onClick={onNextPage}
            disabled={safeExtractPage === extractTotalPages}
            className="px-3 py-2 border border-[#141414]/20 text-[10px] font-mono uppercase tracking-widest disabled:opacity-30 hover:border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
          >
            Siguiente
          </button>
        </div>
      </div>
    </section>
  );
}
