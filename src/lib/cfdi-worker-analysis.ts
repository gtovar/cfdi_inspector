import { XMLParser } from 'fast-xml-parser';
import { buildCfdiData, detectCfdiProfile } from '../cfdi/application/cfdiAnalysisService';
import {
  buildCfdiAnalysisBundle,
  extractIngresoRowsData,
  extractPagoRowsData,
} from '../cfdi/application/cfdiExtractionService';
import type { CFDIAnalysisBundle, CFDIData, CFDIIngresoRow, CFDIPagoRow, CFDIProfile } from '../cfdi/application/cfdiTypes';

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

export function detectCFDIProfileWorker(xml: string): CFDIProfile {
  return detectCfdiProfile(xml);
}

export function parseCFDIWorker(xml: string): CFDIData {
  return buildCfdiData(xml);
}

export function extractIngresoRowsWorker(
  xml: string,
  onProgress?: WorkerProgressReporter
): CFDIIngresoRow[] {
  return extractIngresoRowsData(xml, onProgress);
}

export function extractPagoRowsWorker(
  xml: string,
  onProgress?: WorkerProgressReporter
): CFDIPagoRow[] {
  return extractPagoRowsData(xml, onProgress);
}

export function analyzeCFDIWorker(xml: string): CFDIAnalysisBundle {
  return buildCfdiAnalysisBundle(xml);
}
