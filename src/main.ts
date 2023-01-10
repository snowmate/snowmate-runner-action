import * as core from '@actions/core';
import * as github from '@actions/github';
import * as child_process from 'child_process';

    // get token for octokit
    const token = core.getInput('repo-token');
    const octokit = github.getOctokit(token)
    console.log(github.context.runId)
    
    switch(github.context.action) { 
        case "push": { 
           console.log('push')
           break; 
        } 
        case "pull_request": { 
            console.log('pull_request')
            break; 
        } 
        default: { 
           //statements; 
           break; 
        } 
     }     

    
  

    // call octokit to create a check with annotation and details
   octokit.rest.checks.create({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        name: 'Snowmate Tests',
        head_sha: github.context.sha,
        status: 'completed',
        conclusion: 'failure',
        output: {
            title: 'README.md must ssfsfsdftart witdfgdfgdffgdgdsdfsffgdfgfdggsdfdgdfgdgfsfsfh a title',
            summary: 'result',
        }
    });
   