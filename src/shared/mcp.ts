// Type declarations for MCP SDK interfaces
declare interface Client {
	request: Function;
	connect(): Promise<void>;
	close(): Promise<void>;
}

declare interface StdioClientTransport {
	start(): Promise<void>;
	close(): Promise<void>;
	stderr: {
		on(event: string, handler: (...args: any[]) => void): void;
	};
}

declare interface SSEClientTransport {
	url: string;
	options: Record<string, any>;
	onerror: ((error: any) => void) | null;
	connect(): Promise<void>;
	close(): Promise<void>;
	start(): Promise<void>;
}

export type McpServer = {
	name: string
	config: string
	status: "connected" | "connecting" | "disconnected"
	error?: string
	tools?: McpTool[]
	resources?: McpResource[]
	resourceTemplates?: McpResourceTemplate[]
	disabled?: boolean
	timeout?: number
	source?: "global" | "project"
	projectPath?: string
	alwaysAllow?: string[]
	watchPaths?: string[]
	type: "stdio" | "sse"
	command?: string
	args?: string[]
	env?: Record<string, string>
	url?: string
	headers?: Record<string, string>
}

export type McpTool = {
	name: string
	description?: string
	inputSchema?: object
	alwaysAllow?: boolean
	parameters?: Record<string, unknown>
}

export type McpResource = {
	uri: string
	name: string
	mimeType?: string
	description?: string
}

export type McpResourceTemplate = {
	uriTemplate: string
	name: string
	description?: string
	mimeType?: string
	parameters?: Record<string, unknown>
}

export type McpResourceResponse = {
	_meta?: Record<string, any>
	contents: Array<{
		uri: string
		mimeType?: string
		text?: string
		blob?: string
	}>
}

export type McpToolCallResponse = {
	_meta?: Record<string, any>
	content: Array<
		| {
				type: "text"
				text: string
		  }
		| {
				type: "image"
				data: string
				mimeType: string
		  }
		| {
				type: "resource"
				resource: {
					uri: string
					mimeType?: string
					text?: string
					blob?: string
				}
		  }
	>
	isError?: boolean
}

export type { McpHub } from '../services/mcp/McpHub';

export interface McpConnection {
	server: McpServer
	client: Client
	transport: StdioClientTransport | SSEClientTransport
}
