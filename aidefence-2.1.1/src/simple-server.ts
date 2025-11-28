#!/usr/bin/env node
/**
 * Simplified AIMDS Test Server
 * Minimal server for testing CLI functionality
 */

import express from 'express';
import cors from 'cors';
import { ThreatDetection, AnalysisResult } from './types.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());

// Mock threat detection patterns
const THREAT_PATTERNS = [
  /ignore\s+(all\s+)?instructions/i,
  /forget\s+(previous|everything)/i,
  /you\s+are\s+now/i,
  /system\s+prompt/i,
  /jailbreak/i
];

function detectThreats(text: string): ThreatDetection {
  const startTime = Date.now();
  const detectedPatterns: string[] = [];

  for (const pattern of THREAT_PATTERNS) {
    if (pattern.test(text)) {
      detectedPatterns.push(pattern.toString());
    }
  }

  const threat = detectedPatterns.length > 0;
  const confidence = threat ? 0.85 + (Math.random() * 0.15) : Math.random() * 0.3;
  const detectionTime = Date.now() - startTime;

  return {
    threat,
    confidence,
    detectionTime,
    patterns: detectedPatterns,
    severity: threat ? (detectedPatterns.length > 2 ? 'critical' : 'high') : 'low'
  };
}

// Defense endpoint
app.post('/api/v1/defend', (req, res) => {
  try {
    const { action } = req.body;
    const text = action?.text || '';

    const result = detectThreats(text);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analysis endpoint
app.post('/api/v1/analyze', (req, res) => {
  try {
    const { text, deepAnalysis } = req.body;

    const detection = detectThreats(text);

    const result: AnalysisResult = {
      threatLevel: detection.severity || 'low',
      patternsDetected: detection.patterns || [],
      piiFound: /\b\d{3}-\d{2}-\d{4}\b|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i.test(text),
      analysisTime: detection.detectionTime
    };

    if (deepAnalysis) {
      result.formalVerification = {
        violations: detection.threat ? detection.patterns!.length : 0,
        proofStatus: detection.threat ? 'invalid' : 'valid'
      };
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', version: '2.1.0' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`✅ AIMDS Test Server listening on ${HOST}:${PORT}`);
  console.log(`📍 Health: http://${HOST}:${PORT}/health`);
  console.log(`🛡️  Defense API: http://${HOST}:${PORT}/api/v1/defend`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
