import * as core from '@actions/core';
import * as github from '@actions/github';
import * as child_process from 'child_process';

    // get token for octokit
    const token = process.env.GITHUB_TOKEN || ''
    const octokit = github.getOctokit(token)
  
    const result = child_process.execSync('cd regression/check && cat t.py').toString()

    // call octokit to create a check with annotation and details
   octokit.rest.checks.create({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        name: 'Readme Validator',
        head_sha: github.context.sha,
        status: 'completed',
        conclusion: 'failure',
        output: {
            title: 'README.md must start with a title',
            summary: result,
        }
    });
   