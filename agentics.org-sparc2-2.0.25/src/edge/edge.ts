/**
 * Edge Function Handler for SPARC 2.0
 * Provides HTTP endpoints for interacting with SPARC 2.0 functionality
 */

import { AgentOptions, FileToProcess, SPARC2Agent } from "../agent/agent.ts";
import { loadConfig } from "../config.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { executeCode } from "../sandbox/codeInterpreter.ts";

/**
 * Handle HTTP requests to the SPARC 2.0 edge function
 * @param req HTTP request
 * @returns HTTP response
 */
export async function handleRequest(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse the URL to get the path
    const url = new URL(req.url);
    const path = url.pathname;

    // Load configuration
    const tomlConfig = await loadConfig("config.toml");

    // Create agent options from config
    const agentOptions: AgentOptions = {
      model: tomlConfig.models.reasoning,
      mode: tomlConfig.execution.mode === "semi"
        ? "interactive"
        : (tomlConfig.execution.mode as "automatic" | "manual" | "custom"),
      diffMode: tomlConfig.execution.diff_mode,
      processing: tomlConfig.execution.processing === "concurrent" ||
          tomlConfig.execution.processing === "swarm"
        ? "parallel"
        : tomlConfig.execution.processing as "sequential" | "parallel",
    };

    // Create agent instance
    const agent = new SPARC2Agent(agentOptions);

    // Handle different endpoints
    if (path === "/analyze") {
      return handleAnalyze(req, agent);
    } else if (path === "/plan") {
      return handlePlan(req, agent);
    } else if (path === "/execute") {
      return handleExecute(req);
    } else if (path === "/checkpoint") {
      return handleCheckpoint(req, agent);
    } else if (path === "/rollback") {
      return handleRollback(req, agent);
    } else {
      return new Response(JSON.stringify({ error: "Unknown endpoint" }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
}

/**
 * Handle analyze endpoint
 * @param req HTTP request
 * @param agent SPARC2Agent instance
 * @returns HTTP response
 */
async function handleAnalyze(req: Request, agent: SPARC2Agent): Promise<Response> {
  try {
    const data = await req.json();
    const files: FileToProcess[] = data.files.map((file: any) => ({
      path: file.path,
      originalContent: file.content,
    }));

    const results = await agent.planAndExecute("Analyze code and provide insights", files);

    return new Response(JSON.stringify({ results }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
}

/**
 * Handle plan endpoint
 * @param req HTTP request
 * @param agent SPARC2Agent instance
 * @returns HTTP response
 */
async function handlePlan(req: Request, agent: SPARC2Agent): Promise<Response> {
  try {
    const data = await req.json();
    const task = data.task;
    const files: FileToProcess[] = data.files.map((file: any) => ({
      path: file.path,
      originalContent: file.content,
    }));

    const results = await agent.planAndExecute(task, files);

    return new Response(JSON.stringify({ results }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
}

/**
 * Handle execute endpoint
 * @param req HTTP request
 * @returns HTTP response
 */
async function handleExecute(req: Request): Promise<Response> {
  try {
    const data = await req.json();
    const code = data.code;
    const language = data.language || "javascript";

    const result = await executeCode(code, { language });

    return new Response(JSON.stringify({ result }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
}

/**
 * Handle checkpoint endpoint
 * @param req HTTP request
 * @param agent SPARC2Agent instance
 * @returns HTTP response
 */
async function handleCheckpoint(req: Request, agent: SPARC2Agent): Promise<Response> {
  try {
    const data = await req.json();
    const name = data.name;

    const hash = await agent.createCheckpoint(name);

    return new Response(JSON.stringify({ hash }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
}

/**
 * Handle rollback endpoint
 * @param req HTTP request
 * @param agent SPARC2Agent instance
 * @returns HTTP response
 */
async function handleRollback(req: Request, agent: SPARC2Agent): Promise<Response> {
  try {
    const data = await req.json();
    const target = data.target;
    const mode = data.mode || "checkpoint";

    await agent.rollback(target, mode);

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
}
