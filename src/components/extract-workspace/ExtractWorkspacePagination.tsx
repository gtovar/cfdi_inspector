interface ExtractWorkspacePaginationProps {
  safeExtractPage: number;
  extractTotalPages: number;
  filteredExtractCount: number;
  extractPageStart: number;
  currentPageRowCount: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export default function ExtractWorkspacePagination({
  safeExtractPage,
  extractTotalPages,
  filteredExtractCount,
  extractPageStart,
  currentPageRowCount,
  onPrevPage,
  onNextPage,
}: ExtractWorkspacePaginationProps) {
  return (
    <div className="p-4 border-t border-[#141414] bg-white/95 backdrop-blur-sm flex items-center justify-between shrink-0">
      <div className="flex flex-col">
        <p className="text-[10px] font-mono uppercase tracking-widest opacity-50">
          Pagina {safeExtractPage} de {extractTotalPages}
        </p>
        <p className="text-[10px] font-mono opacity-60 mt-1">
          {filteredExtractCount === 0
            ? 'Registros 0 de 0'
            : `Registros ${extractPageStart + 1}-${Math.min(extractPageStart + currentPageRowCount, filteredExtractCount)} de ${filteredExtractCount}`}
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
  );
}
