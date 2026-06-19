#!/usr/bin/env node

/**
 * Development script for Bitscape Frontend
 * Starts the frontend with local API configuration (localhost:3111)
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Bitscape Frontend in DEVELOPMENT mode...');
console.log('📡 API Base: http://localhost:3111');
console.log('');

// Set environment variables for development
const env = {
  ...process.env,
  REACT_APP_BITSCAPE_API_BASE: 'http://localhost:3111',
  NODE_ENV: 'development',
};

// Start the development server
const child = spawn('npm', ['run', 'start'], {
  env,
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..'),
});

child.on('error', (error) => {
  console.error('❌ Failed to start development server:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Development server exited with code ${code}`);
    process.exit(code);
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down development server...');
  child.kill('SIGTERM');
});
