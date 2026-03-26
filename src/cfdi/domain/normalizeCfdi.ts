import type {
  CanonicalCfdi,
  CanonicalConcept,
  CanonicalTaxLine,
  CanonicalTaxSummary,
} from './canonicalCfdi';

function parseXml(xmlString: string): XMLDocument {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  const parseError = xmlDoc.querySelector('parsererror');

  if (parseError) {
    throw new Error('XML inválido');
  }

  return xmlDoc;
}

function getFirstByLocalName(node: Document | Element, localName: string): Element | null {
  return node.getElementsByTagNameNS('*', localName)[0] ?? null;
}

function getChildrenByLocalName(node: Document | Element, localName: string): Element[] {
  return Array.from(node.getElementsByTagNameNS('*', localName));
}

function getAttr(element: Element | null, name: string): string | null {
  if (!element) return null;
  return element.getAttribute(name);
}

function getNumberAttr(element: Element | null, name: string): number | null {
  const value = getAttr(element, name);
  if (value === null || value === '') return null;

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeTaxLine(element: Element): CanonicalTaxLine {
  return {
    base: getNumberAttr(element, 'Base'),
    impuesto: getAttr(element, 'Impuesto'),
    tipoFactor: getAttr(element, 'TipoFactor'),
    tasaOCuota: getNumberAttr(element, 'TasaOCuota'),
    importe: getNumberAttr(element, 'Importe'),
  };
}

function normalizeTaxSummary(container: Element | null): CanonicalTaxSummary {
  if (!container) {
    return {
      traslados: [],
      retenciones: [],
    };
  }

  const trasladosNode = getFirstByLocalName(container, 'Traslados');
  const retencionesNode = getFirstByLocalName(container, 'Retenciones');

  return {
    traslados: trasladosNode ? getChildrenByLocalName(trasladosNode, 'Traslado').map(normalizeTaxLine) : [],
    retenciones: retencionesNode ? getChildrenByLocalName(retencionesNode, 'Retencion').map(normalizeTaxLine) : [],
  };
}

function normalizeConcept(element: Element): CanonicalConcept {
  const impuestosNode = getFirstByLocalName(element, 'Impuestos');
  const impuestos = normalizeTaxSummary(impuestosNode);

  return {
    descripcion: getAttr(element, 'Descripcion'),
    cantidad: getNumberAttr(element, 'Cantidad'),
    valorUnitario: getNumberAttr(element, 'ValorUnitario'),
    importe: getNumberAttr(element, 'Importe'),
    objetoImp: getAttr(element, 'ObjetoImp'),
    traslados: impuestos.traslados,
    retenciones: impuestos.retenciones,
  };
}

export function normalizeCfdi(xmlString: string): CanonicalCfdi {
  const xmlDoc = parseXml(xmlString);

  const comprobante = getFirstByLocalName(xmlDoc, 'Comprobante');
  if (!comprobante) {
    throw new Error('No se encontró el nodo Comprobante');
  }

  const conceptosNode = getFirstByLocalName(comprobante, 'Conceptos');
  const impuestosNode = Array.from(comprobante.children).find((child) => child.localName === 'Impuestos') ?? null;

  return {
    version: getAttr(comprobante, 'Version'),
    tipoDeComprobante: getAttr(comprobante, 'TipoDeComprobante'),
    subTotal: getNumberAttr(comprobante, 'SubTotal'),
    total: getNumberAttr(comprobante, 'Total'),
    moneda: getAttr(comprobante, 'Moneda'),
    descuento: getNumberAttr(comprobante, 'Descuento'),
    conceptos: conceptosNode ? getChildrenByLocalName(conceptosNode, 'Concepto').map(normalizeConcept) : [],
    resumenImpuestos: normalizeTaxSummary(impuestosNode),
  };
}
