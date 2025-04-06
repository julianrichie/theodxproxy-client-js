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
npm install @julianrichie/theodxproxys-client-js
