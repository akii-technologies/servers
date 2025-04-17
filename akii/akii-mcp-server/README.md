# Akii MCP Server

The Akii MCP Server implements the Model Context Protocol (MCP) to serve as a centralized orchestration layer for all AI interactions. This server handles context retrieval, plugin execution, knowledge graph queries, and model routing independent of any specific model provider.

## Architecture

### Core Implementation

- Implements the MCP stdio interface for standardized communication
- Acts as a central broker between client applications and backend services
- Handles all context-related operations through a unified interface
- Provides secure credential management and scoped access to resources

### Context Orchestration

- Routes context requests to appropriate backend services:
  - LightRAG for document vector search and retrieval
  - Supabase for structured data queries
  - External search APIs (e.g., Brave) for web information
  - Custom APIs for specialized data (e.g., Shopify, CRMs)
  - Knowledge graph for relationship and fact retrieval
- Combines results from multiple context sources
- Formats context for model consumption with appropriate metadata
- Handles token budget allocation across context sources

### Plugin System

- Executes tools and plugins based on context-specific needs
- Supports standard MCP tools specification
- Integrates with external services through secure connectors
- Enables AI-driven decision-making for tool selection
- Provides a registry for available tools and plugins

### Inference Routing

- Implements provider-agnostic model routing
- Supports multiple LLM backends:
  - AWS Bedrock
  - Fireworks.ai
  - OpenRouter
  - Vertex AI
  - Future providers
- Handles provider-specific payload formatting
- Provides uniform error handling and response normalization
- Enables dynamic provider selection based on instance configuration

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project with LightRAG implementation
- Database setup with mcp_contexts tables

### Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with the required environment variables:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   FIREWORKS_API_KEY=your_fireworks_api_key
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   AWS_REGION=your_aws_region
   BRAVE_SEARCH_API_KEY=your_brave_api_key
   ```

### Running the Server

Run the HTTP server:
```
npm run dev
```

Run with stdio interface for direct MCP communication:
```
npm run dev -- --stdio
```

## Usage

### HTTP API

Use the `/mcp` endpoint with a POST request:

```
POST /mcp
Content-Type: application/json

{
  "type": "context",
  "payload": {
    "query": "How do I configure my Shopify integration?",
    "aiInstanceId": "550e8400-e29b-41d4-a716-446655440000",
    "maxTokens": 2000,
    "providers": ["lightrag", "brave", "shopify-api"]
  },
  "metadata": {
    "userId": "a716-446655440000",
    "conversationId": "e29b-41d4-a716"
  }
}
```

### Stdio Interface

Send JSON objects, one per line:

```
{"type":"context","payload":{"query":"How do I configure my Shopify integration?","aiInstanceId":"550e8400-e29b-41d4-a716-446655440000"}}
```

## Integrating with Edge Functions

To integrate the MCP server with Supabase Edge Functions, update your chat handler to route requests through the MCP server:

```typescript
// In your chat edge function
import { createClient } from '@supabase/supabase-js';

// Initialize MCP client
const mcpClient = {
  async fetchContext(query, aiInstanceId, userId) {
    // Call MCP server via HTTP
    const response = await fetch('http://your-mcp-server/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'context',
        payload: {
          query,
          aiInstanceId,
          providers: ['lightrag', 'brave'],
          maxTokens: 4000
        },
        metadata: { userId }
      })
    });
    
    return await response.json();
  },
  
  async generateCompletion(context, messages, provider, model) {
    // Call MCP server for completion
    // Similar implementation as above
  }
};

// Use in your chat handler
const context = await mcpClient.fetchContext(userQuery, aiInstanceId, userId);
const completion = await mcpClient.generateCompletion(
  context.data.context,
  [{ role: 'user', content: userQuery }],
  'bedrock',
  'anthropic.claude-3-haiku-20240307-v1:0'
);
```

## Security Considerations

- All API keys and credentials are stored as environment variables
- Row-level security enforced at the database level
- Instance and user-scoped access control
- All operations logged for audit and compliance
- User permissions verified before context retrieval
- Token usage tracked and limited per instance