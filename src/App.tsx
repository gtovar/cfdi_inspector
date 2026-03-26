/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  ArrowLeft,
  Database,
  User,
  Calendar,
  Sparkles
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CFDIData, CFDIConcept, CFDIProfile, CFDIIngresoRow, CFDIPagoRow } from './cfdi/public';
import { useCfdiAnalysis } from './app/hooks/useCfdiAnalysis';
import { useCfdiExports } from './app/hooks/useCfdiExports';
import { useExtractGridState, type ExtractMode, type ExtractSortDirection } from './app/hooks/useExtractGridState';
import { explainCfdiField } from './cfdi/domain/explainCfdiField';
import CfdiSummaryHeader, { type SummaryFieldCard } from './components/CfdiSummaryHeader';
import ConceptDetailModal from './components/ConceptDetailModal';
import ExtractWorkspace from './components/ExtractWorkspace';
import FindingsSidebar from './components/FindingsSidebar';
import FileUpload from './components/FileUpload';
import InspectorHeader from './components/InspectorHeader';
import TaxAuditPanel from './components/TaxAuditPanel';

function formatExact(value: number) {
  return value.toLocaleString('es-MX', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 20,
  });
}

interface SummaryMetricCard {
  key: string;
  label: string;
  value: string;
}

const INGRESO_COLUMNS = [
  { key: 'uuid', label: 'UUID' },
  { key: 'claveProdServ', label: 'Clave' },
  { key: 'descripcion', label: 'Descripcion' },
  { key: 'objetoImp', label: 'ObjetoImp' },
  { key: 'tipoImp', label: 'Tipo Imp' },
  { key: 'impuesto', label: 'Impuesto' },
  { key: 'tasaCuota', label: 'Tasa/Cuota' },
  { key: 'importeImp', label: 'Importe Imp' },
] as const;

const PAGO_COLUMNS = [
  { key: 'uuidCFDI', label: 'UUID CFDI' },
  { key: 'fechaPago', label: 'Fecha Pago' },
  { key: 'uuidDR', label: 'UUID DR' },
  { key: 'parcialidad', label: 'Parcialidad' },
  { key: 'impPagado', label: 'Imp Pagado' },
  { key: 'baseDR', label: 'Base DR' },
  { key: 'impuestoDR', label: 'Impuesto DR' },
  { key: 'importeDR', label: 'Importe DR' },
] as const;

const DIAGNOSE_COLUMNS = [
  { key: 'claveProdServ', label: 'Clave' },
  { key: 'descripcion', label: 'Descripcion' },
  { key: 'cantidad', label: 'Cant.' },
  { key: 'valorUnitario', label: 'V. Unitario' },
  { key: 'importe', label: 'Importe XML' },
  { key: 'importeCalculado', label: 'Importe Calc.' },
  { key: 'diferencia', label: 'Dif.' },
  { key: 'status', label: 'Status' },
] as const;

function getDiagnoseCellValue(concept: CFDIConcept, key: string) {
  switch (key) {
    case 'claveProdServ':
      return concept.claveProdServ ?? '';
    case 'descripcion':
      return concept.descripcion ?? '';
    case 'cantidad':
      return String(concept.cantidad ?? '');
    case 'valorUnitario':
      return String(concept.valorUnitario ?? '');
    case 'importe':
      return String(concept.importe ?? '');
    case 'importeCalculado':
      return String(concept.importeCalculado ?? '');
    case 'diferencia':
      return String(concept.diferencia ?? '');
    case 'status':
      return concept.diferencia !== 0 ? 'discrepancia' : 'ok';
    default:
      return '';
  }
}

function getProfileLabel(profile: CFDIProfile) {
  switch (profile) {
    case 'ingreso':
      return 'Ingreso';
    case 'pagos':
      return 'Pagos';
    default:
      return 'Desconocido';
  }
}

function getProfileRecommendation(profile: CFDIProfile) {
  switch (profile) {
    case 'ingreso':
      return 'Sugerido: diagnostico arriba y tabla operativa abajo';
    case 'pagos':
      return 'Sugerido: tabla operativa de pagos';
    default:
      return 'Sugerido: revisar el XML antes de extraer';
  }
}

function getExplainedMeaning(key: string, value: string | number | null) {
  return explainCfdiField(key, value).meaning;
}

function getExplainedTaxLabel(code: string) {
  const explained = explainCfdiField('impuesto', code);
  return explained.meaning.includes('sin catalogo')
    ? code
    : `${code} · ${explained.meaning.split('.')[0]}`;
}

function getFindingOriginLabel(findingId: string) {
  if (findingId.startsWith('math-')) return 'Matemático';
  if (findingId.startsWith('tax-group-')) return 'Fiscal';
  if (findingId.startsWith('concept-')) return 'Concepto';
  return 'Operativo';
}

export default function App() {
  const {
    profile,
    cfdi,
    ingresoRows,
    pagoRows,
    analysisEngine,
    analysisReason,
    analysisStageLabel,
    analysisStageProgress,
    analysisStageDetail,
    sourceXml,
    handleFileSelect,
    resetAnalysis,
  } = useCfdiAnalysis();
  const [diagnoseSearchTerm, setDiagnoseSearchTerm] = useState('');
  const [diagnoseColumnFilterKey, setDiagnoseColumnFilterKey] = useState<string>('all');
  const [onlyImpacted, setOnlyImpacted] = useState(true);
  const [selectedConcept, setSelectedConcept] = useState<CFDIConcept | null>(null);
  const [hiddenDiagnoseColumns, setHiddenDiagnoseColumns] = useState<string[]>([]);
  const [diagnosePage, setDiagnosePage] = useState(1);
  const [diagnosePageSize, setDiagnosePageSize] = useState(100);
  const [diagnoseSortKey, setDiagnoseSortKey] = useState<string>('diferencia');
  const [diagnoseSortDirection, setDiagnoseSortDirection] = useState<ExtractSortDirection>('desc');
  const [taxAuditExpanded, setTaxAuditExpanded] = useState(true);

  const conceptPool = cfdi
    ? (onlyImpacted ? cfdi.impactedConceptIndexes.map((index) => cfdi.conceptos[index]).filter(Boolean) : cfdi.conceptos)
    : [];

  const activeDatasetType: ExtractMode = profile === 'pagos' ? 'pagos' : 'ingresos';
  const extractColumns = activeDatasetType === 'ingresos' ? INGRESO_COLUMNS : PAGO_COLUMNS;
  const {
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
    resetAll: resetExtractState,
  } = useExtractGridState({
    activeDatasetType,
    ingresoRows,
    pagoRows,
    extractColumns,
  });
  const visibleDiagnoseColumns = DIAGNOSE_COLUMNS.filter((column) => !hiddenDiagnoseColumns.includes(column.key));
  const filteredIngresoRows = activeDatasetType === 'ingresos' ? filteredExtractRows as CFDIIngresoRow[] : ingresoRows;
  const filteredPagoRows = activeDatasetType === 'pagos' ? filteredExtractRows as CFDIPagoRow[] : pagoRows;
  const conceptosDetectados = new Set(
    ingresoRows.map((row) => `${row.uuid}|${row.claveProdServ}|${row.descripcion}|${row.importe}`)
  ).size;
  const conceptosConImpuesto = new Set(
    ingresoRows
      .filter((row) => row.tipoImp)
      .map((row) => `${row.uuid}|${row.claveProdServ}|${row.descripcion}`)
  ).size;
  const pagosDetectados = new Set(
    pagoRows.map((row) => `${row.uuidCFDI}|${row.fechaPago}|${row.monto}|${row.formaPago}`)
  ).size;
  const doctosRelacionadosDetectados = new Set(
    pagoRows.map((row) => `${row.uuidCFDI}|${row.uuidDR}|${row.serieFolio}|${row.parcialidad}`)
  ).size;
  const registrosConImpuestoDr = pagoRows.filter((row) => row.impuestoDR || row.importeDR).length;

  const filteredConceptos = conceptPool.filter((concept) => {
    const search = diagnoseSearchTerm.trim().toLowerCase();
    if (!search) return true;

    if (diagnoseColumnFilterKey === 'all') {
      return DIAGNOSE_COLUMNS.some((column) => getDiagnoseCellValue(concept, column.key).toLowerCase().includes(search));
    }

    return getDiagnoseCellValue(concept, diagnoseColumnFilterKey).toLowerCase().includes(search);
  });
  const subtotalDifference = Math.abs((cfdi?.subtotalCalculado ?? 0) - (cfdi?.subtotal ?? 0));
  const totalDifference = Math.abs((cfdi?.totalCalculado ?? 0) - (cfdi?.total ?? 0));
  const sortedDiagnoseRows = useMemo(() => {
    const rows = [...filteredConceptos];
    rows.sort((left, right) => {
      const getValue = (concept: CFDIConcept) => {
        switch (diagnoseSortKey) {
          case 'claveProdServ':
            return concept.claveProdServ;
          case 'descripcion':
            return concept.descripcion;
          case 'cantidad':
            return concept.cantidad;
          case 'valorUnitario':
            return concept.valorUnitario;
          case 'importe':
            return concept.importe;
          case 'importeCalculado':
            return concept.importeCalculado;
          case 'diferencia':
          default:
            return concept.diferencia;
        }
      };

      const leftValue = getValue(left);
      const rightValue = getValue(right);

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return diagnoseSortDirection === 'asc' ? leftValue - rightValue : rightValue - leftValue;
      }

      const comparison = String(leftValue).localeCompare(String(rightValue), 'es', { numeric: true, sensitivity: 'base' });
      return diagnoseSortDirection === 'asc' ? comparison : -comparison;
    });
    return rows;
  }, [filteredConceptos, diagnoseSortDirection, diagnoseSortKey]);

  const filteredDiagnoseCount = sortedDiagnoseRows.length;
  const diagnoseTotalPages = Math.max(1, Math.ceil(filteredDiagnoseCount / diagnosePageSize));
  const safeDiagnosePage = Math.min(diagnosePage, diagnoseTotalPages);
  const diagnosePageStart = filteredDiagnoseCount === 0 ? 0 : (safeDiagnosePage - 1) * diagnosePageSize;
  const currentDiagnoseRows = sortedDiagnoseRows.slice(diagnosePageStart, diagnosePageStart + diagnosePageSize);

  const summaryFieldBuilders: Record<CFDIProfile, () => SummaryFieldCard[]> = {
    ingreso: () => (cfdi ? [
      { key: 'emisor', label: 'Emisor', value: cfdi.emisor || '-', icon: User, meaning: 'Nombre o RFC del emisor detectado en el CFDI.' },
      { key: 'uuid', label: 'UUID', value: cfdi.uuid || '-', icon: FileText, meaning: 'Identificador fiscal único del comprobante timbrado.' },
      { key: 'receptor', label: 'Receptor', value: cfdi.receptor || '-', icon: Database, meaning: 'Nombre o RFC del receptor detectado en el CFDI.' },
      {
        key: 'fecha',
        label: 'Fecha timbrado',
        value: cfdi.fecha ? new Date(cfdi.fecha).toLocaleString() : '-',
        icon: Calendar,
        meaning: 'Fecha detectada del comprobante para esta lectura operativa.',
      },
    ] : []),
    pagos: () => {
      const firstPago = pagoRows[0];
      return [
        { key: 'emisor', label: 'Emisor', value: cfdi?.emisor || firstPago?.rfcEmisor || '-', icon: User, meaning: 'Nombre o RFC del emisor detectado en el CFDI.' },
        { key: 'uuid', label: 'UUID', value: cfdi?.uuid || firstPago?.uuidCFDI || '-', icon: FileText, meaning: 'Identificador fiscal único del comprobante timbrado.' },
        { key: 'receptor', label: 'Receptor', value: cfdi?.receptor || firstPago?.rfcReceptor || '-', icon: Database, meaning: 'Nombre o RFC del receptor detectado en el CFDI.' },
        {
          key: 'fecha',
          label: 'Fecha CFDI',
          value: firstPago?.fechaCFDI ? new Date(firstPago.fechaCFDI).toLocaleString() : (cfdi?.fecha ? new Date(cfdi.fecha).toLocaleString() : '-'),
          icon: Calendar,
          meaning: 'Fecha detectada del comprobante para esta lectura operativa.',
        },
      ];
    },
    unknown: () => (cfdi ? [
      { key: 'emisor', label: 'Emisor', value: cfdi.emisor || '-', icon: User, meaning: 'Nombre o RFC del emisor detectado en el CFDI.' },
      { key: 'uuid', label: 'UUID', value: cfdi.uuid || '-', icon: FileText, meaning: 'Identificador fiscal único del comprobante timbrado.' },
      { key: 'receptor', label: 'Receptor', value: cfdi.receptor || '-', icon: Database, meaning: 'Nombre o RFC del receptor detectado en el CFDI.' },
      {
        key: 'fecha',
        label: 'Fecha detectada',
        value: cfdi.fecha ? new Date(cfdi.fecha).toLocaleString() : '-',
        icon: Calendar,
        meaning: 'Fecha detectada del comprobante para esta lectura operativa.',
      },
    ] : []),
  };

  const extractMetricBuilders: Record<ExtractMode, () => SummaryMetricCard[]> = {
    ingresos: () => [
      { key: 'rows', label: 'Registros', value: filteredIngresoRows.length.toLocaleString('es-MX') },
      { key: 'concepts', label: 'Conceptos', value: conceptosDetectados.toLocaleString('es-MX') },
      { key: 'taxed', label: 'Con impuesto', value: conceptosConImpuesto.toLocaleString('es-MX') },
      { key: 'results', label: 'Resultados', value: extractSearchTerm ? 'Filtrados' : 'Todos' },
    ],
    pagos: () => [
      { key: 'rows', label: 'Registros', value: filteredPagoRows.length.toLocaleString('es-MX') },
      { key: 'payments', label: 'Pagos', value: pagosDetectados.toLocaleString('es-MX') },
      { key: 'documents', label: 'Doctos Rel.', value: doctosRelacionadosDetectados.toLocaleString('es-MX') },
      { key: 'drTax', label: 'Con impuesto DR', value: registrosConImpuestoDr.toLocaleString('es-MX') },
    ],
  };

  const summaryFields = summaryFieldBuilders[profile]?.() ?? [];
  const activeExtractMetrics = extractMetricBuilders[activeDatasetType]();
  const {
    reportExported,
    taxesExported,
    ingresosExported,
    pagosExported,
    pagosExportError,
    tableExported,
    tableExportError,
    exportReport,
    exportTaxBreakdown,
    exportIngresosCsv,
    exportPagosCsv,
    exportCurrentTable,
  } = useCfdiExports({
    cfdi,
    ingresoRows,
    pagoRows,
    activeDatasetType,
    visibleExtractColumns: visibleExtractColumns.map((column) => ({ key: column.key, label: column.label })),
    sortedExtractRows: sortedExtractRows as Record<string, string>[],
    getExtractCellValue,
  });

  if (!cfdi) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-serif italic mb-2 text-[#141414]">CFDI Inspector</h1>
            <p className="text-[#141414]/60 font-mono text-sm uppercase tracking-widest">Auditoría y Validación de Facturas XML</p>
          </div>
          <FileUpload
            onFileSelect={(xml) =>
              handleFileSelect(xml, {
                onBeforeApply: (nextProfile) => {
                  resetForNewAnalysis(nextProfile === 'pagos' ? 'pagos' : 'ingresos');
                  setDiagnoseSearchTerm('');
                  setDiagnoseColumnFilterKey('all');
                  setDiagnosePage(1);
                  setDiagnosePageSize(100);
                  setDiagnoseSortKey('diferencia');
                  setDiagnoseSortDirection('desc');
                  setTaxAuditExpanded(true);
                  setHiddenDiagnoseColumns([]);
                },
              })
            }
            analysisLabel={analysisStageLabel}
            analysisProgress={analysisStageProgress}
            analysisDetail={analysisStageDetail}
            analysisEngine={analysisEngine}
            analysisReason={analysisReason}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#E4E3E0] text-[#141414] font-sans flex flex-col">
      <InspectorHeader
        profileLabel={getProfileLabel(profile)}
        tableExported={tableExported}
        tableExportError={tableExportError}
        onExport={exportCurrentTable}
        onReset={() => {
          resetAnalysis();
          resetExtractState();
          setDiagnoseSearchTerm('');
          setDiagnoseColumnFilterKey('all');
          setDiagnosePage(1);
          setDiagnosePageSize(100);
          setDiagnoseSortKey('diferencia');
          setDiagnoseSortDirection('desc');
          setTaxAuditExpanded(true);
          setHiddenDiagnoseColumns([]);
        }}
      />

      <main className="flex-1 min-h-0 flex overflow-hidden">
        <FindingsSidebar
          cfdi={cfdi}
          activeDatasetType={activeDatasetType}
          activeExtractMetrics={activeExtractMetrics}
          subtotalDifference={subtotalDifference}
          totalDifference={totalDifference}
          formatExact={formatExact}
          getFindingOriginLabel={getFindingOriginLabel}
        />

        <section className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
          <CfdiSummaryHeader summaryFields={summaryFields} />
          <TaxAuditPanel
            cfdi={cfdi}
            taxAuditExpanded={taxAuditExpanded}
            onToggle={() => setTaxAuditExpanded((current) => !current)}
            getExplainedMeaning={getExplainedMeaning}
            getExplainedTaxLabel={getExplainedTaxLabel}
            formatExact={formatExact}
          />
          <div className="flex-1 min-h-0 flex flex-col">
            <ExtractWorkspace
              embedded
              activeDatasetType={activeDatasetType}
              extractColumns={extractColumns}
              extractColumnFilterKey={extractColumnFilterKey}
              extractSearchTerm={extractSearchTerm}
              extractSortKey={extractSortKey}
              extractSortDirection={extractSortDirection}
              extractPageSize={extractPageSize}
              activeHiddenColumns={activeHiddenColumns}
              visibleExtractColumns={visibleExtractColumns}
              filteredExtractCount={filteredExtractCount}
              safeExtractPage={safeExtractPage}
              extractTotalPages={extractTotalPages}
              extractPageStart={extractPageStart}
              currentPageRows={currentPageRows as Record<string, string>[]}
              getExtractCellValue={getExtractCellValue}
              onColumnFilterChange={(value) => {
                setExtractColumnFilterKey(value);
                setExtractPage(1);
              }}
              onSearchChange={(value) => {
                setExtractSearchTerm(value);
                setExtractPage(1);
              }}
              onSortKeyChange={(value) => {
                setExtractSortKey(value);
                setExtractPage(1);
              }}
              onSortDirectionToggle={() => {
                setExtractSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
                setExtractPage(1);
              }}
              onPageSizeChange={(value) => {
                setExtractPageSize(value);
                setExtractPage(1);
              }}
              onResetGrid={resetGrid}
              onToggleColumn={toggleColumn}
              onPrevPage={() => setExtractPage((current) => Math.max(1, current - 1))}
              onNextPage={() => setExtractPage((current) => Math.min(extractTotalPages, current + 1))}
            />
          </div>

          <ConceptDetailModal
            selectedConcept={selectedConcept}
            onClose={() => setSelectedConcept(null)}
            formatExact={formatExact}
            getExplainedMeaning={getExplainedMeaning}
            getExplainedTaxLabel={getExplainedTaxLabel}
          />
        </section>
      </main>
    </div>
  );
}
