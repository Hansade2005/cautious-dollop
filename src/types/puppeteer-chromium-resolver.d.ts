declare module 'puppeteer-chromium-resolver' {
  import { Browser, launch } from 'puppeteer-core';

  interface ResolverResult {
    executablePath: string;
    folderPath: string;
    revision: string;
    product: string;
    puppeteer: {
      launch: typeof launch;
    };
  }

  interface ResolverOptions {
    downloadPath?: string;
  }

  function PCR(options?: ResolverOptions): Promise<ResolverResult>;
  export = PCR;
} 