#!/usr/bin/env node

const { execSync } = require('child_process');

// Configuration with correct project ID
const CONFIG = {
  owner: 'bitscape-io',
  repo: 'bitscape',
  projectId: 'PVT_kwDOCk5qJM4Aut2x', // Correct project ID from gh project view
  fieldId: 'PVTSSF_lADOCk5qJM4Aut2xzglRD_8', // Status field ID
};

// Status options with their IDs
const STATUS_OPTIONS = {
  backlog: { name: 'Backlog', id: '5bba6299' },
  todo: { name: 'Todo', id: 'f75ad846' },
  'in-progress': { name: 'In Progress', id: '47fc9ee4' },
  'in-review': { name: 'In Review', id: '83b56422' },
  done: { name: 'Done', id: '98236657' },
};

// Utility function
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

// Get project item ID for a specific issue
function getProjectItemId(issueNumber) {
  console.log(`🔍 Finding project item ID for issue #${issueNumber}...`);

  // First, try to fetch fresh project items
  const command = `powershell -Command "gh project item-list 2 --owner ${CONFIG.owner} --format json | Out-File -Encoding utf8 project-items.json"`;
  runCommand(command, { silent: true });

  // Then read and parse the file
  try {
    const fs = require('fs');
    let raw = fs.readFileSync('project-items.json');
    // Remove BOM if present and trim whitespace
    let jsonString = raw
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .trim();
    const data = JSON.parse(jsonString);

    // Find the item with matching issue number
    const item = data.items.find((item) => {
      if (!item.content || item.content.number === undefined) return false;
      return String(item.content.number) === String(issueNumber);
    });

    if (item) {
      console.log(`✅ Found item ID: ${item.id}`);
      console.log(`📋 Issue: ${item.content.title}`);
      return item.id;
    } else {
      console.log('❌ Issue not found in project board');
      console.log('📋 Available issues:');
      data.items.forEach((item) => {
        if (item.content && item.content.number !== undefined) {
          console.log(`  - #${item.content.number}: ${item.content.title}`);
        }
      });
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to parse project items:', error.message);
    return null;
  }
}

// Update project item status using GitHub CLI project command
function updateProjectItemStatus(itemId, targetStatus, targetStatusId) {
  console.log(`🚀 Updating issue status to "${targetStatus}"...\n`);

  console.log('📋 Configuration:');
  console.log(`   Project ID: ${CONFIG.projectId}`);
  console.log(`   Item ID: ${itemId}`);
  console.log(`   Field ID: ${CONFIG.fieldId}`);
  console.log(`   Target Status: ${targetStatus} (ID: ${targetStatusId})`);
  console.log('');

  const command = `gh project item-edit --project-id ${CONFIG.projectId} --id ${itemId} --field-id ${CONFIG.fieldId} --single-select-option-id "${targetStatusId}"`;

  console.log('🔄 Executing GitHub CLI project command...');
  const result = runCommand(command);

  if (result) {
    console.log('✅ Status updated successfully!');
    return true;
  } else {
    console.log('❌ Failed to update status');
    return false;
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const issueNumber = parseInt(args[0]);
  const targetStatus = args[1] || 'in-review';

  if (!issueNumber) {
    console.log('❌ Issue number is required');
    console.log('Usage: node update-status-direct.js <issue-number> [status]');
    console.log(
      'Available statuses: backlog, todo, in-progress, in-review, done'
    );
    console.log('Example: node update-status-direct.js 44 in-progress');
    process.exit(1);
  }

  const statusOption = STATUS_OPTIONS[targetStatus];
  if (!statusOption) {
    console.log(`❌ Invalid status: ${targetStatus}`);
    console.log('Available statuses:', Object.keys(STATUS_OPTIONS).join(', '));
    process.exit(1);
  }

  console.log(`🔧 Universal Status Update for Issue #${issueNumber}`);
  console.log('='.repeat(50));

  // Get project item ID
  const itemId = getProjectItemId(issueNumber);
  if (!itemId) {
    console.log(
      `❌ Cannot proceed without project item ID for issue #${issueNumber}`
    );
    console.log('Please ensure the issue is on the project board');
    console.log(
      `💡 Add to project board: gh project item-add 2 --owner ${CONFIG.owner} --url https://github.com/${CONFIG.owner}/${CONFIG.repo}/issues/${issueNumber}`
    );
    process.exit(1);
  }

  // Update status
  const success = updateProjectItemStatus(
    itemId,
    statusOption.name,
    statusOption.id
  );

  if (success) {
    console.log(
      `\n🎉 Issue #${issueNumber} status updated to "${statusOption.name}"`
    );
  } else {
    console.log('\n⚠️  Failed to update status. Please try manually:');
    console.log(`   https://github.com/orgs/${CONFIG.owner}/projects/2`);
  }

  console.log('\n🎯 Summary:');
  console.log(`   Issue: #${issueNumber}`);
  console.log(`   Target Status: ${statusOption.name}`);
  console.log(
    `   Project Board: https://github.com/orgs/${CONFIG.owner}/projects/2`
  );
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  updateProjectItemStatus,
  getProjectItemId,
  STATUS_OPTIONS,
  CONFIG,
};
