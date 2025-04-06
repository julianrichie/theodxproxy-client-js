// ============================================================================
// Type Definitions based on OpenAPI Schema
// ============================================================================

/**
 * Configuration for the Odoo instance within a request.
 * Based on #/components/schemas/OdooInstance
 */
export interface OdooInstanceConfig {
  /** URL of the Odoo instance */
  url: string;
  /** Odoo user ID */
  user_id: number; // Note: OpenAPI format int64 maps well to number in TS for typical IDs
  /** Odoo database name */
  db: string;
  /** Odoo API key for the user */
  api_key: string;
}

/**
 * Allowed actions for Odoo requests via the proxy.
 * Based on #/components/schemas/OdooProxyRequest/properties/action/enum
 */
export type OdooAction =
  | 'search_count'
  | 'search'
  | 'read'
  | 'fields_get'
  | 'search_read'
  | 'create'
  | 'write'
  | 'unlink'
  | 'call_method';

/**
 * Represents the request body sent to the Odoo Proxy API.
 * Based on #/components/schemas/OdooProxyRequest
 */
export interface OdooProxyRequest {
  /** Unique identifier for the request */
  id: string;
  /** Odoo model method name */
  action: OdooAction;
  /** Odoo model name (e.g., res.partner) */
  model_id: string;
  /** Keyword arguments for execute_kw (JSON object) */
  keyword?: Record<string, any> | null;
  /** Positional arguments for execute_kw (JSON array) */
  params?: any[] | null;
  /** The name of the method to call if `action` is `call_method`. */
  fn_name?: string | null;
  /** Details of the target Odoo instance */
  odoo_instance: OdooInstanceConfig;
}

/**
 * Represents the structure of a JSON-RPC 2.0 Error object.
 * Based on #/components/schemas/JsonRpcError
 */
export interface JsonRpcError {
  /** An error code. */
  code: number;
  /** A human-readable error message. */
  message: string;
  /** Additional error details (structure may vary). */
  data?: any | null;
}

/**
 * Represents the structure of a JSON-RPC 2.0 Response object.
 * Based on #/components/schemas/JsonRpcResponse
 */
export interface JsonRpcResponse<TResult = any> {
  /** JSON-RPC version (always "2.0") */
  jsonrpc: '2.0';
  /** The request ID from the incoming request. */
  id: string | null;
  /** The result returned by Odoo (structure depends on the Odoo method called). */
  result?: TResult | null;
  /** An error object if the request failed at the proxy or Odoo level. */
  error?: JsonRpcError | null;
}

/**
 * Configuration needed to initialize the OdooProxyApiClient.
 */
export interface OdooApiClientConfig {
  /** Base URL of the TheODXProxy API (e.g., "http://0.0.0.0:3000") */
  baseUrl: string;
  /** API key for authenticating with the TheODXProxy API */
  apiKey: string;
  /** Optional custom fetch implementation */
  fetch?: typeof fetch;
}

// ============================================================================
// Client Class
// ============================================================================

/**
 * An error class specifically for HTTP or network-level errors during API calls.
 */
export class OdooProxyApiHttpError extends Error {
  public readonly status: number | undefined;
  public readonly statusText: string | undefined;
  public readonly response: Response | undefined;

  constructor(message: string, response?: Response) {
    super(message);
    this.name = 'OdooProxyApiHttpError';
    this.status = response?.status;
    this.statusText = response?.statusText;
    this.response = response;
  }
}

/**
 * An error class for when the response format doesn't match JSON-RPC 2.0.
 */
export class OdooProxyApiFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OdooProxyApiFormatError';
  }
}


/**
 * Typed client for interacting with the TheODXProxy API.
 *
 * Usage:
 * 1. Import `createOdooProxyClient` and necessary types.
 * 2. Call `createOdooProxyClient` with your configuration.
 * 3. Store the returned instance (e.g., in global state, a service, or context).
 * 4. Use the `forwardToOdoo` method to make API calls.
 */
export class OdooProxyApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;

  /**
   * Use `createOdooProxyClient` to create instances.
   * @internal
   */
  constructor(config: OdooApiClientConfig) {
    if (!config.baseUrl || !config.apiKey) {
      throw new Error('OdooProxyApiClient requires baseUrl and apiKey in configuration.');
    }
    // Remove trailing slash from base URL if present
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.fetchFn = config.fetch ?? globalThis.fetch;

    if (!this.fetchFn) {
        throw new Error('Fetch API is not available. Please provide a polyfill or ensure you are in a supported environment.');
    }
  }

  /**
   * Forwards a request to the specified Odoo instance via the proxy.
   * Corresponds to the `forwardToOdoo` operationId in the OpenAPI spec.
   *
   * @param request The request payload conforming to OdooProxyRequest schema.
   * @returns A Promise resolving to the JSON-RPC response from the proxy.
   *          This response may contain either a `result` or an `error` field
   *          as returned by the proxy/Odoo.
   * @throws {OdooProxyApiHttpError} If a network or unexpected HTTP error occurs (e.g., 404, 503, network down).
   * @throws {OdooProxyApiFormatError} If the response is not valid JSON or not a valid JSON-RPC 2.0 response.
   */
  public async forwardToOdoo<TResult = any>(
    request: OdooProxyRequest
  ): Promise<JsonRpcResponse<TResult>> {
    const url = `${this.baseUrl}/api/odoo`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'apikey': this.apiKey, // Add the API key header
    };

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(request),
      });
    } catch (networkError: any) {
      // Catch fetch-level errors (e.g., DNS resolution failure, network connection refused)
      throw new OdooProxyApiHttpError(
          `Network error calling Odoo Proxy API: ${networkError.message ?? 'Unknown network error'}`,
          undefined // No Response object available here
      );
    }

    // The OpenAPI spec explicitly defines responses for 200, 400, 401, 500, 502, 504
    // These should all contain a JsonRpcResponse body.
    // We treat any *other* status code as an unexpected HTTP error.
    const expectedStatuses = [200, 400, 401, 500, 502, 504];
    if (!expectedStatuses.includes(response.status)) {
        // Attempt to read body for more context if possible, but don't fail if it errors
        let responseBodyText = `Status: ${response.status} ${response.statusText}`;
        try {
           const text = await response.text();
           if (text) responseBodyText += `\nResponse Body: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`;
        } catch (_) { /* Ignore read error */ }

        throw new OdooProxyApiHttpError(
            `Unexpected HTTP response from Odoo Proxy API. ${responseBodyText}`,
            response
        );
    }

    // Try to parse the JSON response body for all expected status codes
    let responseData: any;
    try {
        // Check if response body is empty - might happen on e.g. some 5xx errors
        // although spec says they return JsonRpcResponse
        const text = await response.text();
        if (!text) {
            throw new OdooProxyApiFormatError('Received empty response body');
        }
        responseData = JSON.parse(text);

    } catch (parseError: any) {
      throw new OdooProxyApiFormatError(
        `Failed to parse JSON response from Odoo Proxy API: ${parseError.message ?? 'Unknown parsing error'}`
      );
    }

    // Validate the basic structure of the JSON-RPC response
    if (
      typeof responseData !== 'object' ||
      responseData === null ||
      responseData.jsonrpc !== '2.0' ||
      !('id' in responseData) // id can be null, but must be present
      // We don't strictly require result OR error, as one might be null/undefined
    ) {
      throw new OdooProxyApiFormatError(
        'Invalid JSON-RPC 2.0 response format received from Odoo Proxy API.'
      );
    }

    // We expect the structure defined by JsonRpcResponse<TResult>
    return responseData as JsonRpcResponse<TResult>;
  }
}

// ============================================================================
// Factory Function (Recommended way to create client)
// ============================================================================

/**
 * Factory function to create and configure an instance of the OdooProxyApiClient.
 *
 * @param config Configuration object containing the baseUrl and apiKey.
 * @returns A new instance of OdooProxyApiClient.
 */
export function createOdooProxyClient(config: OdooApiClientConfig): OdooProxyApiClient {
  return new OdooProxyApiClient(config);
}
