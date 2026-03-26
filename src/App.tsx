/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
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
import { analyzeCFDIWithWorker } from './lib/cfdi-worker-client';
import { explainCfdiField } from './cfdi/domain/explainCfdiField';
import CfdiSummaryHeader, { type SummaryFieldCard } from './components/CfdiSummaryHeader';
import ConceptDetailModal from './components/ConceptDetailModal';
import ExtractWorkspace from './components/ExtractWorkspace';
import FindingsSidebar from './components/FindingsSidebar';
import FileUpload from './components/FileUpload';
import TaxAuditPanel from './components/TaxAuditPanel';

function formatExact(value: number) {
  return value.toLocaleString('es-MX', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 20,
  });
}

type ExtractMode = 'ingresos' | 'pagos';
type ExtractSortDirection = 'asc' | 'desc';

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

function getExtractCellValue(row: Record<string, string>, key: string) {
  return row[key] ?? '';
}

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
  const [profile, setProfile] = useState<CFDIProfile>('unknown');
  const [cfdi, setCfdi] = useState<CFDIData | null>(null);
  const [ingresoRows, setIngresoRows] = useState<CFDIIngresoRow[]>([]);
  const [pagoRows, setPagoRows] = useState<CFDIPagoRow[]>([]);
  const [analysisEngine, setAnalysisEngine] = useState<'idle' | 'worker' | 'fallback'>('idle');
  const [analysisReason, setAnalysisReason] = useState('');
  const [analysisStageLabel, setAnalysisStageLabel] = useState('Analizando estructura CFDI');
  const [analysisStageProgress, setAnalysisStageProgress] = useState(100);
  const [analysisStageDetail, setAnalysisStageDetail] = useState('');
  const [diagnoseSearchTerm, setDiagnoseSearchTerm] = useState('');
  const [diagnoseColumnFilterKey, setDiagnoseColumnFilterKey] = useState<string>('all');
  const [extractSearchTerm, setExtractSearchTerm] = useState('');
  const [extractColumnFilterKey, setExtractColumnFilterKey] = useState<string>('all');
  const [onlyImpacted, setOnlyImpacted] = useState(true);
  const [selectedConcept, setSelectedConcept] = useState<CFDIConcept | null>(null);
  const [reportExported, setReportExported] = useState(false);
  const [taxesExported, setTaxesExported] = useState(false);
  const [ingresosExported, setIngresosExported] = useState(false);
  const [pagosExported, setPagosExported] = useState(false);
  const [pagosExportError, setPagosExportError] = useState(false);
  const [tableExported, setTableExported] = useState(false);
  const [tableExportError, setTableExportError] = useState(false);
  const [sourceXml, setSourceXml] = useState('');
  const [extractPage, setExtractPage] = useState(1);
  const [extractPageSize, setExtractPageSize] = useState(100);
  const [extractSortKey, setExtractSortKey] = useState<string>('descripcion');
  const [extractSortDirection, setExtractSortDirection] = useState<ExtractSortDirection>('asc');
  const [hiddenIngresoColumns, setHiddenIngresoColumns] = useState<string[]>([]);
  const [hiddenPagoColumns, setHiddenPagoColumns] = useState<string[]>([]);
  const [hiddenDiagnoseColumns, setHiddenDiagnoseColumns] = useState<string[]>([]);
  const [diagnosePage, setDiagnosePage] = useState(1);
  const [diagnosePageSize, setDiagnosePageSize] = useState(100);
  const [diagnoseSortKey, setDiagnoseSortKey] = useState<string>('diferencia');
  const [diagnoseSortDirection, setDiagnoseSortDirection] = useState<ExtractSortDirection>('desc');
  const [taxAuditExpanded, setTaxAuditExpanded] = useState(true);

  const handleFileSelect = async (xml: string) => {
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const { bundle, engine, reason } = await analyzeCFDIWithWorker(xml, ({ label, progress, detail }) => {
        setAnalysisStageLabel(label);
        setAnalysisStageProgress(progress);
        setAnalysisStageDetail(detail ?? '');
      });
      setSourceXml(xml);
      setCfdi(bundle.cfdi);
      setIngresoRows(bundle.ingresoRows);
      setPagoRows(bundle.pagoRows);
      setProfile(bundle.profile);
      setAnalysisEngine(engine);
      setAnalysisReason(reason ?? '');
      setAnalysisStageLabel('Analizando estructura CFDI');
      setAnalysisStageProgress(100);
      setAnalysisStageDetail('');
      setExtractSearchTerm('');
      setExtractColumnFilterKey('all');
      setDiagnoseSearchTerm('');
      setDiagnoseColumnFilterKey('all');
      setExtractPage(1);
      setExtractPageSize(100);
      setExtractSortKey(bundle.profile === 'pagos' ? 'fechaPago' : 'descripcion');
      setExtractSortDirection('asc');
      setDiagnosePage(1);
      setDiagnosePageSize(100);
      setDiagnoseSortKey('diferencia');
      setDiagnoseSortDirection('desc');
      setTaxAuditExpanded(true);
      setHiddenIngresoColumns([]);
      setHiddenPagoColumns([]);
      setHiddenDiagnoseColumns([]);
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

  const exportTaxBreakdown = () => {
    if (!cfdi) return;

    const headers = [
      'concepto_index',
      'descripcion',
      'clave_prod_serv',
      'impuesto',
      'tipo_factor',
      'tasa_porcentaje',
      'base',
      'importe_xml',
      'importe_calculado',
      'diferencia',
    ];

    const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

    const rows = cfdi.conceptos.flatMap((concepto, conceptIndex) =>
      concepto.impuestos.map((impuesto) => [
        conceptIndex + 1,
        concepto.descripcion,
        concepto.claveProdServ,
        impuesto.impuesto,
        impuesto.tipoFactor,
        (impuesto.tasaOCuota * 100).toFixed(6),
        impuesto.base.toFixed(6),
        impuesto.importe.toFixed(6),
        impuesto.importeCalculado.toFixed(6),
        impuesto.diferencia.toFixed(6),
      ])
    );

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Desglose_Impuestos_${cfdi.uuid.substring(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setTaxesExported(true);
    window.setTimeout(() => setTaxesExported(false), 1600);
  };

  const exportIngresosCsv = () => {
    if (!cfdi) return;

    const headers = [
      'UUID',
      'Fecha',
      'Serie',
      'Folio',
      'RFC_Emisor',
      'Nombre_Emisor',
      'RFC_Receptor',
      'Nombre_Receptor',
      'UsoCFDI',
      'MetodoPago',
      'FormaPago',
      'Moneda',
      'TipoCambio',
      'Subtotal',
      'Descuento',
      'Total',
      'ClaveProdServ',
      'Cantidad',
      'Descripcion',
      'ValorUnitario',
      'Importe',
      'ObjetoImp',
      'TipoImp',
      'Base',
      'Impuesto',
      'TipoFactor',
      'TasaOCuota',
      'ImporteImp',
    ];

    const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [
      headers.join(','),
      ...ingresoRows.map((row) => [
        row.uuid,
        row.fecha,
        row.serie,
        row.folio,
        row.rfcEmisor,
        row.nombreEmisor,
        row.rfcReceptor,
        row.nombreReceptor,
        row.usoCfdi,
        row.metodoPago,
        row.formaPago,
        row.moneda,
        row.tipoCambio,
        row.subtotal,
        row.descuento,
        row.total,
        row.claveProdServ,
        row.cantidad,
        row.descripcion,
        row.valorUnitario,
        row.importe,
        row.objetoImp,
        row.tipoImp,
        row.baseImp,
        row.impuesto,
        row.tipoFactor,
        row.tasaCuota,
        row.importeImp,
      ].map(escapeCsv).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CFDI_Ingresos_${cfdi.uuid.substring(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setIngresosExported(true);
    window.setTimeout(() => setIngresosExported(false), 1600);
  };

  const exportPagosCsv = () => {
    if (!cfdi) return;
    try {
      if (pagoRows.length === 0) {
        throw new Error('No es complemento de pagos');
      }
      const headers = [
        'UUID_CFDI',
        'Fecha_CFDI',
        'RFC_Emisor',
        'RFC_Receptor',
        'FechaPago',
        'FormaPago',
        'MonedaP',
        'Monto',
        'UUID_DR',
        'SerieFolio',
        'Parcialidad',
        'ImpPagado',
        'SaldoInsoluto',
        'BaseDR',
        'ImpuestoDR',
        'TipoFactorDR',
        'TasaOCuotaDR',
        'ImporteDR',
      ];

      const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
      const csv = [
        headers.join(','),
        ...pagoRows.map((row) => [
          row.uuidCFDI,
          row.fechaCFDI,
          row.rfcEmisor,
          row.rfcReceptor,
          row.fechaPago,
          row.formaPago,
          row.monedaP,
          row.monto,
          row.uuidDR,
          row.serieFolio,
          row.parcialidad,
          row.impPagado,
          row.saldoInsoluto,
          row.baseDR,
          row.impuestoDR,
          row.tipoFactorDR,
          row.tasaCuotaDR,
          row.importeDR,
        ].map(escapeCsv).join(',')),
      ].join('\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CFDI_Pagos_${cfdi.uuid.substring(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setPagosExportError(false);
      setPagosExported(true);
      window.setTimeout(() => setPagosExported(false), 1600);
    } catch (error) {
      console.error('Error exporting pagos CSV:', error);
      setPagosExported(false);
      setPagosExportError(true);
      window.setTimeout(() => setPagosExportError(false), 2200);
    }
  };

  const exportCurrentTable = () => {
    try {
      if (sortedExtractRows.length === 0 || visibleExtractColumns.length === 0) {
        throw new Error('Sin datos');
      }

      const headers = visibleExtractColumns.map((column) => column.label);
      const csvRows = sortedExtractRows.map((row) =>
        visibleExtractColumns.map((column) => getExtractCellValue(row as Record<string, string>, column.key)).map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')
      );

      const csv = [headers.join(','), ...csvRows].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tabla_${activeDatasetType}_${cfdi?.uuid?.substring(0, 8) || 'cfdi'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setTableExportError(false);
      setTableExported(true);
      window.setTimeout(() => setTableExported(false), 1600);
    } catch {
      setTableExported(false);
      setTableExportError(true);
      window.setTimeout(() => setTableExportError(false), 1600);
    }
  };

  const conceptPool = cfdi
    ? (onlyImpacted ? cfdi.impactedConceptIndexes.map((index) => cfdi.conceptos[index]).filter(Boolean) : cfdi.conceptos)
    : [];

  const activeDatasetType: ExtractMode = profile === 'pagos' ? 'pagos' : 'ingresos';
  const activeExtractBaseRows = activeDatasetType === 'ingresos' ? ingresoRows : pagoRows;
  const extractColumns = activeDatasetType === 'ingresos' ? INGRESO_COLUMNS : PAGO_COLUMNS;
  const activeHiddenColumns = activeDatasetType === 'ingresos' ? hiddenIngresoColumns : hiddenPagoColumns;
  const visibleExtractColumns = extractColumns.filter((column) => !activeHiddenColumns.includes(column.key));
  const visibleDiagnoseColumns = DIAGNOSE_COLUMNS.filter((column) => !hiddenDiagnoseColumns.includes(column.key));
  const filteredExtractRows = activeExtractBaseRows.filter((row) => {
    const search = extractSearchTerm.trim().toLowerCase();
    if (!search) return true;

    if (extractColumnFilterKey === 'all') {
      return Object.values(row).some((value) => String(value).toLowerCase().includes(search));
    }

    return getExtractCellValue(row as Record<string, string>, extractColumnFilterKey).toLowerCase().includes(search);
  });
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

  const sortedExtractRows = useMemo(() => {
    const rows = [...filteredExtractRows];
    rows.sort((left, right) => {
      const leftValue = getExtractCellValue(left as Record<string, string>, extractSortKey).toLowerCase();
      const rightValue = getExtractCellValue(right as Record<string, string>, extractSortKey).toLowerCase();

      const leftNumber = Number(leftValue);
      const rightNumber = Number(rightValue);
      const bothNumeric = !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && leftValue !== '' && rightValue !== '';

      if (bothNumeric) {
        return extractSortDirection === 'asc' ? leftNumber - rightNumber : rightNumber - leftNumber;
      }

      const comparison = leftValue.localeCompare(rightValue, 'es', { numeric: true, sensitivity: 'base' });
      return extractSortDirection === 'asc' ? comparison : -comparison;
    });
    return rows;
  }, [filteredExtractRows, extractSortDirection, extractSortKey]);

  const filteredExtractCount = sortedExtractRows.length;
  const extractTotalPages = Math.max(1, Math.ceil(filteredExtractCount / extractPageSize));
  const safeExtractPage = Math.min(extractPage, extractTotalPages);
  const extractPageStart = filteredExtractCount === 0 ? 0 : (safeExtractPage - 1) * extractPageSize;
  const currentPageRows = sortedExtractRows.slice(extractPageStart, extractPageStart + extractPageSize);
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

  useEffect(() => {
    if (extractPage > extractTotalPages) {
      setExtractPage(extractTotalPages);
    }
  }, [extractPage, extractTotalPages]);

  useEffect(() => {
    if (diagnosePage > diagnoseTotalPages) {
      setDiagnosePage(diagnoseTotalPages);
    }
  }, [diagnosePage, diagnoseTotalPages]);

  if (!cfdi) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-serif italic mb-2 text-[#141414]">CFDI Inspector</h1>
            <p className="text-[#141414]/60 font-mono text-sm uppercase tracking-widest">Auditoría y Validación de Facturas XML</p>
          </div>
          <FileUpload
            onFileSelect={handleFileSelect}
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
      {/* Header */}
      <header className="border-b border-[#141414] sticky top-0 bg-[#E4E3E0] z-10">
        <div className="px-4 py-2.5 flex items-center justify-between gap-6">
        <div className="flex items-start gap-4 min-w-0">
          <button 
            onClick={() => {
              setCfdi(null);
              setIngresoRows([]);
              setPagoRows([]);
              setSourceXml('');
              setProfile('unknown');
              setAnalysisEngine('idle');
              setAnalysisReason('');
              setAnalysisStageLabel('Analizando estructura CFDI');
              setAnalysisStageProgress(100);
              setAnalysisStageDetail('');
              setExtractSearchTerm('');
              setExtractColumnFilterKey('all');
              setDiagnoseSearchTerm('');
              setDiagnoseColumnFilterKey('all');
              setExtractPage(1);
              setExtractPageSize(100);
              setExtractSortKey('descripcion');
              setExtractSortDirection('asc');
              setHiddenIngresoColumns([]);
              setHiddenPagoColumns([]);
              setDiagnosePage(1);
              setDiagnosePageSize(100);
              setDiagnoseSortKey('diferencia');
              setDiagnoseSortDirection('desc');
              setTaxAuditExpanded(true);
              setHiddenDiagnoseColumns([]);
            }}
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
                  {getProfileLabel(profile)}
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
            onClick={exportCurrentTable}
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
              onResetGrid={() => {
                setExtractSearchTerm('');
                setExtractColumnFilterKey('all');
                setExtractPage(1);
                setExtractPageSize(100);
                setExtractSortKey(activeDatasetType === 'pagos' ? 'fechaPago' : 'descripcion');
                setExtractSortDirection('asc');
                if (activeDatasetType === 'ingresos') {
                  setHiddenIngresoColumns([]);
                } else {
                  setHiddenPagoColumns([]);
                }
              }}
              onToggleColumn={(columnKey, hidden) => {
                if (activeDatasetType === 'ingresos') {
                  setHiddenIngresoColumns((current) =>
                    hidden ? current.filter((key) => key !== columnKey) : [...current, columnKey]
                  );
                } else {
                  setHiddenPagoColumns((current) =>
                    hidden ? current.filter((key) => key !== columnKey) : [...current, columnKey]
                  );
                }
              }}
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
