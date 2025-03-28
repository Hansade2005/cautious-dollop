declare module 'puppeteer-chromium-resolver' {
  interface ResolverOptions {
    cache?: string;
    revision?: string;
    downloadHost?: string;
    downloadPath?: string;
  }

  interface ResolverResult {
    executablePath: string;
    revision: string;
    folderPath: string;
    product: string;
  }

  function resolve(options?: ResolverOptions): Promise<ResolverResult>;
  export = resolve;
} 