# Odoo Proxy API Client (TypeScript)

[![npm version](https://badge.fury.io/js/%40your-npm-username%2Fodoo-proxy-client.svg)](https://badge.fury.io/js/%40your-npm-username%2Fodoo-proxy-client) <!-- Optional: Add npm badge after publishing -->

A TypeScript client library for interacting with the TheODXProxy API (an Odoo Reverse Proxy), generated based on its OpenAPI specification.

This client is designed for browser environments (or Node.js with `fetch` available) and integrates easily with frameworks like Next.js, Vue, Angular, etc.

## Features

-   Strongly typed request and response objects based on the OpenAPI schema.
-   Uses the standard `fetch` API (browser built-in or polyfilled).
-   Handles API key authentication via headers.
-   Provides clear error types for HTTP/network issues vs. API format errors.
-   JSON-RPC errors (from the proxy or Odoo) are returned within the success response (`error` field), as defined by the spec.
-   Published on npm for easy installation.
-   Includes TypeScript definitions.

## Installation

Using npm:

```bash
npm install @julianrichie/theodxproxy-client-js
```

```typescript
// apiClient.ts
import { createOdooProxyClient, OdooProxyApiClient } from '@julianrichie/theodxproxy-client-js';

// --- Example: Simple Global Instance (adapt for your framework) ---
let apiClient: OdooProxyApiClient | null = null;

export function getApiClient(): OdooProxyApiClient {
  if (!apiClient) {
    apiClient = createOdooProxyClient({
      baseUrl: 'https://theodx-api-gateway',
      apiKey: 'my_secret_key'
      // Optional: Provide custom fetch if needed
      // fetch: customFetchImplementation,
    });
  }
  return apiClient;
}
```


```typescript
import { getApiClient } from './apiClient';
import type { OdooProxyRequest, JsonRpcResponse } from '@julianrichie/theodxproxy-client-js';
import { v4 as uuidv4 } from 'uuid'; // Example ID generation (install uuid separately)

async function searchPartners(searchTerm: string): Promise<any[] | null> {
  const client = getApiClient();

  const request: OdooProxyRequest = {
    id: uuidv4(), // Generate a unique request ID (requires 'uuid' package)
    action: 'search_read',
    model_id: 'res.partner',
    params: [
      [
        ['name', 'ilike', searchTerm],
        ['active', '=', true]
        ]
    ],
    keyword: {
        'fields': ['name', 'email', 'phone'],
        'context': {
            'allowed_company_ids': [1,2,3,4,5],
            'default_company_id': 1,
            'tz': 'Asia/Jakarta'
        }
    }
    odoo_instance: {
      url: 'https://your_odoo_instance.com',
      db: 'your_odoo_instance_db',
      user_id: 2,
      api_key: 'api_key_for_user_id_2',
    },
  };

  try {
    // Specify expected result type if known
    const response: JsonRpcResponse<any[]> = await client.forwardToOdoo(request);

    if (response.error) {
      console.error(`API Error (Code: ${response.error.code}): ${response.error.message}`, response.error.data);
      return null;
    } else {
      console.log('Search Results:', response.result);
      return response.result ?? [];
    }

  } catch (error: any) {
    // Handle HTTP/Network/Format errors
    if (error.name === 'OdooProxyApiHttpError') {
        console.error(`HTTP Error: ${error.message}`, error.status, error.statusText);
    } else if (error.name === 'OdooProxyApiFormatError') {
        console.error(`API Format Error: ${error.message}`);
    } else {
        console.error('An unexpected error occurred:', error);
    }
    throw error; // Re-throw or handle appropriately
  }
}

// Example call
searchPartners('some_partner').then(partners => {
  if (partners) {
    console.log(`Found ${partners.length} partners.`);
  } else {
    console.log('Search failed or returned no results.');
  }
}).catch(err => {
    console.error("Failed to complete search operation:", err);
});
```