#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// PR creation automation
function runGhCommand(command) {
  try {
    return execSync(`gh ${command}`, { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`Error running gh command: ${command}`, error.message);
    return null;
  }
}

function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error('Error getting current branch:', error.message);
    return null;
  }
}

function getCommitMessages(branchName) {
  try {
    const mainBranch = 'main';
    const commits = execSync(`git log ${mainBranch}..${branchName} --oneline`, {
      encoding: 'utf8',
    }).trim();
    return commits.split('\n').filter((line) => line.trim());
  } catch (error) {
    console.error('Error getting commit messages:', error.message);
    return [];
  }
}

function generatePRTitle(branchName, commits) {
  // Extract feature name from branch
  const featureName = branchName.replace(/^(feature|fix|hotfix|release)\//, '');

  // Determine type from branch prefix
  const branchType = branchName.split('/')[0];

  // Map branch types to conventional commit types
  const typeMap = {
    feature: 'feat',
    fix: 'fix',
    hotfix: 'fix',
    release: 'release',
  };

  const commitType = typeMap[branchType] || 'feat';

  // Create title from first commit or feature name
  let title = '';
  if (commits.length > 0) {
    const firstCommit = commits[0];
    // Extract message after commit hash
    const message = firstCommit.replace(/^[a-f0-9]{7}\s+/, '');
    title = message.charAt(0).toUpperCase() + message.slice(1);
  } else {
    title = featureName
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  return `${commitType}: ${title}`;
}

function generatePRBody(branchName, commits) {
  const featureName = branchName.replace(/^(feature|fix|hotfix|release)\//, '');
  const branchType = branchName.split('/')[0];

  let body = `## Description\n`;
  body += `This PR implements ${featureName.replace(/-/g, ' ')}.\n\n`;

  body += `## Changes Made\n`;
  if (commits.length > 0) {
    commits.forEach((commit) => {
      const message = commit.replace(/^[a-f0-9]{7}\s+/, '');
      body += `- ✅ ${message}\n`;
    });
  } else {
    body += `- ✅ Implement ${featureName}\n`;
  }
  body += `\n`;

  body += `## Technical Details\n`;
  body += `- Branch type: ${branchType}\n`;
  body += `- Number of commits: ${commits.length}\n`;
  body += `- Files changed: (will be shown in PR)\n\n`;

  body += `## Testing\n`;
  body += `- [ ] Unit tests pass\n`;
  body += `- [ ] Integration tests pass\n`;
  body += `- [ ] Manual testing completed\n`;
  body += `- [ ] Cross-browser testing (if applicable)\n\n`;

  body += `## Screenshots/Videos\n`;
  body += `- Add screenshots for UI changes\n\n`;

  body += `## Related Issues\n`;
  body += `- Closes #[issue-number]\n`;
  body += `- Relates to #[issue-number]\n\n`;

  body += `## Checklist\n`;
  body += `- [x] Code follows style guidelines\n`;
  body += `- [x] Documentation updated\n`;
  body += `- [x] Tests added/updated\n`;
  body += `- [x] No breaking changes\n`;
  body += `- [x] Ready for review`;

  return body;
}

function createPR(branchName, title, body, baseBranch = 'main') {
  console.log(`Creating PR for branch: ${branchName}`);
  console.log(`Title: ${title}`);

  // Create PR using GitHub CLI
  const command = `pr create --title "${title}" --body "${body.replace(/"/g, '\\"')}" --base ${baseBranch} --head ${branchName}`;
  const result = runGhCommand(command);

  if (result) {
    // Extract PR URL from output
    const urlMatch = result.match(
      /https:\/\/github\.com\/[^\/]+\/[^\/]+\/pull\/\d+/
    );
    if (urlMatch) {
      console.log(`✅ PR created successfully: ${urlMatch[0]}`);
      return urlMatch[0];
    }
  }

  console.error('❌ Failed to create PR');
  return null;
}

function updatePR(prNumber, title, body) {
  console.log(`Updating PR #${prNumber}`);

  const command = `pr edit ${prNumber} --title "${title}" --body "${body.replace(/"/g, '\\"')}"`;
  const result = runGhCommand(command);

  if (result) {
    console.log(`✅ PR #${prNumber} updated successfully`);
    return true;
  } else {
    console.error('❌ Failed to update PR');
    return false;
  }
}

function mergePR(prNumber, mergeMethod = 'squash') {
  console.log(`Merging PR #${prNumber} using ${mergeMethod} method`);

  const command = `pr merge ${prNumber} --${mergeMethod}`;
  const result = runGhCommand(command);

  if (result) {
    console.log(`✅ PR #${prNumber} merged successfully`);
    return true;
  } else {
    console.error('❌ Failed to merge PR');
    return false;
  }
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];
const branchName = args[1] || getCurrentBranch();
const prNumber = args[2];

if (require.main === module) {
  if (!branchName) {
    console.error('No branch specified and could not determine current branch');
    process.exit(1);
  }

  switch (command) {
    case 'create':
      const commits = getCommitMessages(branchName);
      const title = generatePRTitle(branchName, commits);
      const body = generatePRBody(branchName, commits);
      createPR(branchName, title, body);
      break;

    case 'update':
      if (!prNumber) {
        console.error('PR number is required for update command');
        process.exit(1);
      }
      const updateCommits = getCommitMessages(branchName);
      const updateTitle = generatePRTitle(branchName, updateCommits);
      const updateBody = generatePRBody(branchName, updateCommits);
      updatePR(prNumber, updateTitle, updateBody);
      break;

    case 'merge':
      if (!prNumber) {
        console.error('PR number is required for merge command');
        process.exit(1);
      }
      const mergeMethod = args[3] || 'squash';
      mergePR(prNumber, mergeMethod);
      break;

    default:
      console.log('Usage:');
      console.log('  node create-pr.js create [branch-name]');
      console.log('  node create-pr.js update <pr-number> [branch-name]');
      console.log('  node create-pr.js merge <pr-number> [merge-method]');
      console.log('\nMerge methods: squash, rebase, merge');
      console.log('Example: node create-pr.js create feature/user-auth');
  }
}

module.exports = {
  createPR,
  updatePR,
  mergePR,
  generatePRTitle,
  generatePRBody,
};
