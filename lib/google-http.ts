// lib/google-http.ts
// Shared HTTP agent with keep-alive for all Google API calls
// This dramatically reduces latency by reusing TLS connections

import 'server-only';
import https from 'https';
import { google } from 'googleapis';

// Create a single process-wide connection pool
// This agent will be shared across ALL Google API calls
const agent = new https.Agent({
  keepAlive: true,
  
  // Maximum number of sockets to allow per host
  // maxSockets: 50,  // Optimized for Render.com's long-lived service
  maxSockets: 200,
  
  // Maximum number of sockets to leave open in free state
  // maxFreeSockets: 25,
  maxFreeSockets: 100,
  
  // Keep sockets alive even when idle (milliseconds)
  keepAliveMsecs: 60_000,  // 60 seconds for bursty traffic patterns
  
  // Socket timeout (milliseconds) - safety net
  timeout: 60_000,
});


// Apply these settings globally to all googleapis requests
// This affects ALL google.drive(), google.docs(), etc. clients
google.options({
  // Use our keep-alive agent for all requests
  agent,
  
  // Set a reasonable timeout for individual requests
  timeout: 30_000,
  
  // Retry configuration for transient failures
  retryConfig: {
    retry: 3,
    retryDelay: 100,
    onRetryAttempt: (err: any) => {
      console.log(`Retrying Google API request: ${err.message}`);
    }
  }
});

// Export a function to ensure the module is imported
export function initializeGoogleHttp() {
  // This function exists just to ensure the module gets imported
  // The actual work happens on module load via google.options()
  console.log('✅ Google APIs HTTP keep-alive agent initialized');
  return true;
}

// Optional: Export the agent if you need to use it directly somewhere
export { agent };

// Log that the optimized HTTP client is initialized
console.log('✅ Google APIs HTTP keep-alive agent initialized at module load');