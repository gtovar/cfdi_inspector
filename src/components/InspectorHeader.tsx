import { ArrowLeft, FileText } from 'lucide-react';

interface InspectorHeaderProps {
  profileLabel: string;
  tableExported: boolean;
  tableExportError: boolean;
  onReset: () => void;
  onExport: () => void;
}

export default function InspectorHeader({
  profileLabel,
  tableExported,
  tableExportError,
  onReset,
  onExport,
}: InspectorHeaderProps) {
  return (
    <header className="border-b border-[#141414] sticky top-0 bg-[#E4E3E0] z-10">
      <div className="px-4 py-2.5 flex items-center justify-between gap-6">
        <div className="flex items-start gap-4 min-w-0">
          <button
            onClick={onReset}
            className="w-9 h-9 shrink-0 border border-[#141414] bg-[#E4E3E0] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors rounded-full flex items-center justify-center"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-start gap-6 min-w-0">
            <div className="flex flex-col min-w-0">
              <div className="flex items-baseline gap-4 min-w-0">
                <h1 className="text-[26px] leading-none font-serif italic whitespace-nowrap">CFDI Inspector</h1>
                <div className="h-px w-8 bg-[#141414]/20 mt-1 shrink-0" />
                <h2 className="text-[17px] leading-none font-serif italic text-[#141414]/70 truncate">
                  {profileLabel}
                </h2>
              </div>
              <div className="mt-2 flex items-center gap-3 min-w-0">
                <p className="text-[10px] font-mono opacity-45 uppercase tracking-[0.18em]">v1.0.0</p>
                <span className="text-[#141414]/20">/</span>
                <p className="text-[10px] font-mono opacity-45 uppercase tracking-[0.18em]">Internal Tool</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onExport}
            className={`px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.22em] transition-opacity flex items-center gap-2 ${
              tableExported
                ? 'bg-green-700 text-[#E4E3E0]'
                : tableExportError
                  ? 'bg-red-700 text-[#E4E3E0]'
                  : 'bg-[#141414] text-[#E4E3E0] hover:opacity-80'
            }`}
          >
            <FileText size={14} />
            {tableExported ? 'Exportado' : tableExportError ? 'Sin datos' : 'Exportar'}
          </button>
        </div>
      </div>
    </header>
  );
}
