import * as puppeteer from 'puppeteer-core';
import * as cheerio from 'cheerio';
import PCR from 'puppeteer-chromium-resolver';

interface PageAnalysis {
  url: string;
  html: string;
  text: string;
  title: string;
  structure: {
    html: string;   // Cleaned HTML structure
    css: string[];  // Extracted CSS styles
    scripts: string[]; // JavaScript files/inline scripts
    assets: {       // Key assets like images, fonts, etc
      images: string[];
      fonts: string[];
      icons: string[];
    };
  };
}

interface SearchResult extends PageAnalysis {
  relevance: number; // Relevance score for search results
  snippet: string;   // Short text snippet showing relevance
}

function generateSearchQueries(task: string): string[] {
  // Generate multiple search variations to get comprehensive results
  const queries = [];
  
  // Clean and normalize the task
  const cleanTask = task.toLowerCase().trim();
  
  if (cleanTask.includes("latest") || cleanTask.includes("news")) {
    // Add time-sensitive queries
    queries.push(`${cleanTask} last 24 hours`);
    queries.push(`${cleanTask} today`);
    queries.push(`${cleanTask} recent`);
  }
  
  // Add topic-specific queries
  if (cleanTask.includes("how to") || cleanTask.includes("tutorial")) {
    queries.push(`${cleanTask} step by step guide`);
    queries.push(`${cleanTask} tutorial`);
  }
  
  // Add the original query if no specific patterns matched
  if (queries.length === 0) {
    queries.push(cleanTask);
  }
  
  return queries;
}

function isValidUrl(text: string): boolean {
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}

async function analyzePage(page: puppeteer.Page, url: string): Promise<PageAnalysis> {
  // Get full page content
  const html = await page.content();
  const $ = cheerio.load(html);
  
  // Extract text content
  const text = $('body').text().trim();
  const title = $('title').text().trim();
  
  // Extract CSS
  const cssLinks = $('link[rel="stylesheet"]')
    .map((_: number, el: cheerio.Element) => $(el).attr('href'))
    .get();
  
  const inlineStyles = $('style')
    .map((_: number, el: cheerio.Element) => $(el).html())
    .get();
  
  // Extract JavaScript
  const scripts = $('script')
    .map((_: number, el: cheerio.Element) => {
      const src = $(el).attr('src');
      return src || $(el).html();
    })
    .get();
  
  // Extract key assets
  const images = $('img')
    .map((_: number, el: cheerio.Element) => $(el).attr('src'))
    .get();
  
  const fonts = cssLinks
    .filter((href: string | undefined) => href?.includes('fonts') || href?.includes('.woff'));
  
  const icons = $('link[rel="icon"], link[rel="shortcut icon"]')
    .map((_: number, el: cheerio.Element) => $(el).attr('href'))
    .get();

  // Clean HTML structure (remove inline styles/scripts for clearer view)
  $('*').removeAttr('style');
  $('script').remove();
  $('style').remove();
  const cleanHtml = $.html();

  return {
    url,
    html,
    text,
    title,
    structure: {
      html: cleanHtml,
      css: [...cssLinks, ...inlineStyles],
      scripts,
      assets: {
        images,
        fonts,
        icons
      }
    }
  };
}

async function searchAndAnalyze(query: string, onProgress: (message: string) => void): Promise<SearchResult[]> {
  onProgress(`Performing search for: ${query}`);
  
  // Setup Puppeteer
  const stats = await PCR();
  const browser = await puppeteer.launch({
    executablePath: stats.executablePath,
    headless: true
  });

  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    
    // Optimize performance by blocking unnecessary resources
    page.on('request', (req: puppeteer.HTTPRequest) => {
      const resourceType = req.resourceType();
      if (['image', 'media', 'font'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(query)}`);
    await page.waitForSelector('.b_algo');
    
    // Extract search results
    const html = await page.content();
    const $ = cheerio.load(html);
    const searchUrls = $('.b_algo h2 a')
      .map((_: number, el: cheerio.Element) => $(el).attr('href'))
      .get()
      .filter((url: string | undefined): url is string => 
        url !== undefined && url.startsWith('http'))
      .slice(0, 5); // Limit to top 5 for faster processing

    const results: SearchResult[] = [];
    
    // Process each result in parallel for speed
    await Promise.all(searchUrls.map(async (url: string, index: number) => {
      try {
        onProgress(`Analyzing result ${index + 1}/${searchUrls.length}: ${url}`);
        
        await page.goto(url, { 
          waitUntil: 'networkidle0',
          timeout: 10000  // 10 second timeout per page
        });
        
        const analysis = await analyzePage(page, url);
        const relevance = 1.0; // Basic relevance score, could be improved
        
        results.push({
          ...analysis,
          relevance,
          snippet: analysis.text.slice(0, 200) // Basic snippet
        });
      } catch (error) {
        console.error(`Error processing ${url}:`, error);
      }
    }));

    return results;
  } finally {
    await browser.close();
  }
}

export async function performWebSearch(task: string, onProgress: (message: string) => void): Promise<SearchResult[]> {
  // Check if task contains a URL
  const words = task.split(/\s+/);
  const url = words.find(word => isValidUrl(word));
  
  if (url) {
    // Direct URL analysis
    onProgress("Analyzing specified URL...");
    const stats = await PCR();
    const browser = await puppeteer.launch({
      executablePath: stats.executablePath,
      headless: true
    });
    
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle0' });
      const analysis = await analyzePage(page, url);
      return [{
        ...analysis,
        relevance: 1.0,
        snippet: analysis.text.slice(0, 200)
      }];
    } finally {
      await browser.close();
    }
  } else {
    // Generate and execute search queries
    const queries = generateSearchQueries(task);
    const allResults: SearchResult[] = [];
    
    // Execute searches in parallel
    const searchPromises = queries.map(query => searchAndAnalyze(query, onProgress));
    const searchResults = await Promise.all(searchPromises);
    
    // Combine and deduplicate results
    const seenUrls = new Set<string>();
    for (const results of searchResults) {
      for (const result of results) {
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          allResults.push(result);
        }
      }
    }
    
    return allResults;
  }
}
