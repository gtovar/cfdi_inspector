import type { ExtractGridController } from './types';

interface ExtractWorkspaceToolbarProps {
  grid: ExtractGridController;
}

export default function ExtractWorkspaceToolbar({ grid }: ExtractWorkspaceToolbarProps) {
  const {
    extractColumns,
    extractColumnFilterKey,
    extractSearchTerm,
    sorting,
    extractPageSize,
    setColumnFilterKey,
    setSearchTerm,
    setSortKey,
    toggleSortDirection,
    setPageSize,
    resetGrid,
  } = grid;
  const activeColumnLabel = extractColumns.find((column) => column.key === extractColumnFilterKey)?.label ?? 'columna';
  const primarySort = sorting[0];

  return (
    <div className="p-4 border-b border-[#141414] flex items-center justify-between bg-white/50">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-70">
          <span>Buscar en</span>
          <select
            value={extractColumnFilterKey}
            onChange={(e) => setColumnFilterKey(e.target.value)}
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
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-70">
          <span>Ordenar por</span>
          <select
            value={primarySort?.id ?? extractColumns[0]?.key ?? ''}
            onChange={(e) => setSortKey(e.target.value)}
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
          onClick={toggleSortDirection}
          className="border border-[#141414]/20 px-3 py-2 text-[10px] font-mono uppercase tracking-widest hover:border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
        >
          {primarySort?.desc ? 'Desc' : 'Asc'}
        </button>
        <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-70">
          <span>Filas por pagina</span>
          <select
            value={extractPageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
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
          onClick={resetGrid}
          className="border border-[#141414]/20 px-3 py-2 text-[10px] font-mono uppercase tracking-widest hover:border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
        >
          Reset grid
        </button>
      </div>
      <div className="hidden xl:flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-60">
        <span>Sorts</span>
        {sorting.length === 0 ? (
          <span className="px-2 py-1 border border-[#141414]/10 bg-white/60">Ninguno</span>
        ) : (
          sorting.map((sort, index) => {
            const column = extractColumns.find((item) => item.key === sort.id);
            return (
              <span key={`${sort.id}-${index}`} className="px-2 py-1 border border-[#141414]/10 bg-white/60">
                {index + 1}. {column?.label ?? sort.id} {sort.desc ? 'desc' : 'asc'}
              </span>
            );
          })
        )}
        <span className="px-2 py-1 border border-[#141414]/10 bg-white/60">
          {grid.columnFilters.length} filtros de columna
        </span>
        <span className="opacity-40">Shift + click en encabezados para multi-sort</span>
      </div>
    </div>
  );
}
