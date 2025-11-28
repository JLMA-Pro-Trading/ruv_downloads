/**
 * @fileoverview ruvector-extensions - Advanced features for ruvector
 *
 * Provides embeddings integration, UI components, export utilities,
 * temporal tracking, and persistence layers for ruvector vector database.
 *
 * @module ruvector-extensions
 * @author ruv.io Team <info@ruv.io>
 * @license MIT
 */
export { EmbeddingProvider, OpenAIEmbeddings, CohereEmbeddings, AnthropicEmbeddings, HuggingFaceEmbeddings, embedAndInsert, embedAndSearch, type RetryConfig, type EmbeddingResult, type BatchEmbeddingResult, type EmbeddingError, type DocumentToEmbed, type OpenAIEmbeddingsConfig, type CohereEmbeddingsConfig, type AnthropicEmbeddingsConfig, type HuggingFaceEmbeddingsConfig, } from './embeddings.js';
export { default as embeddings } from './embeddings.js';
export { buildGraphFromEntries, buildGraphFromVectorDB, exportToGraphML, exportToGEXF, exportToNeo4j, exportToNeo4jJSON, exportToD3, exportToD3Hierarchy, exportToNetworkX, exportToNetworkXEdgeList, exportToNetworkXAdjacencyList, exportGraph, GraphMLStreamExporter, D3StreamExporter, streamToGraphML, validateGraph, type Graph, type GraphNode, type GraphEdge, type ExportOptions, type ExportFormat, type ExportResult } from './exporters.js';
export { TemporalTracker, temporalTracker, ChangeType, isChange, isVersion, type Change, type Version, type VersionDiff, type AuditLogEntry, type CreateVersionOptions, type QueryOptions, type VisualizationData, type TemporalTrackerEvents, } from './temporal.js';
export { UIServer, startUIServer, type GraphNode as UIGraphNode, type GraphLink, type GraphData, } from "./ui-server.js";
//# sourceMappingURL=index.d.ts.map