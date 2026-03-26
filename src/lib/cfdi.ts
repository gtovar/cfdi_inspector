/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type {
  AuditFinding,
  CFDIAnalysisBundle,
  CFDIConcept,
  CFDIData,
  CFDIImpuesto,
  CFDIIngresoRow,
  CFDIPagoRow,
  CFDIProfile,
  TaxAuditGroup,
} from '../cfdi/application/cfdiTypes';
import type {
  CFDIAnalysisBundle,
  CFDIData,
  CFDIIngresoRow,
  CFDIPagoRow,
  CFDIProfile,
} from '../cfdi/application/cfdiTypes';

import {
  buildCfdiAnalysisBundle,
  extractIngresoRowsData,
  extractPagoRowsData,
} from '../cfdi/application/cfdiExtractionService';
import { buildCfdiData, detectCfdiProfile } from '../cfdi/application/cfdiAnalysisService';

export function parseCFDI(xmlString: string): CFDIData {
  return buildCfdiData(xmlString);
}

export function extractIngresoRows(xmlString: string): CFDIIngresoRow[] {
  return extractIngresoRowsData(xmlString);
}

export function extractPagoRows(xmlString: string): CFDIPagoRow[] {
  return extractPagoRowsData(xmlString);
}

export function detectCFDIProfile(xmlString: string): CFDIProfile {
  try {
    return detectCfdiProfile(xmlString);
  } catch {
    return 'unknown';
  }
}

export function analyzeCFDI(xmlString: string): CFDIAnalysisBundle {
  return buildCfdiAnalysisBundle(xmlString);
}
