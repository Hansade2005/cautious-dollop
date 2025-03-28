import { ToolArgs } from "./types"
import { performWebSearch } from "../../../services/websearch"
import * as vscode from "vscode"

export function getWebSearchDescription(args: ToolArgs): string | undefined {
  return `## web_search
Description: Performs intelligent web search or direct URL analysis. This tool can:
1. For general queries: Automatically generates optimal search queries, analyzes multiple results in parallel
2. For URLs: Directly analyzes the specified webpage's content and structure
The tool extracts and understands HTML structure, CSS styles, JavaScript code, and other assets.

Parameters:
- task: (required) The search task or URL to analyze. Examples:
  - "What are the latest news about AI?"
  - "How to implement authentication in Next.js?"
  - "https://example.com" (direct URL analysis)

Usage:
<web_search>
<task>What are the latest features in TypeScript 5.4?</task>
</web_search>

Example for direct URL analysis:
<web_search>
<task>https://nextjs.org/docs/pages/building-your-application/routing</task>
</web_search>`
}

interface WebSearchResult {
  type: "success" | "error";
  results?: Array<{
    url: string;
    title: string;
    snippet: string;
    relevance: number;
    structure?: {
      html: string;
      css: string[];
      scripts: string[];
      assets: {
        images: string[];
        fonts: string[];
        icons: string[];
      };
    };
  }>;
  message?: string;
}

export async function handleWebSearch(task: string): Promise<WebSearchResult> {
  const progressOptions: vscode.ProgressOptions = {
    location: vscode.ProgressLocation.Notification,
    title: "Web Search",
    cancellable: true
  };

  return await vscode.window.withProgress(
    progressOptions,
    async (
      progress: vscode.Progress<{ message?: string }>,
      token: vscode.CancellationToken
    ): Promise<WebSearchResult> => {
      try {
        const onProgress = (message: string) => {
          progress.report({ message });
        };

        const results = await performWebSearch(task, onProgress);
        
        // Format results to highlight the most relevant information
        return {
          type: "success",
          results: results.map(r => ({
            url: r.url,
            title: r.title,
            snippet: r.snippet,
            relevance: r.relevance,
            structure: r.structure
          }))
        };

      } catch (error) {
        console.error("Web search error:", error);
        return {
          type: "error",
          message: `Web search failed: ${(error as Error).message}`
        };
      }
    }
  );
}
