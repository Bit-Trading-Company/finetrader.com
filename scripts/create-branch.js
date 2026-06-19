#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Branch creation automation
function runGitCommand(command) {
  try {
    return execSync(`git ${command}`, { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`Error running git command: ${command}`, error.message);
    return null;
  }
}

function createBranch(branchName, branchType = 'feature') {
  // Validate branch name
  if (!branchName) {
    console.error('Branch name is required');
    process.exit(1);
  }

  // Format branch name
  const formattedBranchName = `${branchType}/${branchName.toLowerCase().replace(/\s+/g, '-')}`;

  console.log(`Creating ${branchType} branch: ${formattedBranchName}`);

  // Ensure we're on main and up to date
  console.log('Switching to main branch...');
  runGitCommand('checkout main');

  console.log('Pulling latest changes...');
  runGitCommand('pull origin main');

  // Create and checkout new branch
  console.log(`Creating branch: ${formattedBranchName}`);
  const result = runGitCommand(`checkout -b ${formattedBranchName}`);

  if (result !== null) {
    console.log(
      `✅ Successfully created and switched to branch: ${formattedBranchName}`
    );
    console.log(`\nNext steps:`);
    console.log(`1. Make your changes`);
    console.log(`2. git add .`);
    console.log(`3. git commit -m "feat: your commit message"`);
    console.log(`4. git push origin ${formattedBranchName}`);
    console.log(`5. npm run create-pr ${formattedBranchName}`);

    return formattedBranchName;
  } else {
    console.error('❌ Failed to create branch');
    return null;
  }
}

function deleteBranch(branchName) {
  console.log(`Deleting branch: ${branchName}`);

  // Switch to main first
  runGitCommand('checkout main');

  // Delete local branch
  const localResult = runGitCommand(`branch -d ${branchName}`);
  if (localResult !== null) {
    console.log(`✅ Deleted local branch: ${branchName}`);
  }

  // Delete remote branch
  const remoteResult = runGitCommand(`push origin --delete ${branchName}`);
  if (remoteResult !== null) {
    console.log(`✅ Deleted remote branch: ${branchName}`);
  }
}

function updateBranch(branchName) {
  console.log(`Updating branch: ${branchName}`);

  // Switch to main and pull
  runGitCommand('checkout main');
  runGitCommand('pull origin main');

  // Switch back to feature branch and rebase
  runGitCommand(`checkout ${branchName}`);
  const result = runGitCommand(`rebase main`);

  if (result !== null) {
    console.log(`✅ Successfully updated branch: ${branchName}`);
  } else {
    console.error('❌ Failed to update branch');
  }
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];
const branchName = args[1];
const branchType = args[2] || 'feature';

if (require.main === module) {
  switch (command) {
    case 'create':
      createBranch(branchName, branchType);
      break;
    case 'delete':
      deleteBranch(branchName);
      break;
    case 'update':
      updateBranch(branchName);
      break;
    default:
      console.log('Usage:');
      console.log('  node create-branch.js create <branch-name> [branch-type]');
      console.log('  node create-branch.js delete <branch-name>');
      console.log('  node create-branch.js update <branch-name>');
      console.log('\nBranch types: feature, fix, hotfix, release');
      console.log('Example: node create-branch.js create user-auth feature');
  }
}

module.exports = { createBranch, deleteBranch, updateBranch };
