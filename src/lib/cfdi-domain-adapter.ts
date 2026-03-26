import type { CanonicalCfdi, CanonicalConcept, CanonicalTaxLine } from '../cfdi/domain/canonicalCfdi';
import { diagnoseCfdiMath, roundCurrency, sumSafe, type MathFinding } from '../cfdi/domain/diagnoseCfdiMath';
import type { AuditFinding, CFDIData, CFDIImpuesto } from './cfdi';

function toCanonicalTaxLine(impuesto: CFDIImpuesto): CanonicalTaxLine {
  return {
    base: impuesto.base,
    impuesto: impuesto.impuesto || null,
    tipoFactor: impuesto.tipoFactor || null,
    tasaOCuota: impuesto.tasaOCuota,
    importe: impuesto.importe,
  };
}

function toCanonicalConcept(concepto: CFDIData['conceptos'][number]): CanonicalConcept {
  return {
    descripcion: concepto.descripcion || null,
    cantidad: concepto.cantidad,
    valorUnitario: concepto.valorUnitario,
    importe: concepto.importe,
    objetoImp: null,
    traslados: concepto.impuestos.filter((impuesto) => impuesto.tipo === 'Traslado').map(toCanonicalTaxLine),
    retenciones: concepto.impuestos.filter((impuesto) => impuesto.tipo === 'Retencion').map(toCanonicalTaxLine),
  };
}

export function toCanonicalCfdi(data: CFDIData): CanonicalCfdi {
  return {
    version: data.version || null,
    tipoDeComprobante: 'I',
    subTotal: data.subtotal,
    total: data.total,
    moneda: null,
    descuento: data.descuento,
    conceptos: data.conceptos.map(toCanonicalConcept),
    resumenImpuestos: {
      traslados: data.impuestosGlobales.filter((impuesto) => impuesto.tipo === 'Traslado').map(toCanonicalTaxLine),
      retenciones: data.impuestosGlobales.filter((impuesto) => impuesto.tipo === 'Retencion').map(toCanonicalTaxLine),
    },
  };
}

function mapMathSeverity(severity: MathFinding['severity']): AuditFinding['severity'] {
  return severity === 'error' ? 'critical' : 'warning';
}

function buildMathFindingTitle(finding: MathFinding): string {
  switch (finding.code) {
    case 'SUBTOTAL_MISMATCH':
      return 'Discrepancia en subtotal';
    case 'LINE_TAX_MISMATCH':
      return `Traslado inconsistente en concepto ${(finding.conceptIndex ?? 0) + 1}`;
    case 'TOTAL_MISMATCH':
      return 'Discrepancia en total';
    case 'LINE_TAX_NOT_RECALCULATED':
      return `Traslado no recalculado en concepto ${(finding.conceptIndex ?? 0) + 1}`;
    default:
      return finding.code;
  }
}

function formatMoney(value: number | null): string {
  if (value === null) return '-';
  return value.toFixed(2);
}

function buildMathFindingSummary(finding: MathFinding): string {
  if (finding.code === 'LINE_TAX_NOT_RECALCULATED') {
    const tipoFactor = String(finding.context?.tipoFactor ?? '-');
    return `TipoFactor ${tipoFactor} no se recalcula como tasa en v0.`;
  }

  return `XML declara ${formatMoney(finding.declared)} y el cálculo da ${formatMoney(finding.calculated)}.`;
}

function buildMathFindingMessage(finding: MathFinding): string {
  return `${buildMathFindingTitle(finding)}: ${buildMathFindingSummary(finding)}`;
}

export function enrichCfdiWithMathDiagnosis(data: CFDIData): CFDIData {
  data.subtotalCalculado = roundCurrency(sumSafe(data.conceptos.map((concepto) => concepto.importe)));
  data.totalCalculado = roundCurrency(
    data.subtotalCalculado
      - roundCurrency(data.descuento ?? 0)
      + roundCurrency(sumSafe(data.conceptos.flatMap((concepto) => concepto.impuestos.filter((impuesto) => impuesto.tipo === 'Traslado').map((impuesto) => impuesto.importe))))
      - roundCurrency(sumSafe(data.conceptos.flatMap((concepto) => concepto.impuestos.filter((impuesto) => impuesto.tipo === 'Retencion').map((impuesto) => impuesto.importe)))),
  );

  const diagnosis = diagnoseCfdiMath(toCanonicalCfdi(data));

  diagnosis.findings.forEach((finding) => {
    data.findings.push({
      id: `math-${finding.code}-${finding.level}-${finding.conceptIndex ?? 'na'}-${finding.taxIndex ?? 'na'}`,
      severity: mapMathSeverity(finding.severity),
      title: buildMathFindingTitle(finding),
      summary: buildMathFindingSummary(finding),
    });

    if (finding.severity === 'error') {
      data.hallazgos.push(buildMathFindingMessage(finding));
    }

    if (typeof finding.conceptIndex === 'number' && !data.impactedConceptIndexes.includes(finding.conceptIndex)) {
      data.impactedConceptIndexes.push(finding.conceptIndex);
    }
  });

  return data;
}
