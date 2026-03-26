import { XMLParser } from 'fast-xml-parser';
import { enrichCfdiWithMathDiagnosis } from './cfdi-domain-adapter';
import type {
  AuditFinding,
  CFDIAnalysisBundle,
  CFDIData,
  CFDIImpuesto,
  CFDIConcept,
  CFDIIngresoRow,
  CFDIPagoRow,
  CFDIProfile,
  TaxAuditGroup,
} from './cfdi';

type XmlNode = Record<string, unknown>;
type WorkerProgressReporter = (progress: number, detail: string) => void;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function getAttr(node: XmlNode | undefined | null, name: string): string {
  if (!node) return '';
  const value = node[`@_${name}`];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function getNum(node: XmlNode | undefined | null, name: string): number {
  const value = getAttr(node, name);
  return value ? Number(value) : 0;
}

function getComprobanteRoot(xml: string): XmlNode {
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const comprobante = parsed.Comprobante as XmlNode | undefined;
  if (!comprobante) {
    throw new Error('No se encontró el nodo Comprobante');
  }
  return comprobante;
}

function getTimbre(comprobante: XmlNode): XmlNode | null {
  const complemento = comprobante.Complemento as XmlNode | undefined;
  if (!complemento) return null;
  const timbre = complemento.TimbreFiscalDigital as XmlNode | undefined;
  return timbre ?? null;
}

function summarizeDifference(xmlValue: number, calcValue: number) {
  return `XML ${xmlValue.toFixed(2)} vs cálculo ${calcValue.toFixed(2)}.`;
}

function parseConceptTaxes(conceptoNode: XmlNode): CFDIImpuesto[] {
  const impuestosNode = conceptoNode.Impuestos as XmlNode | undefined;
  if (!impuestosNode) return [];

  const trasladosNode = impuestosNode.Traslados as XmlNode | undefined;
  const retencionesNode = impuestosNode.Retenciones as XmlNode | undefined;
  const traslados = asArray((trasladosNode?.Traslado as XmlNode | XmlNode[] | undefined));
  const retenciones = asArray((retencionesNode?.Retencion as XmlNode | XmlNode[] | undefined));

  return [
    ...traslados.map((tax): CFDIImpuesto => {
      const base = getNum(tax, 'Base');
      const tasa = getNum(tax, 'TasaOCuota');
      const importe = getNum(tax, 'Importe');
      const importeCalculado = Number((base * tasa).toFixed(6));
      return {
        tipo: 'Traslado',
        impuesto: getAttr(tax, 'Impuesto'),
        base,
        tipoFactor: getAttr(tax, 'TipoFactor'),
        tasaOCuota: tasa,
        importe,
        importeCalculado,
        diferencia: Math.abs(importe - base * tasa),
      };
    }),
    ...retenciones.map((tax): CFDIImpuesto => {
      const base = getNum(tax, 'Base');
      const tasa = getNum(tax, 'TasaOCuota');
      const importe = getNum(tax, 'Importe');
      const importeCalculado = Number((base * tasa).toFixed(6));
      return {
        tipo: 'Retencion',
        impuesto: getAttr(tax, 'Impuesto'),
        base,
        tipoFactor: getAttr(tax, 'TipoFactor'),
        tasaOCuota: tasa,
        importe,
        importeCalculado,
        diferencia: Math.abs(importe - base * tasa),
      };
    }),
  ];
}

function parseConcepts(comprobante: XmlNode): CFDIConcept[] {
  const conceptosContainer = comprobante.Conceptos as XmlNode | undefined;
  const conceptos = asArray((conceptosContainer?.Concepto as XmlNode | XmlNode[] | undefined));

  return conceptos.map((node): CFDIConcept => {
    const cantidad = getNum(node, 'Cantidad');
    const valorUnitario = getNum(node, 'ValorUnitario');
    const importe = getNum(node, 'Importe');

    return {
      descripcion: getAttr(node, 'Descripcion'),
      cantidad,
      valorUnitario,
      importe,
      importeCalculado: Number((cantidad * valorUnitario).toFixed(6)),
      diferencia: Math.abs(importe - cantidad * valorUnitario),
      claveProdServ: getAttr(node, 'ClaveProdServ'),
      impuestos: parseConceptTaxes(node),
    };
  });
}

function parseGlobalTaxes(comprobante: XmlNode): CFDIImpuesto[] {
  const impuestosNode = comprobante.Impuestos as XmlNode | undefined;
  if (!impuestosNode) return [];
  const trasladosNode = impuestosNode.Traslados as XmlNode | undefined;
  const traslados = asArray((trasladosNode?.Traslado as XmlNode | XmlNode[] | undefined));

  return traslados.map((tax): CFDIImpuesto => ({
    tipo: 'Traslado',
    impuesto: getAttr(tax, 'Impuesto'),
    base: getNum(tax, 'Base'),
    tipoFactor: getAttr(tax, 'TipoFactor'),
    tasaOCuota: getNum(tax, 'TasaOCuota'),
    importe: getNum(tax, 'Importe'),
    importeCalculado: 0,
    diferencia: 0,
  }));
}

export function detectCFDIProfileWorker(xml: string): CFDIProfile {
  const comprobante = getComprobanteRoot(xml);
  const complemento = comprobante.Complemento as XmlNode | undefined;
  const hasPagos = complemento
    ? Object.keys(complemento).some((key) => key.toLowerCase().includes('pagos'))
    : false;
  if (hasPagos) return 'pagos';

  const conceptosContainer = comprobante.Conceptos as XmlNode | undefined;
  const conceptos = asArray((conceptosContainer?.Concepto as XmlNode | XmlNode[] | undefined));
  if (getAttr(comprobante, 'TipoDeComprobante') === 'I' || conceptos.length > 0) {
    return 'ingreso';
  }

  return 'unknown';
}

export function parseCFDIWorker(xml: string): CFDIData {
  const comprobante = getComprobanteRoot(xml);
  const emisor = comprobante.Emisor as XmlNode | undefined;
  const receptor = comprobante.Receptor as XmlNode | undefined;
  const timbre = getTimbre(comprobante);
  const conceptos = parseConcepts(comprobante);
  const impuestosGlobales = parseGlobalTaxes(comprobante);

  const data: CFDIData = {
    version: getAttr(comprobante, 'Version'),
    fecha: getAttr(comprobante, 'Fecha'),
    uuid: getAttr(timbre, 'UUID'),
    emisor: getAttr(emisor, 'Nombre') || getAttr(emisor, 'Rfc'),
    receptor: getAttr(receptor, 'Nombre') || getAttr(receptor, 'Rfc'),
    subtotal: getNum(comprobante, 'SubTotal'),
    descuento: getNum(comprobante, 'Descuento'),
    total: getNum(comprobante, 'Total'),
    conceptos,
    impuestosGlobales,
    subtotalCalculado: conceptos.reduce((acc, concepto) => acc + concepto.importe, 0),
    totalCalculado: 0,
    hallazgos: [],
    findings: [],
    impactedConceptIndexes: [],
    taxAuditGroups: [],
    verdict: {
      status: 'clean',
      title: 'Sin discrepancias detectadas',
      summary: 'Los importes principales cuadran con el cálculo actual.',
    },
    supportText: '',
  };

  const sumaTraslados = impuestosGlobales.reduce((acc, tax) => acc + tax.importe, 0);
  data.totalCalculado = data.subtotal - data.descuento + sumaTraslados;
  enrichCfdiWithMathDiagnosis(data);

  const conceptWarnings = conceptos
    .map((concepto, index) => ({ concepto, index }))
    .filter(({ concepto }) => concepto.diferencia !== 0)
    .sort((a, b) => b.concepto.diferencia - a.concepto.diferencia)
    .slice(0, 3);

  conceptWarnings.forEach(({ concepto, index }) => {
    data.findings.push({
      id: `concept-${index}`,
      severity: concepto.diferencia > 0.01 ? 'critical' : 'warning',
      title: `Importe inconsistente en concepto ${index + 1}`,
      summary: `${concepto.descripcion}: ${summarizeDifference(concepto.importe, concepto.importeCalculado)}`,
    });
    if (!data.impactedConceptIndexes.includes(index)) data.impactedConceptIndexes.push(index);
  });

  const taxGroupMap = new Map<string, TaxAuditGroup>();

  conceptos.forEach((concepto, conceptIndex) => {
    concepto.impuestos.forEach((impuesto) => {
      const key = `${impuesto.impuesto}|${impuesto.tipoFactor}|${impuesto.tasaOCuota}`;
      const current = taxGroupMap.get(key) ?? {
        key,
        impuesto: impuesto.impuesto,
        tipoFactor: impuesto.tipoFactor,
        tasaOCuota: impuesto.tasaOCuota,
        importeDetalle: 0,
        importeAgrupado: 0,
        diferencia: 0,
        conceptos: [],
      };
      current.importeDetalle += impuesto.importe;
      if (!current.conceptos.includes(conceptIndex)) current.conceptos.push(conceptIndex);
      taxGroupMap.set(key, current);
    });
  });

  impuestosGlobales.forEach((impuesto) => {
    const key = `${impuesto.impuesto}|${impuesto.tipoFactor}|${impuesto.tasaOCuota}`;
    const current = taxGroupMap.get(key) ?? {
      key,
      impuesto: impuesto.impuesto,
      tipoFactor: impuesto.tipoFactor,
      tasaOCuota: impuesto.tasaOCuota,
      importeDetalle: 0,
      importeAgrupado: 0,
      diferencia: 0,
      conceptos: [],
    };
    current.importeAgrupado += impuesto.importe;
    taxGroupMap.set(key, current);
  });

  data.taxAuditGroups = Array.from(taxGroupMap.values())
    .map((group) => ({ ...group, diferencia: group.importeAgrupado - group.importeDetalle }))
    .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));

  data.taxAuditGroups
    .filter((group) => Math.abs(group.diferencia) !== 0)
    .slice(0, 3)
    .forEach((group) => {
      data.findings.push({
        id: `tax-group-${group.key}`,
        severity: Math.abs(group.diferencia) > 0.01 ? 'critical' : 'warning',
        title: `Diferencia en traslado ${group.impuesto} ${(group.tasaOCuota * 100).toFixed(2)}%`,
        summary: `Detalle ${group.importeDetalle.toFixed(2)} vs agrupado ${group.importeAgrupado.toFixed(2)}.`,
      });
      group.conceptos.forEach((index) => {
        if (!data.impactedConceptIndexes.includes(index)) data.impactedConceptIndexes.push(index);
      });
    });

  data.impactedConceptIndexes.sort((a, b) => a - b);

  const uniqueFindings = new Map<string, AuditFinding>();
  data.findings.forEach((finding) => {
    const key = `${finding.severity}|${finding.title}|${finding.summary}`;
    if (!uniqueFindings.has(key)) uniqueFindings.set(key, finding);
  });
  data.findings = Array.from(uniqueFindings.values()).sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return a.title.localeCompare(b.title, 'es');
  });

  const criticalFindings = data.findings.filter((finding) => finding.severity === 'critical').length;
  const warningFindings = data.findings.filter((finding) => finding.severity === 'warning').length;

  if (criticalFindings > 0) {
    data.verdict = {
      status: 'critical',
      title: 'CFDI con discrepancias críticas',
      summary: `Se detectaron ${criticalFindings} hallazgo(s) críticos que requieren revisión operativa.`,
    };
  } else if (warningFindings > 0) {
    data.verdict = {
      status: 'review',
      title: 'CFDI requiere revisión',
      summary: `Hay ${warningFindings} alerta(s) menores, probablemente asociadas a redondeo o captura.`,
    };
  }

  data.supportText = [
    data.verdict.title,
    data.verdict.summary,
    ...data.findings.slice(0, 5).map((finding) => `${finding.title}: ${finding.summary}`),
  ].join('\n');

  return data;
}

export function extractIngresoRowsWorker(
  xml: string,
  onProgress?: WorkerProgressReporter
): CFDIIngresoRow[] {
  const comprobante = getComprobanteRoot(xml);
  const timbre = getTimbre(comprobante);
  const emisor = comprobante.Emisor as XmlNode | undefined;
  const receptor = comprobante.Receptor as XmlNode | undefined;
  const conceptosContainer = comprobante.Conceptos as XmlNode | undefined;
  const conceptos = asArray((conceptosContainer?.Concepto as XmlNode | XmlNode[] | undefined));

  const baseRow = {
    uuid: getAttr(timbre, 'UUID'),
    fecha: getAttr(comprobante, 'Fecha'),
    serie: getAttr(comprobante, 'Serie'),
    folio: getAttr(comprobante, 'Folio'),
    rfcEmisor: getAttr(emisor, 'Rfc'),
    nombreEmisor: getAttr(emisor, 'Nombre'),
    rfcReceptor: getAttr(receptor, 'Rfc'),
    nombreReceptor: getAttr(receptor, 'Nombre'),
    usoCfdi: getAttr(receptor, 'UsoCFDI'),
    metodoPago: getAttr(comprobante, 'MetodoPago'),
    formaPago: getAttr(comprobante, 'FormaPago'),
    moneda: getAttr(comprobante, 'Moneda'),
    tipoCambio: getAttr(comprobante, 'TipoCambio'),
    subtotal: getAttr(comprobante, 'SubTotal'),
    descuento: getAttr(comprobante, 'Descuento'),
    total: getAttr(comprobante, 'Total'),
  };

  const rows: CFDIIngresoRow[] = [];

  onProgress?.(0, 'Filas: 0');

  conceptos.forEach((concepto, index) => {
    const conceptBase = {
      ...baseRow,
      claveProdServ: getAttr(concepto, 'ClaveProdServ'),
      cantidad: getAttr(concepto, 'Cantidad'),
      descripcion: getAttr(concepto, 'Descripcion'),
      valorUnitario: getAttr(concepto, 'ValorUnitario'),
      importe: getAttr(concepto, 'Importe'),
      objetoImp: getAttr(concepto, 'ObjetoImp'),
    };

    const impuestos = concepto.Impuestos as XmlNode | undefined;
    const trasladosNode = impuestos?.Traslados as XmlNode | undefined;
    const retencionesNode = impuestos?.Retenciones as XmlNode | undefined;
    const traslados = asArray((trasladosNode?.Traslado as XmlNode | XmlNode[] | undefined));
    const retenciones = asArray((retencionesNode?.Retencion as XmlNode | XmlNode[] | undefined));

    if (traslados.length === 0 && retenciones.length === 0) {
      rows.push({
        ...conceptBase,
        tipoImp: '',
        baseImp: '',
        impuesto: '',
        tipoFactor: '',
        tasaCuota: '',
        importeImp: '',
      });
      return;
    }

    traslados.forEach((tax) => {
      rows.push({
        ...conceptBase,
        tipoImp: 'Traslado',
        baseImp: getAttr(tax, 'Base'),
        impuesto: getAttr(tax, 'Impuesto'),
        tipoFactor: getAttr(tax, 'TipoFactor'),
        tasaCuota: getAttr(tax, 'TasaOCuota'),
        importeImp: getAttr(tax, 'Importe'),
      });
    });

    retenciones.forEach((tax) => {
      rows.push({
        ...conceptBase,
        tipoImp: 'Retención',
        baseImp: getAttr(tax, 'Base'),
        impuesto: getAttr(tax, 'Impuesto'),
        tipoFactor: getAttr(tax, 'TipoFactor'),
        tasaCuota: getAttr(tax, 'TasaOCuota'),
        importeImp: getAttr(tax, 'Importe'),
      });
    });

    if ((index + 1) % 25 === 0 || index === conceptos.length - 1) {
      onProgress?.(Math.round(((index + 1) / (conceptos.length || 1)) * 100), `Filas: ${rows.length.toLocaleString('es-MX')}`);
    }
  });

  return rows;
}

export function extractPagoRowsWorker(
  xml: string,
  onProgress?: WorkerProgressReporter
): CFDIPagoRow[] {
  const comprobante = getComprobanteRoot(xml);
  const timbre = getTimbre(comprobante);
  const emisor = comprobante.Emisor as XmlNode | undefined;
  const receptor = comprobante.Receptor as XmlNode | undefined;
  const complemento = comprobante.Complemento as XmlNode | undefined;
  const pagosContainer = complemento
    ? Object.entries(complemento).find(([key]) => key.toLowerCase().includes('pagos'))?.[1] as XmlNode | undefined
    : undefined;

  if (!pagosContainer) {
    throw new Error('No se encontró el complemento de pagos o no hay pagos registrados');
  }

  const pagos = asArray((pagosContainer.Pago as XmlNode | XmlNode[] | undefined));
  const rows: CFDIPagoRow[] = [];
  onProgress?.(0, 'Filas: 0');

  pagos.forEach((pago, index) => {
    const doctos = asArray((pago.DoctoRelacionado as XmlNode | XmlNode[] | undefined));
    const fechaPago = getAttr(pago, 'FechaPago');
    const formaPago = getAttr(pago, 'FormaDePagoP') || getAttr(pago, 'FormaPagoP');
    const monedaP = getAttr(pago, 'MonedaP');
    const monto = getAttr(pago, 'Monto');

    if (doctos.length === 0) {
      rows.push({
        uuidCFDI: getAttr(timbre, 'UUID'),
        fechaCFDI: getAttr(comprobante, 'Fecha'),
        rfcEmisor: getAttr(emisor, 'Rfc'),
        rfcReceptor: getAttr(receptor, 'Rfc'),
        fechaPago,
        formaPago,
        monedaP,
        monto,
        uuidDR: '',
        serieFolio: '',
        parcialidad: '',
        impPagado: '',
        saldoInsoluto: '',
        baseDR: '',
        impuestoDR: '',
        tipoFactorDR: '',
        tasaCuotaDR: '',
        importeDR: '',
      });
      return;
    }

    doctos.forEach((docto) => {
      const baseRow = {
        uuidCFDI: getAttr(timbre, 'UUID'),
        fechaCFDI: getAttr(comprobante, 'Fecha'),
        rfcEmisor: getAttr(emisor, 'Rfc'),
        rfcReceptor: getAttr(receptor, 'Rfc'),
        fechaPago,
        formaPago,
        monedaP,
        monto,
        uuidDR: getAttr(docto, 'IdDocumento'),
        serieFolio: [getAttr(docto, 'Serie'), getAttr(docto, 'Folio')].filter(Boolean).join('-') || 'N/A',
        parcialidad: getAttr(docto, 'NumParcialidad'),
        impPagado: getAttr(docto, 'ImpPagado'),
        saldoInsoluto: getAttr(docto, 'ImpSaldoInsoluto'),
      };

      const impuestosDR = docto.ImpuestosDR as XmlNode | undefined;
      const trasladosDR = asArray(((impuestosDR?.TrasladosDR as XmlNode | undefined)?.TrasladoDR as XmlNode | XmlNode[] | undefined));
      const retencionesDR = asArray(((impuestosDR?.RetencionesDR as XmlNode | undefined)?.RetencionDR as XmlNode | XmlNode[] | undefined));

      if (trasladosDR.length === 0 && retencionesDR.length === 0) {
        rows.push({
          ...baseRow,
          baseDR: '',
          impuestoDR: '',
          tipoFactorDR: '',
          tasaCuotaDR: '',
          importeDR: '',
        });
        return;
      }

      trasladosDR.forEach((tax) => {
        rows.push({
          ...baseRow,
          baseDR: getAttr(tax, 'BaseDR'),
          impuestoDR: getAttr(tax, 'ImpuestoDR'),
          tipoFactorDR: getAttr(tax, 'TipoFactorDR'),
          tasaCuotaDR: getAttr(tax, 'TasaOCuotaDR'),
          importeDR: getAttr(tax, 'ImporteDR'),
        });
      });

      retencionesDR.forEach((tax) => {
        rows.push({
          ...baseRow,
          baseDR: getAttr(tax, 'BaseDR'),
          impuestoDR: getAttr(tax, 'ImpuestoDR'),
          tipoFactorDR: getAttr(tax, 'TipoFactorDR'),
          tasaCuotaDR: getAttr(tax, 'TasaOCuotaDR'),
          importeDR: getAttr(tax, 'ImporteDR'),
        });
      });
    });

    if ((index + 1) % 5 === 0 || index === pagos.length - 1) {
      onProgress?.(Math.round(((index + 1) / (pagos.length || 1)) * 100), `Filas: ${rows.length.toLocaleString('es-MX')}`);
    }
  });

  if (rows.length === 0) {
    throw new Error('No se encontró el complemento de pagos o no hay pagos registrados');
  }

  return rows;
}

export function analyzeCFDIWorker(xml: string): CFDIAnalysisBundle {
  return {
    profile: detectCFDIProfileWorker(xml),
    cfdi: parseCFDIWorker(xml),
    ingresoRows: extractIngresoRowsWorker(xml),
    pagoRows: (() => {
      try {
        return extractPagoRowsWorker(xml);
      } catch {
        return [];
      }
    })(),
  };
}
