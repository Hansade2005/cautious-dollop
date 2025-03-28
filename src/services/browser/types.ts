export interface PCRStats {
    executablePath: string;
    folderPath: string;
    revision: string;
    product: string;
    puppeteer: any; // Required by BrowserSession
} 