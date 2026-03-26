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
} from '../application/cfdiTypes';

export { buildCfdiAnalysisBundle as analyzeCFDI, extractIngresoRowsData as extractIngresoRows, extractPagoRowsData as extractPagoRows } from '../application/cfdiExtractionService';
export { buildCfdiData as parseCFDI } from '../application/cfdiAnalysisService';

import { detectCfdiProfile } from '../application/cfdiAnalysisService';
import type { CFDIProfile } from '../application/cfdiTypes';

export function detectCFDIProfile(xmlString: string): CFDIProfile {
  try {
    return detectCfdiProfile(xmlString);
  } catch {
    return 'unknown';
  }
}
