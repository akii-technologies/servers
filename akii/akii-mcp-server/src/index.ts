/**
 * Akii MCP Server
 * 
 * A Model Context Protocol (MCP) compliant server for Akii that handles:
 * - Context retrieval from various sources (LightRAG, APIs, Knowledge Graph)
 * - Model invocation across multiple providers
 * - Plugin execution and tool handling
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { handleMcpRequest } from './mcp';

// Load environment variables
dotenv.config();

// Initialize Express server
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MCP endpoint
app.post('/mcp', async (req, res) => {
  try {
    const result = await handleMcpRequest(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error processing MCP request:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint
app.get('/health', (_, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Akii MCP Server running on port ${PORT}`);
});

// For direct stdio interface with MCP compatible clients
if (process.argv.includes('--stdio')) {
  console.log('Starting stdio interface...');
  process.stdin.setEncoding('utf-8');
  
  let buffer = '';
  
  process.stdin.on('data', async (data) => {
    buffer += data;
    
    try {
      // Try to parse JSON objects from the buffer
      while (buffer.includes('\n')) {
        const newlineIndex = buffer.indexOf('\n');
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        
        if (line.trim()) {
          const request = JSON.parse(line);
          const response = await handleMcpRequest(request);
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      }
    } catch (error) {
      console.error('Error processing stdio request:', error);
      process.stdout.write(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }) + '\n');
    }
  });
}