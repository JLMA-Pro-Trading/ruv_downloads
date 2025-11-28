// AIMDS Gateway Type Definitions

export interface GatewayConfig {
  port: number;
  host: string;
  enableCors?: boolean;
  enableCompression?: boolean;
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  timeouts?: {
    request: number;
    shutdown: number;
  };
}

export interface AgentDBConfig {
  path: string;
  embeddingDim: number;
  hnswConfig?: {
    m: number;
    efConstruction: number;
    efSearch: number;
  };
  quicSync?: {
    enabled: boolean;
    port: number;
    peers: string[];
  };
  memory?: {
    maxEntries: number;
    ttl: number;
  };
}

export interface LeanAgenticConfig {
  enableHashCons?: boolean;
  enableDependentTypes?: boolean;
  enableTheoremProving?: boolean;
  cacheSize?: number;
  proofTimeout?: number;
}

export interface ThreatDetection {
  threat: boolean;
  confidence: number;
  detectionTime: number;
  patterns?: string[];
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface AnalysisResult {
  threatLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  patternsDetected: string[];
  piiFound: boolean;
  analysisTime: number;
  formalVerification?: {
    violations: number;
    proofStatus: 'valid' | 'invalid' | 'unknown';
  };
}
