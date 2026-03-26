import { AlertTriangle } from 'lucide-react';
import type { CFDIData } from '../cfdi/public';

interface SummaryMetricCard {
  key: string;
  label: string;
  value: string;
}

interface FindingsSidebarProps {
  cfdi: CFDIData;
  activeDatasetType: 'ingresos' | 'pagos';
  activeExtractMetrics: SummaryMetricCard[];
  subtotalDifference: number;
  totalDifference: number;
  formatExact: (value: number) => string;
  getFindingOriginLabel: (findingId: string) => string;
}

export default function FindingsSidebar({
  cfdi,
  activeDatasetType,
  activeExtractMetrics,
  subtotalDifference,
  totalDifference,
  formatExact,
  getFindingOriginLabel,
}: FindingsSidebarProps) {
  return (
    <aside className="w-80 min-h-0 border-r border-[#141414] flex flex-col bg-[#E4E3E0]">
      <div className="p-4 border-b border-[#141414]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2 h-2 rounded-full shrink-0 ${cfdi.findings.length > 0 ? 'bg-red-600' : 'bg-green-600'}`} />
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-60">Hallazgos encontrados</p>
          </div>
          <span
            className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono ${
              cfdi.findings.length > 0
                ? 'bg-red-100 text-red-600'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {cfdi.findings.length === 0 ? '0 alertas' : `${cfdi.findings.length} alertas`}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {cfdi.findings.length === 0 ? (
          <p className="text-[11px] font-mono opacity-55 leading-relaxed">
            No se detectaron discrepancias con las reglas actualmente implementadas para este XML.
          </p>
        ) : (
          <div className="space-y-3">
            {cfdi.findings.slice(0, 4).map((finding) => (
              <div
                key={finding.id}
                className={`p-3 border rounded flex gap-3 ${
                  finding.severity === 'critical'
                    ? 'border-red-500/30 bg-red-50'
                    : 'border-amber-500/30 bg-amber-50'
                }`}
              >
                <AlertTriangle
                  className={finding.severity === 'critical' ? 'text-red-500 shrink-0' : 'text-amber-500 shrink-0'}
                  size={16}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono ${
                      finding.severity === 'critical'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {getFindingOriginLabel(finding.id)}
                    </span>
                    <p className={`text-xs font-semibold ${finding.severity === 'critical' ? 'text-red-900' : 'text-amber-900'}`}>
                      {finding.title}
                    </p>
                  </div>
                  <p className={`text-xs font-mono leading-relaxed mt-1 ${finding.severity === 'critical' ? 'text-red-900' : 'text-amber-900'}`}>
                    {finding.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[#141414] bg-[#141414]/5">
        <h3 className="text-[10px] font-mono uppercase tracking-widest opacity-50 mb-3">Resumen</h3>
        <div className="space-y-2 text-[11px] font-mono">
          {activeDatasetType === 'ingresos' ? (
            <>
              <div className="flex justify-between gap-3">
                <span>Subtotal XML</span>
                <span>${cfdi.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between gap-3 text-blue-600 italic">
                <span>Subtotal Calc.</span>
                <span>${cfdi.subtotalCalculado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className={`flex justify-between gap-3 ${subtotalDifference !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                <span>Dif. Subtotal</span>
                <span>${formatExact(subtotalDifference)}</span>
              </div>
              <div className="flex justify-between gap-3 border-t border-[#141414]/10 pt-2">
                <span>Total XML</span>
                <span>${cfdi.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between gap-3 text-blue-600 italic">
                <span>Total Calc.</span>
                <span>${cfdi.totalCalculado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className={`flex justify-between gap-3 ${totalDifference !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                <span>Dif. Total</span>
                <span>${formatExact(totalDifference)}</span>
              </div>
            </>
          ) : (
            activeExtractMetrics.map((metric) => (
              <div key={metric.key} className="flex justify-between gap-3">
                <span>{metric.label}</span>
                <span>{metric.value}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
