import { ChevronRight } from 'lucide-react';
import type { CFDIData } from '../cfdi/public';

interface TaxAuditPanelProps {
  cfdi: CFDIData;
  taxAuditExpanded: boolean;
  onToggle: () => void;
  getExplainedMeaning: (key: string, value: string | number | null) => string;
  getExplainedTaxLabel: (code: string) => string;
  formatExact: (value: number) => string;
}

export default function TaxAuditPanel({
  cfdi,
  taxAuditExpanded,
  onToggle,
  getExplainedMeaning,
  getExplainedTaxLabel,
  formatExact,
}: TaxAuditPanelProps) {
  return (
    <div className="border-b border-[#141414] bg-[#141414]/[0.03]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-2.5 flex items-center justify-between gap-4 text-left hover:bg-[#141414]/[0.04] transition-colors"
      >
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest opacity-50">Auditoría de Traslados</p>
          <p className="text-[11px] font-mono opacity-55 mt-0.5">Comparación entre el detalle por concepto y el agrupado del comprobante.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono uppercase opacity-50">
            {cfdi.taxAuditGroups.filter((group) => Math.abs(group.diferencia) !== 0).length} diferencias
          </span>
          <ChevronRight
            size={14}
            className={`opacity-50 transition-transform ${taxAuditExpanded ? 'rotate-90' : 'rotate-0'}`}
          />
        </div>
      </button>
      {taxAuditExpanded && (
        <div className="overflow-auto max-h-36 border-t border-[#141414]/10 bg-white/15">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#E4E3E0] z-10 border-b border-[#141414]/10">
              <tr className="text-[10px] font-mono uppercase opacity-50 text-left">
                <th className="px-3 py-2 font-normal">Impuesto</th>
                <th className="px-3 py-2 font-normal">Tipo</th>
                <th className="px-3 py-2 font-normal text-right">Tasa</th>
                <th className="px-3 py-2 font-normal text-right">Detalle</th>
                <th className="px-3 py-2 font-normal text-right">Agrupado</th>
                <th className="px-3 py-2 font-normal text-right">Dif.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]/10">
              {cfdi.taxAuditGroups.map((group) => (
                <tr key={group.key}>
                  <td
                    className="px-3 py-2 text-[10px] font-mono"
                    title={getExplainedMeaning('impuesto', group.impuesto)}
                  >
                    <div>{getExplainedTaxLabel(group.impuesto)}</div>
                    <div className="text-[9px] opacity-50 mt-0.5">
                      {getExplainedMeaning('impuesto', group.impuesto)}
                    </div>
                  </td>
                  <td
                    className="px-3 py-2 text-[10px]"
                    title={getExplainedMeaning('tipoFactor', group.tipoFactor)}
                  >
                    <div>{group.tipoFactor}</div>
                    <div className="text-[9px] opacity-50 mt-0.5">
                      {getExplainedMeaning('tipoFactor', group.tipoFactor)}
                    </div>
                  </td>
                  <td
                    className="px-3 py-2 text-[10px] font-mono text-right"
                    title={getExplainedMeaning('tasaOCuota', group.tasaOCuota)}
                  >
                    <div>{(group.tasaOCuota * 100).toFixed(2)}%</div>
                    <div className="text-[9px] opacity-50 mt-0.5">
                      {getExplainedMeaning('tasaOCuota', group.tasaOCuota)}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[10px] font-mono text-right">${group.importeDetalle.toFixed(2)}</td>
                  <td className="px-3 py-2 text-[10px] font-mono text-right">${group.importeAgrupado.toFixed(2)}</td>
                  <td className={`px-3 py-2 text-[10px] font-mono text-right ${Math.abs(group.diferencia) !== 0 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                    ${formatExact(group.diferencia)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
