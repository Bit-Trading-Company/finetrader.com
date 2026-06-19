#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Import status update functionality
const {
  updateProjectItemStatus,
  updateStatusViaCLI,
  getProjectItemId,
  STATUS_OPTIONS,
} = require('./update-status-direct.js');

// Configuration
const CONFIG = {
  owner: 'bitscape-io',
  repo: 'bitscape',
  projectId: 'PVT_kwDOCk5qJM4Aut2x',
  branchPrefix: 'feature/',
  defaultStatus: 'in-review',
};

// State management
let workflowState = {
  currentIssue: null,
  currentBranch: null,
  lastCommit: null,
  projectBoardUrl: `https://github.com/orgs/${CONFIG.owner}/projects/2`,
};

// Utility functions
function runCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
    return result.trim();
  } catch (error) {
    if (!options.silent) {
      console.error(`❌ Error running command: ${command}`);
      console.error(`Error: ${error.message}`);
    }
    return null;
  }
}

function saveState() {
  const stateFile = path.join(__dirname, 'ai-state.js');
  const stateContent = `module.exports = ${JSON.stringify(workflowState, null, 2)};`;
  fs.writeFileSync(stateFile, stateContent);
}

function loadState() {
  const stateFile = path.join(__dirname, 'ai-state.js');
  if (fs.existsSync(stateFile)) {
    try {
      const loaded = require('./ai-state.js');
      if (loaded && typeof loaded === 'object') {
        workflowState = loaded;
        return true;
      }
    } catch (error) {
      console.log('⚠️  Could not load previous state');
    }
  }
  // Always ensure workflowState is initialized
  if (!workflowState || typeof workflowState !== 'object') {
    workflowState = {
      currentIssue: null,
      currentBranch: null,
      lastCommit: null,
      projectBoardUrl: `https://github.com/orgs/${CONFIG.owner}/projects/2`,
    };
  }
  return false;
}

// Core workflow functions
function createIssue(title, body, labels = []) {
  console.log('🚀 Creating GitHub Issue...');
  console.log(`Title: ${title}`);
  console.log(`Labels: ${labels.join(', ')}`);

  const labelsArg = labels.length > 0 ? `--label "${labels.join('","')}"` : '';
  const command = `gh issue create --title "${title}" --body "${body}" ${labelsArg} --repo ${CONFIG.owner}/${CONFIG.repo}`;

  const result = runCommand(command, { silent: true });

  if (result) {
    // Extract issue number from output
    const match = result.match(/Issue #(\d+) created/);
    if (match) {
      const issueNumber = parseInt(match[1]);
      workflowState.currentIssue = issueNumber;
      saveState();

      console.log(`✅ Issue #${issueNumber} created successfully!`);
      console.log(
        `🔗 Issue URL: https://github.com/${CONFIG.owner}/${CONFIG.repo}/issues/${issueNumber}`
      );

      // Add to project board
      addToProjectBoard(issueNumber);

      return issueNumber;
    }
  }

  console.log('❌ Failed to create issue');
  return null;
}

function addToProjectBoard(issueNumber) {
  console.log(`📋 Adding issue #${issueNumber} to project board...`);

  const command = `gh project item-add ${CONFIG.projectId} --owner ${CONFIG.owner} --repo ${CONFIG.repo} --number ${issueNumber}`;
  const result = runCommand(command, { silent: true });

  if (result) {
    console.log(`✅ Issue #${issueNumber} added to project board`);
  } else {
    console.log(`⚠️  Failed to add issue #${issueNumber} to project board`);
    console.log(
      '🌐 Please add manually: https://github.com/orgs/bitscape-io/projects/2'
    );
  }
}

function checkoutBranch(issueNumber, branchName = null) {
  if (!branchName) {
    branchName = `${CONFIG.branchPrefix}issue-${issueNumber}`;
  }

  console.log(`🌿 Checking out branch: ${branchName}`);

  // Check if branch exists
  const branchExists = runCommand(`git branch --list ${branchName}`, {
    silent: true,
  });

  if (branchExists) {
    console.log(`✅ Branch ${branchName} already exists, checking it out...`);
    runCommand(`git checkout ${branchName}`);
  } else {
    console.log(`🌱 Creating and checking out new branch: ${branchName}`);
    runCommand(`git checkout -b ${branchName}`);
  }

  workflowState.currentBranch = branchName;
  saveState();

  console.log(`✅ Now on branch: ${branchName}`);
  return branchName;
}

function commitChanges(message, files = []) {
  console.log('💾 Committing changes...');

  // Add files if specified, otherwise add all
  if (files.length > 0) {
    files.forEach((file) => {
      runCommand(`git add ${file}`);
    });
  } else {
    runCommand('git add .');
  }

  const result = runCommand(`git commit -m "${message}"`, { silent: true });

  if (result) {
    workflowState.lastCommit = message;
    saveState();
    console.log('✅ Changes committed successfully');
    return true;
  } else {
    console.log('❌ Failed to commit changes');
    return false;
  }
}

function updateIssueStatus(issueNumber, status = CONFIG.defaultStatus) {
  console.log(`🔄 Updating issue #${issueNumber} status to "${status}"...`);

  const statusOption = STATUS_OPTIONS[status];
  if (!statusOption) {
    console.log(`❌ Invalid status: ${status}`);
    console.log('Available statuses:', Object.keys(STATUS_OPTIONS).join(', '));
    return false;
  }

  // Get project item ID
  const itemId = getProjectItemId(issueNumber);
  if (!itemId) {
    console.log(`❌ Cannot find project item ID for issue #${issueNumber}`);
    console.log('Please ensure the issue is on the project board');
    return false;
  }

  // Try GraphQL mutation first
  console.log('\n📊 Method 1: GraphQL Mutation');
  const graphqlSuccess = updateProjectItemStatus(
    itemId,
    statusOption.name,
    statusOption.id
  );

  if (!graphqlSuccess) {
    console.log('\n📊 Method 2: GitHub CLI Project Command');
    const cliSuccess = updateStatusViaCLI(
      itemId,
      statusOption.name,
      statusOption.id
    );

    if (!cliSuccess) {
      console.log('\n⚠️  Both automated methods failed.');
      console.log('🌐 Please update manually via web UI:');
      console.log(`   ${workflowState.projectBoardUrl}`);
      console.log(
        `   Find issue #${issueNumber} and set status to "${statusOption.name}"`
      );
      return false;
    }
  }

  console.log(
    `✅ Issue #${issueNumber} status updated to "${statusOption.name}"`
  );
  return true;
}

function createPullRequest(issueNumber, title = null, body = null) {
  if (!title) {
    title = `Resolves #${issueNumber}`;
  }

  if (!body) {
    body = `This PR addresses issue #${issueNumber}

## Changes Made
- [ ] Describe changes here

## Testing
- [ ] Tested locally
- [ ] All tests pass

Closes #${issueNumber}`;
  }

  console.log('🔀 Creating Pull Request...');

  const command = `gh pr create --title "${title}" --body "${body}" --repo ${CONFIG.owner}/${CONFIG.repo}`;
  const result = runCommand(command, { silent: true });

  if (result) {
    console.log('✅ Pull Request created successfully!');
    console.log(`🔗 PR URL: ${result}`);
    return result;
  } else {
    console.log('❌ Failed to create Pull Request');
    return null;
  }
}

function debugStatus(issueNumber) {
  console.log(`🔍 Debugging status for issue #${issueNumber}...`);

  // Get project item ID
  const itemId = getProjectItemId(issueNumber);
  if (!itemId) {
    console.log(`❌ Issue #${issueNumber} not found on project board`);
    return;
  }

  console.log(`\n📋 Project Item Details:`);
  console.log(`   Item ID: ${itemId}`);
  console.log(`   Project ID: ${CONFIG.projectId}`);
  console.log(`   Field ID: ${CONFIG.fieldId}`);

  // Get current status
  const command = `gh project item-list 2 --owner ${CONFIG.owner} --format json`;
  const result = runCommand(command, { silent: true });

  if (result) {
    try {
      const data = JSON.parse(result);
      const item = data.items.find(
        (item) => item.content.number === issueNumber
      );
      if (item) {
        console.log(`\n📊 Current Status:`);
        item.fieldValues.forEach((field) => {
          if (field.name) {
            console.log(`   ${field.name}: ${field.name}`);
          }
        });
      }
    } catch (error) {
      console.log('❌ Could not parse project data');
    }
  }

  console.log(`\n🔧 Available Status Options:`);
  Object.entries(STATUS_OPTIONS).forEach(([key, value]) => {
    console.log(`   ${key}: ${value.name} (ID: ${value.id})`);
  });

  console.log(`\n🌐 Project Board: ${workflowState.projectBoardUrl}`);
}

// Command router
function handleCommand(command, args) {
  switch (command) {
    case 'create-issue':
      if (args.length < 2) {
        console.log(
          'Usage: node ai-workflow.js create-issue <title> <body> [labels...]'
        );
        return;
      }
      const title = args[0];
      const body = args[1];
      const labels = args.slice(2);
      createIssue(title, body, labels);
      break;

    case 'checkout':
      if (args.length < 1) {
        console.log(
          'Usage: node ai-workflow.js checkout <issue-number> [branch-name]'
        );
        return;
      }
      const issueNum = parseInt(args[0]);
      const branchName = args[1] || null;
      checkoutBranch(issueNum, branchName);
      break;

    case 'commit':
      if (args.length < 1) {
        console.log('Usage: node ai-workflow.js commit <message> [files...]');
        return;
      }
      const message = args[0];
      const files = args.slice(1);
      commitChanges(message, files);
      break;

    case 'update-status':
      if (args.length < 1) {
        console.log(
          'Usage: node ai-workflow.js update-status <issue-number> [status]'
        );
        console.log(
          'Available statuses:',
          Object.keys(STATUS_OPTIONS).join(', ')
        );
        return;
      }
      const issueNumber = parseInt(args[0]);
      const status = args[1] || CONFIG.defaultStatus;
      updateIssueStatus(issueNumber, status);
      break;

    case 'create-pr':
      if (args.length < 1) {
        console.log(
          'Usage: node ai-workflow.js create-pr <issue-number> [title] [body]'
        );
        return;
      }
      const prIssueNum = parseInt(args[0]);
      const prTitle = args[1] || null;
      const prBody = args[2] || null;
      createPullRequest(prIssueNum, prTitle, prBody);
      break;

    case 'debug':
      if (args.length < 1) {
        console.log('Usage: node ai-workflow.js debug <issue-number>');
        return;
      }
      const debugIssueNum = parseInt(args[0]);
      debugStatus(debugIssueNum);
      break;

    case 'status':
      console.log('📊 Current Workflow State:');
      console.log(`   Current Issue: ${workflowState.currentIssue || 'None'}`);
      console.log(
        `   Current Branch: ${workflowState.currentBranch || 'None'}`
      );
      console.log(`   Last Commit: ${workflowState.lastCommit || 'None'}`);
      console.log(`   Project Board: ${workflowState.projectBoardUrl}`);
      break;

    case 'help':
      showHelp();
      break;

    default:
      console.log(`❌ Unknown command: ${command}`);
      showHelp();
  }
}

function showHelp() {
  console.log(`
🤖 AI Workflow Automation System
================================

Available Commands:
------------------

📝 Issue Management:
  create-issue <title> <body> [labels...]
    Create a new GitHub issue with optional labels
    Example: node ai-workflow.js create-issue "Fix login bug" "Users cannot log in" bug high-priority

🌿 Branch Management:
  checkout <issue-number> [branch-name]
    Checkout/create branch for an issue
    Example: node ai-workflow.js checkout 42 feature/login-fix

💾 Version Control:
  commit <message> [files...]
    Commit changes with optional specific files
    Example: node ai-workflow.js commit "Fix login authentication" src/auth.js

🔄 Status Updates:
  update-status <issue-number> [status]
    Update issue status on project board
    Available statuses: backlog, todo, in-progress, in-review, done
    Example: node ai-workflow.js update-status 42 in-review

🔀 Pull Requests:
  create-pr <issue-number> [title] [body]
    Create a pull request for an issue
    Example: node ai-workflow.js create-pr 42 "Fix login bug" "Resolves authentication issues"

🔍 Debugging:
  debug <issue-number>
    Debug project board status for an issue
    Example: node ai-workflow.js debug 42

📊 State Management:
  status
    Show current workflow state
    Example: node ai-workflow.js status

❓ Help:
  help
    Show this help message
    Example: node ai-workflow.js help

Complete Workflow Example:
-------------------------
1. Create issue: node ai-workflow.js create-issue "New feature" "Description" enhancement
2. Checkout branch: node ai-workflow.js checkout 42
3. Make changes and commit: node ai-workflow.js commit "Implement feature"
4. Update status: node ai-workflow.js update-status 42 in-review
5. Create PR: node ai-workflow.js create-pr 42

🌐 Project Board: ${workflowState.projectBoardUrl}
📚 Documentation: .ai-docs/
`);
}

// Main execution
function main() {
  loadState();

  const args = process.argv.slice(2);
  if (args.length === 0) {
    showHelp();
    return;
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  handleCommand(command, commandArgs);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  createIssue,
  checkoutBranch,
  commitChanges,
  updateIssueStatus,
  createPullRequest,
  debugStatus,
  workflowState,
  CONFIG,
  STATUS_OPTIONS,
};
