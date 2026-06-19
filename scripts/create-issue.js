#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// GitHub CLI wrapper functions
function runGhCommand(command) {
  try {
    return execSync(`gh ${command}`, { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`Error running gh command: ${command}`, error.message);
    return null;
  }
}

function createIssue(title, body, labels = []) {
  const labelString = labels.length > 0 ? `--label "${labels.join(',')}"` : '';
  const command = `issue create --title "${title}" --body "${body.replace(/"/g, '\\"')}" ${labelString}`;

  const result = runGhCommand(command);
  if (result) {
    // Extract issue number from output
    const match = result.match(/Issue #(\d+) created/);
    if (match) {
      return parseInt(match[1]);
    }
  }
  return null;
}

function addToProject(issueNumber, projectName = 'Bitscape Project Board') {
  const command = `issue edit ${issueNumber} --add-project "${projectName}"`;
  return runGhCommand(command);
}

function moveToColumn(issueNumber, columnName = 'To Do') {
  // This would require the project board API or manual intervention
  console.log(
    `Manual step: Move issue #${issueNumber} to "${columnName}" column in the project board`
  );
}

// Example usage
function createCleanupIssue() {
  const title =
    '[Chore] Clean up console warnings, React Router future flags, and network error handling';
  const body = `## Description
Clean up console warnings and errors, add React Router v7 future flags documentation, and improve network error handling for better user experience.

## Issues Addressed
- React Router v6 deprecation warnings about v7 future flags
- Unnecessary console.log statements cluttering the browser console
- Network timeout errors when RPC endpoint is unreachable
- Missing documentation for React Router upgrade path

## Changes Made
- ✅ Added comments and TODOs for React Router v7 future flags in \`src/index.js\`
- ✅ Cleaned up console.log statements in \`AssetTabs.jsx\` and other components
- ✅ Updated \`.ai-docs/README.md\` with changelog and upgrade recommendations
- ⏳ (Optional) Add user-friendly error handling for asset fetching failures

## Technical Details
- **React Router Warnings**: Added documentation for \`v7_startTransition\` and \`v7_relativeSplatPath\` flags
- **Console Cleanup**: Removed debug logs from production code
- **Network Errors**: RPC endpoint \`http://34.42.166.60:8545/\` timing out - needs backend verification
- **Documentation**: Updated AI docs with changelog and future upgrade steps

## Acceptance Criteria
- [x] No unnecessary console logs in browser/dev console
- [x] Clear documentation for React Router v7 upgrade path
- [x] \`.ai-docs/README.md\` updated with changelog
- [ ] (Optional) User-friendly error messages for network failures

## Files Modified
- \`src/index.js\` - Added React Router v7 upgrade comments
- \`src/components/asset/AssetTabs.jsx\` - Cleaned up console.log statements
- \`.ai-docs/README.md\` - Added changelog and recommendations

## Related Links
- [React Router v7 Future Flags](https://reactrouter.com/en/main/upgrading/v6-to-v7#future-flags)
- [Project Board](https://github.com/orgs/bitscape-io/projects/2)`;

  const labels = ['Chore', 'Cleanup', 'Documentation', 'Good First Issue'];

  console.log('Creating issue...');
  const issueNumber = createIssue(title, body, labels);

  if (issueNumber) {
    console.log(`Issue #${issueNumber} created successfully`);

    console.log('Adding to project board...');
    addToProject(issueNumber);

    console.log("Moving to 'To Do' column...");
    moveToColumn(issueNumber);

    console.log(`Issue #${issueNumber} is ready for review!`);
  } else {
    console.error('Failed to create issue');
  }
}

// Run if called directly
if (require.main === module) {
  createCleanupIssue();
}

module.exports = { createIssue, addToProject, moveToColumn };
