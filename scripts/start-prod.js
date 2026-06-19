#!/usr/bin/env node

/**
 * Production script for Bitscape Frontend
 * Starts the frontend with production API configuration (GCloud Run backend)
 */

const { spawn } = require('child_process');
const path = require('path');

// Production API URL - will be set by the IOC script during deployment
const PROD_API_URL =
  process.env.BITSCAPE_BACKEND_URL ||
  'https://bitscape-backend-[PROJECT-ID].a.run.app';

console.log('🚀 Starting Bitscape Frontend in PRODUCTION mode...');
console.log(`📡 API Base: ${PROD_API_URL}`);
console.log('');

// Set environment variables for production
const env = {
  ...process.env,
  REACT_APP_BITSCAPE_API_BASE: PROD_API_URL,
  NODE_ENV: 'production',
};

// Build and start the production server
const buildChild = spawn('npm', ['run', 'build'], {
  env,
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..'),
});

buildChild.on('error', (error) => {
  console.error('❌ Failed to build production app:', error);
  process.exit(1);
});

buildChild.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Build process exited with code ${code}`);
    process.exit(code);
  }

  console.log('✅ Build completed successfully!');
  console.log('📦 Production build ready in ./build directory');

  // If we're in a local environment, we can serve the build
  if (process.argv.includes('--serve')) {
    console.log('🌐 Starting local production server...');

    const serveChild = spawn('npx', ['serve', '-s', 'build', '-l', '3000'], {
      env,
      stdio: 'inherit',
      shell: true,
      cwd: path.resolve(__dirname, '..'),
    });

    serveChild.on('error', (error) => {
      console.error('❌ Failed to start production server:', error);
      process.exit(1);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down production server...');
      serveChild.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down production server...');
      serveChild.kill('SIGTERM');
    });
  }
});

// Handle graceful shutdown during build
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down build process...');
  buildChild.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down build process...');
  buildChild.kill('SIGTERM');
});
