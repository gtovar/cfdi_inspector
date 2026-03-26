/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  ArrowLeft,
  ChevronRight,
  Database,
  User,
  Calendar,
  Sparkles
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CFDIData, CFDIConcept, CFDIProfile, CFDIIngresoRow, CFDIPagoRow } from './lib/cfdi';
import { analyzeCFDIWithWorker } from './lib/cfdi-worker-client';
import { explainCfdiField } from './cfdi/domain/explainCfdiField';
import FileUpload from './components/FileUpload';

function formatExact(value: number) {
  return value.toLocaleString('es-MX', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 20,
  });
}

type ExtractMode = 'ingresos' | 'pagos';
type ExtractSortDirection = 'asc' | 'desc';

interface SummaryFieldCard {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  meaning?: string;
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

  const renderExtractWorkspace = (embedded = false) => (
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
              onChange={(e) => {
                setExtractColumnFilterKey(e.target.value);
                setExtractPage(1);
              }}
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
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
            <input
              type="text"
              placeholder={`Buscar en ${extractColumnFilterKey === 'all' ? 'todas las columnas' : extractColumns.find((column) => column.key === extractColumnFilterKey)?.label ?? 'columna'}...`}
              className="w-full pl-9 pr-4 py-2 text-xs font-mono bg-transparent border border-[#141414]/20 focus:border-[#141414] outline-none transition-colors"
              value={extractSearchTerm}
              onChange={(e) => {
                setExtractSearchTerm(e.target.value);
                setExtractPage(1);
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-70">
            <span>Ordenar por</span>
            <select
              value={extractSortKey}
              onChange={(e) => {
                setExtractSortKey(e.target.value);
                setExtractPage(1);
              }}
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
            onClick={() => {
              setExtractSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
              setExtractPage(1);
            }}
            className="border border-[#141414]/20 px-3 py-2 text-[10px] font-mono uppercase tracking-widest hover:border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
          >
            {extractSortDirection === 'asc' ? 'Asc' : 'Desc'}
          </button>
          <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-70">
            <span>Filas por pagina</span>
            <select
              value={extractPageSize}
              onChange={(e) => {
                setExtractPageSize(Number(e.target.value));
                setExtractPage(1);
              }}
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
            onClick={() => {
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
                onClick={() => {
                  if (activeDatasetType === 'ingresos') {
                    setHiddenIngresoColumns((current) =>
                      hidden ? current.filter((key) => key !== column.key) : [...current, column.key]
                    );
                  } else {
                    setHiddenPagoColumns((current) =>
                      hidden ? current.filter((key) => key !== column.key) : [...current, column.key]
                    );
                  }
                }}
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
                      {getExtractCellValue(row as Record<string, string>, column.key) || '-'}
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
            onClick={() => setExtractPage((current) => Math.max(1, current - 1))}
            disabled={safeExtractPage === 1}
            className="px-3 py-2 border border-[#141414]/20 text-[10px] font-mono uppercase tracking-widest disabled:opacity-30 hover:border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
          >
            Anterior
          </button>
          <button
            onClick={() => setExtractPage((current) => Math.min(extractTotalPages, current + 1))}
            disabled={safeExtractPage === extractTotalPages}
            className="px-3 py-2 border border-[#141414]/20 text-[10px] font-mono uppercase tracking-widest disabled:opacity-30 hover:border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
          >
            Siguiente
          </button>
        </div>
      </div>
    </section>
  );

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

        <section className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
          <div className={`grid border-b border-[#141414] ${summaryFields.length >= 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {summaryFields.map((field, index) => {
              const Icon = field.icon;
              return (
                <div
                  key={field.key}
                  className={`p-4 flex items-start gap-3 ${index < summaryFields.length - 1 ? 'border-r border-[#141414]' : ''}`}
                  title={field.meaning}
                >
                  <Icon size={16} className="opacity-50 mt-1" />
                  <div>
                    <p className="text-[10px] font-mono uppercase opacity-50">{field.label}</p>
                    <p className="text-xs font-bold truncate max-w-[200px]">{field.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-b border-[#141414] bg-[#141414]/[0.03]">
            <button
              type="button"
              onClick={() => setTaxAuditExpanded((current) => !current)}
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
          <div className="flex-1 min-h-0 flex flex-col">
            {renderExtractWorkspace(true)}
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
                        <div className={`flex justify-between text-xs font-mono pt-2 border-t border-[#141414]/10 mt-2 font-bold ${selectedConcept.diferencia !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                          <span>Diferencia:</span>
                          <span>${formatExact(selectedConcept.diferencia)}</span>
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
                              <span
                                className="text-[10px] font-mono font-bold uppercase"
                                title={`${getExplainedMeaning('impuesto', imp.impuesto)} ${getExplainedMeaning('tipoFactor', imp.tipoFactor)}`}
                              >
                                {getExplainedTaxLabel(imp.impuesto)} ({imp.tipoFactor})
                              </span>
                              <span
                                className="text-[10px] font-mono"
                                title={getExplainedMeaning('tasaOCuota', imp.tasaOCuota)}
                              >
                                Tasa: {(imp.tasaOCuota * 100).toFixed(2)}%
                              </span>
                            </div>
                            <p className="text-[10px] font-mono opacity-55 mb-3">
                              {getExplainedMeaning('tipoFactor', imp.tipoFactor)}
                            </p>
                            <div className="space-y-1 text-[10px] font-mono opacity-70">
                              <div className="flex justify-between">
                                <span title={getExplainedMeaning('base', imp.base)}>Base:</span>
                                <span>${imp.base.toFixed(6)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span title={getExplainedMeaning('importe', imp.importe)}>Importe XML:</span>
                                <span>${imp.importe.toFixed(6)}</span>
                              </div>
                              <div className="flex justify-between italic">
                                <span>Importe Calc:</span>
                                <span>${imp.importeCalculado.toFixed(6)}</span>
                              </div>
                              <div className={`flex justify-between pt-2 border-t border-[#141414]/10 mt-2 ${imp.diferencia !== 0 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                <span>Diferencia:</span>
                                <span>${formatExact(imp.diferencia)}</span>
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
