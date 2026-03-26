import type { ExtractColumn, ExtractSortDirection } from './types';

interface ExtractWorkspaceToolbarProps {
  extractColumns: readonly ExtractColumn[];
  extractColumnFilterKey: string;
  extractSearchTerm: string;
  extractSortKey: string;
  extractSortDirection: ExtractSortDirection;
  extractPageSize: number;
  onColumnFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSortKeyChange: (value: string) => void;
  onSortDirectionToggle: () => void;
  onPageSizeChange: (value: number) => void;
  onResetGrid: () => void;
}

export default function ExtractWorkspaceToolbar({
  extractColumns,
  extractColumnFilterKey,
  extractSearchTerm,
  extractSortKey,
  extractSortDirection,
  extractPageSize,
  onColumnFilterChange,
  onSearchChange,
  onSortKeyChange,
  onSortDirectionToggle,
  onPageSizeChange,
  onResetGrid,
}: ExtractWorkspaceToolbarProps) {
  const activeColumnLabel = extractColumns.find((column) => column.key === extractColumnFilterKey)?.label ?? 'columna';

  return (
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
            placeholder={`Buscar en ${extractColumnFilterKey === 'all' ? 'todas las columnas' : activeColumnLabel}...`}
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
  );
}
