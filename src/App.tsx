/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Download, 
  ArrowLeft,
  Copy,
  Info,
  ChevronRight,
  Database,
  User,
  Hash,
  Calendar,
  Layers
} from 'lucide-react';
import { parseCFDI, CFDIData, CFDIConcept } from './lib/cfdi';
import FileUpload from './components/FileUpload';

export default function App() {
  const [cfdi, setCfdi] = useState<CFDIData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyImpacted, setOnlyImpacted] = useState(true);
  const [selectedConcept, setSelectedConcept] = useState<CFDIConcept | null>(null);
  const [copiedDiagnostic, setCopiedDiagnostic] = useState(false);
  const [reportExported, setReportExported] = useState(false);

  const handleFileSelect = (xml: string) => {
    try {
      const data = parseCFDI(xml);
      setCfdi(data);
    } catch (error) {
      console.error("Error parsing CFDI:", error);
      alert("Error al procesar el XML. Asegúrate de que sea un CFDI válido.");
    }
  };

  const exportReport = () => {
    if (!cfdi) return;
    const report = `
REPORTE DE AUDITORÍA CFDI
-------------------------
UUID: ${cfdi.uuid}
Fecha: ${cfdi.fecha}
Emisor: ${cfdi.emisor}
Receptor: ${cfdi.receptor}

DICTAMEN:
${cfdi.verdict.title}
${cfdi.verdict.summary}

RESUMEN FINANCIERO:
Subtotal XML: $${cfdi.subtotal}
Subtotal Calc: $${cfdi.subtotalCalculado}
Total XML: $${cfdi.total}
Total Calc: $${cfdi.totalCalculado}

HALLAZGOS:
${cfdi.findings.length > 0 ? cfdi.findings.map(f => `- ${f.title}: ${f.summary}`).join('\n') : 'Sin discrepancias detectadas.'}

TRASLADOS AGRUPADOS:
${cfdi.taxAuditGroups.length > 0 ? cfdi.taxAuditGroups.map(group => `- ${group.impuesto} ${group.tipoFactor} ${(group.tasaOCuota * 100).toFixed(2)}% | Detalle: ${group.importeDetalle.toFixed(2)} | Agrupado: ${group.importeAgrupado.toFixed(2)} | Dif: ${group.diferencia.toFixed(2)}`).join('\n') : 'Sin traslados agrupados detectados.'}

CONCEPTOS AFECTADOS:
${cfdi.impactedConceptIndexes.length > 0 ? cfdi.impactedConceptIndexes.map(index => {
  const c = cfdi.conceptos[index];
  return `- ${index + 1}. ${c.descripcion}: XML $${c.importe} vs Calc $${c.importeCalculado} | Dif $${c.diferencia.toFixed(6)}`;
}).join('\n') : 'No hay conceptos afectados.'}

CONCEPTOS REVISADOS:
${cfdi.conceptos.map(c => `- ${c.descripcion}: XML $${c.importe} vs Calc $${c.importeCalculado} (${c.diferencia === 0 ? 'OK' : 'ERROR'})`).join('\n')}
    `;
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_CFDI_${cfdi.uuid.substring(0,8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setReportExported(true);
    window.setTimeout(() => setReportExported(false), 1600);
  };

  const copyDiagnostic = () => {
    if (!cfdi) return;
    navigator.clipboard.writeText(cfdi.supportText);
    setCopiedDiagnostic(true);
    window.setTimeout(() => setCopiedDiagnostic(false), 1600);
  };

  const conceptPool = cfdi
    ? (onlyImpacted ? cfdi.impactedConceptIndexes.map((index) => cfdi.conceptos[index]).filter(Boolean) : cfdi.conceptos)
    : [];

  const filteredConceptos = conceptPool.filter(c => 
    c.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.claveProdServ.includes(searchTerm)
  );
  const subtotalDifference = Math.abs(cfdi?.subtotalCalculado ?? 0 - (cfdi?.subtotal ?? 0));
  const totalDifference = Math.abs(cfdi?.totalCalculado ?? 0 - (cfdi?.total ?? 0));

  if (!cfdi) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-serif italic mb-2 text-[#141414]">CFDI Inspector</h1>
            <p className="text-[#141414]/60 font-mono text-sm uppercase tracking-widest">Auditoría y Validación de Facturas XML</p>
          </div>
          <FileUpload onFileSelect={handleFileSelect} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-[#141414] p-4 flex items-center justify-between sticky top-0 bg-[#E4E3E0] z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCfdi(null)}
            className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors rounded-full"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-serif italic">CFDI Inspector</h1>
            <p className="text-[10px] font-mono opacity-50 uppercase tracking-tighter">v1.0.0 // Internal Tool</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono opacity-50 uppercase">UUID</span>
            <span className="text-xs font-mono font-bold tracking-tighter">{cfdi.uuid}</span>
          </div>
          <button
            onClick={copyDiagnostic}
            className={`border px-3 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors flex items-center gap-2 ${
              copiedDiagnostic
                ? 'border-[#141414] bg-[#141414] text-[#E4E3E0]'
                : 'border-[#141414]/20 hover:border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0]'
            }`}
          >
            <Copy size={12} />
            {copiedDiagnostic ? 'Copiado' : 'Copiar diagnóstico'}
          </button>
          <button 
            onClick={exportReport}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-widest transition-opacity flex items-center gap-2 ${
              reportExported
                ? 'bg-green-700 text-[#E4E3E0]'
                : 'bg-[#141414] text-[#E4E3E0] hover:opacity-80'
            }`}
          >
            <Download size={14} />
            {reportExported ? 'Reporte descargado' : 'Exportar Reporte'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar Hallazgos */}
        <aside className="w-80 border-r border-[#141414] flex flex-col bg-[#E4E3E0]">
          <div className="p-4 border-b border-[#141414]">
            <p className="text-[10px] font-mono uppercase tracking-widest opacity-50 mb-2">Dictamen</p>
            <div
              className={`p-3 border rounded ${
                cfdi.verdict.status === 'critical'
                  ? 'border-red-500/30 bg-red-50'
                  : cfdi.verdict.status === 'review'
                    ? 'border-amber-500/30 bg-amber-50'
                    : 'border-green-500/30 bg-green-50'
              }`}
            >
              <p className="text-sm font-semibold">{cfdi.verdict.title}</p>
              <p className="text-[11px] font-mono leading-relaxed mt-2 opacity-80">{cfdi.verdict.summary}</p>
            </div>
          </div>

          <div className="p-4 border-b border-[#141414] flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-widest opacity-50">Hallazgos</h2>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${cfdi.findings.length > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
              {cfdi.findings.length} Alertas
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cfdi.findings.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-30 text-center">
                <CheckCircle2 size={48} className="mb-4" />
                <p className="text-xs font-mono uppercase tracking-widest">Sin discrepancias detectadas</p>
              </div>
            ) : (
              cfdi.findings.map((finding) => (
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
                    <p className={`text-xs font-semibold ${finding.severity === 'critical' ? 'text-red-900' : 'text-amber-900'}`}>
                      {finding.title}
                    </p>
                    <p className={`text-xs font-mono leading-relaxed mt-1 ${finding.severity === 'critical' ? 'text-red-900' : 'text-amber-900'}`}>
                      {finding.summary}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-[#141414] bg-[#141414]/5">
            <h3 className="text-[10px] font-mono uppercase tracking-widest opacity-50 mb-3">Resumen de Totales</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span>Subtotal XML</span>
                <span>${cfdi.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-blue-600 italic">
                <span>Subtotal Calc.</span>
                <span>${cfdi.subtotalCalculado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className={`flex justify-between text-[10px] font-mono ${subtotalDifference > 0.000001 ? 'text-red-600' : 'text-green-600'}`}>
                <span>Dif. Subtotal</span>
                <span>${subtotalDifference.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
              </div>
              <div className="flex justify-between text-xs font-mono border-t border-[#141414]/10 pt-2">
                <span>Descuento</span>
                <span>-${cfdi.descuento.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs font-mono pt-2 font-bold">
                <span>Total XML</span>
                <span>${cfdi.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-blue-600 italic">
                <span>Total Calc.</span>
                <span>${cfdi.totalCalculado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className={`flex justify-between text-[10px] font-mono ${totalDifference > 0.000001 ? 'text-red-600' : 'text-green-600'}`}>
                <span>Dif. Total</span>
                <span>${totalDifference.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <section className="flex-1 flex flex-col overflow-hidden relative">
          {/* Info Cards */}
          <div className="grid grid-cols-3 border-b border-[#141414]">
            <div className="p-4 border-r border-[#141414] flex items-start gap-3">
              <User size={16} className="opacity-50 mt-1" />
              <div>
                <p className="text-[10px] font-mono uppercase opacity-50">Emisor</p>
                <p className="text-xs font-bold truncate max-w-[200px]">{cfdi.emisor}</p>
              </div>
            </div>
            <div className="p-4 border-r border-[#141414] flex items-start gap-3">
              <Database size={16} className="opacity-50 mt-1" />
              <div>
                <p className="text-[10px] font-mono uppercase opacity-50">Receptor</p>
                <p className="text-xs font-bold truncate max-w-[200px]">{cfdi.receptor}</p>
              </div>
            </div>
            <div className="p-4 flex items-start gap-3">
              <Calendar size={16} className="opacity-50 mt-1" />
              <div>
                <p className="text-[10px] font-mono uppercase opacity-50">Fecha Timbrado</p>
                <p className="text-xs font-bold">{new Date(cfdi.fecha).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="border-b border-[#141414] bg-[#141414]/[0.03]">
            <div className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest opacity-50">Auditoría de Traslados</p>
                <p className="text-[11px] font-mono opacity-55 mt-0.5">Comparación entre el detalle por concepto y el agrupado del comprobante.</p>
              </div>
              <span className="text-[10px] font-mono uppercase opacity-50">
                {cfdi.taxAuditGroups.filter((group) => Math.abs(group.diferencia) > 0.000001).length} diferencias
              </span>
            </div>
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
                      <td className="px-3 py-2 text-[10px] font-mono">{group.impuesto}</td>
                      <td className="px-3 py-2 text-[10px]">{group.tipoFactor}</td>
                      <td className="px-3 py-2 text-[10px] font-mono text-right">{(group.tasaOCuota * 100).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-[10px] font-mono text-right">${group.importeDetalle.toFixed(2)}</td>
                      <td className="px-3 py-2 text-[10px] font-mono text-right">${group.importeAgrupado.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-[10px] font-mono text-right ${Math.abs(group.diferencia) > 0.000001 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                        ${group.diferencia.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="p-4 border-b border-[#141414] flex items-center justify-between bg-white/50">
            <div className="relative w-96">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
              <input 
                type="text" 
                placeholder="Filtrar conceptos por descripción o clave..."
                className="w-full pl-9 pr-4 py-2 text-xs font-mono bg-transparent border border-[#141414]/20 focus:border-[#141414] outline-none transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4 text-[10px] font-mono uppercase opacity-50">
              <button
                onClick={() => setOnlyImpacted((value) => !value)}
                className={`px-3 py-2 border text-[10px] font-mono uppercase tracking-widest transition-colors ${
                  onlyImpacted ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]' : 'border-[#141414]/20 hover:border-[#141414]'
                }`}
              >
                {onlyImpacted ? 'Solo discrepancias' : 'Todos los conceptos'}
              </button>
              <span>{onlyImpacted ? 'Conceptos afectados' : 'Conceptos revisados'}: {filteredConceptos.length}</span>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-[#E4E3E0] z-10 border-b border-[#141414]">
                <tr className="text-[10px] font-mono uppercase opacity-50 text-left">
                  <th className="p-4 font-normal">Clave</th>
                  <th className="p-4 font-normal">Descripción</th>
                  <th className="p-4 font-normal text-right">Cant.</th>
                  <th className="p-4 font-normal text-right">V. Unitario</th>
                  <th className="p-4 font-normal text-right">Importe XML</th>
                  <th className="p-4 font-normal text-right">Importe Calc.</th>
                  <th className="p-4 font-normal text-right">Dif.</th>
                  <th className="p-4 font-normal text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141414]/10">
                {filteredConceptos.map((c, i) => (
                  <motion.tr 
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedConcept(c)}
                    className="group hover:bg-[#141414] hover:text-[#E4E3E0] transition-all cursor-pointer"
                  >
                    <td className="p-4 text-[10px] font-mono">{c.claveProdServ}</td>
                    <td className="p-4 text-xs font-medium max-w-xs truncate">{c.descripcion}</td>
                    <td className="p-4 text-xs font-mono text-right">{c.cantidad}</td>
                    <td className="p-4 text-xs font-mono text-right">${c.valorUnitario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 text-xs font-mono text-right">${c.importe.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 text-xs font-mono text-right italic opacity-70">
                      ${c.importeCalculado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`p-4 text-xs font-mono text-right ${c.diferencia > 0.000001 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                      ${c.diferencia.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </td>
                    <td className="p-4 text-center">
                      {c.diferencia > 0.000001 ? (
                        <AlertTriangle size={14} className="text-red-500 mx-auto" />
                      ) : (
                        <CheckCircle2 size={14} className="text-green-500 mx-auto opacity-30 group-hover:opacity-100" />
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Concept Detail Modal */}
          <AnimatePresence>
            {selectedConcept && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#E4E3E0]/95 z-20 flex flex-col p-8"
              >
                <div className="flex items-center justify-between mb-8">
                  <button 
                    onClick={() => setSelectedConcept(null)}
                    className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest hover:underline"
                  >
                    <ArrowLeft size={14} /> Volver a la tabla
                  </button>
                  <span className="text-[10px] font-mono uppercase opacity-50">Detalle de Concepto</span>
                </div>

                <div className="grid grid-cols-2 gap-12">
                  <div>
                    <h2 className="text-2xl font-serif italic mb-4">{selectedConcept.descripcion}</h2>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-mono uppercase opacity-50">Clave Prod/Serv</p>
                        <p className="text-sm font-mono">{selectedConcept.claveProdServ}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-mono uppercase opacity-50">Cantidad</p>
                          <p className="text-sm font-mono">{selectedConcept.cantidad}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-mono uppercase opacity-50">Valor Unitario</p>
                          <p className="text-sm font-mono">${selectedConcept.valorUnitario.toFixed(6)}</p>
                        </div>
                      </div>
                      <div className="p-4 border border-[#141414] bg-white/50 rounded">
                        <p className="text-[10px] font-mono uppercase opacity-50 mb-2">Análisis de Importe</p>
                        <div className="flex justify-between text-xs font-mono mb-1">
                          <span>Declarado (XML):</span>
                          <span>${selectedConcept.importe.toFixed(6)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-mono mb-1">
                          <span>Calculado (Cant * Val):</span>
                          <span>${selectedConcept.importeCalculado.toFixed(6)}</span>
                        </div>
                        <div className={`flex justify-between text-xs font-mono pt-2 border-t border-[#141414]/10 mt-2 font-bold ${selectedConcept.diferencia > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                          <span>Diferencia:</span>
                          <span>${selectedConcept.diferencia.toFixed(6)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-widest opacity-50 mb-4">Impuestos Trasladados</h3>
                    {selectedConcept.impuestos.length === 0 ? (
                      <p className="text-xs font-mono italic opacity-50">No hay impuestos registrados para este concepto.</p>
                    ) : (
                      <div className="space-y-4">
                        {selectedConcept.impuestos.map((imp, idx) => (
                          <div key={idx} className="p-4 border border-[#141414]/20 rounded bg-white/30">
                            <div className="flex justify-between mb-2">
                              <span className="text-[10px] font-mono font-bold uppercase">{imp.impuesto} ({imp.tipoFactor})</span>
                              <span className="text-[10px] font-mono">Tasa: {(imp.tasaOCuota * 100).toFixed(2)}%</span>
                            </div>
                            <div className="space-y-1 text-[10px] font-mono opacity-70">
                              <div className="flex justify-between">
                                <span>Base:</span>
                                <span>${imp.base.toFixed(6)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Importe XML:</span>
                                <span>${imp.importe.toFixed(6)}</span>
                              </div>
                              <div className="flex justify-between italic">
                                <span>Importe Calc:</span>
                                <span>${imp.importeCalculado.toFixed(6)}</span>
                              </div>
                              <div className={`flex justify-between pt-2 border-t border-[#141414]/10 mt-2 ${imp.diferencia > 0.000001 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                <span>Diferencia:</span>
                                <span>${imp.diferencia.toFixed(6)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
