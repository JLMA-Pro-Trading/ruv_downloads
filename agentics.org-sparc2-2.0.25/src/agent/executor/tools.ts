/**
 * Agent Tools
 * Defines tools that can be used by agents
 */

import { logMessage } from "../../logger.ts";
import { AgentContext, ToolDefinition, ToolFunction } from "../types.ts";
import { executeCode } from "../../sandbox/codeInterpreter.ts";
import { searchDiffEntries } from "../../vector/vectorStore.ts";

/**
 * Tool definitions for assistants
 */
export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  code_analysis: {
    name: "analyze_code",
    description: "Analyze code and suggest improvements",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "The code to analyze",
        },
        language: {
          type: "string",
          description: "The programming language of the code",
        },
      },
      required: ["code"],
    },
  },

  code_execution: {
    name: "execute_code",
    description: "Execute code and return the result",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "The code to execute",
        },
        language: {
          type: "string",
          description: "The programming language of the code",
          enum: ["javascript", "typescript", "python"],
        },
      },
      required: ["code", "language"],
    },
  },

  vector_search: {
    name: "search_similar_code",
    description: "Search for similar code in the vector store",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return",
        },
      },
      required: ["query"],
    },
  },
};

/**
 * Tool implementations
 */
export const TOOLS: Record<string, ToolFunction> = {
  analyze_code: async (args: any, context: AgentContext): Promise<string> => {
    const { code, language } = args;

    try {
      await logMessage("info", "Analyzing code", {
        language: language || "unknown",
        codeLength: code.length,
      });

      // Use a simple heuristic analysis for now
      const issues = [];

      // Check for common issues
      if (code.includes("console.log")) {
        issues.push(
          "Code contains console.log statements, which should be removed in production code.",
        );
      }

      if (code.includes("TODO")) {
        issues.push("Code contains TODO comments, which should be addressed.");
      }

      if (code.includes("any")) {
        issues.push("Code uses 'any' type, which should be avoided when possible.");
      }

      if (code.includes("throw new Error") && !code.includes("try")) {
        issues.push("Code throws errors but doesn't have try/catch blocks.");
      }

      // Return analysis
      return JSON.stringify({
        issues,
        suggestions: issues.length > 0 ? ["Address the identified issues"] : ["No issues found"],
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logMessage("error", "Code analysis error", { error: errorMessage });

      return JSON.stringify({
        issues: ["Error analyzing code"],
        error: errorMessage,
      });
    }
  },

  execute_code: async (args: any, context: AgentContext): Promise<string> => {
    const { code, language } = args;

    try {
      await logMessage("info", "Executing code", {
        language,
        codeLength: code.length,
      });

      const result = await executeCode(code, { language });

      return JSON.stringify({
        output: result.text,
        error: result.error ? result.error.value : null,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logMessage("error", "Code execution error", { error: errorMessage });

      return JSON.stringify({
        output: "",
        error: errorMessage,
      });
    }
  },

  search_similar_code: async (args: any, context: AgentContext): Promise<string> => {
    const { query, max_results } = args;

    try {
      await logMessage("info", "Searching for similar code", {
        query,
        maxResults: max_results || 5,
      });

      const results = await searchDiffEntries(query, max_results || 5);

      const formattedResults = results.map((result) => {
        // Check if the entry is a DiffEntry
        if ("file" in result.entry && "diff" in result.entry) {
          return {
            file: result.entry.file,
            diff: result.entry.diff,
            score: result.score,
          };
        }
        // If it's not a DiffEntry, return a generic result
        return {
          score: result.score,
          message: "Not a diff entry",
        };
      });

      return JSON.stringify({
        results: formattedResults,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logMessage("error", "Vector search error", { error: errorMessage });

      return JSON.stringify({
        results: [],
        error: errorMessage,
      });
    }
  },
};
