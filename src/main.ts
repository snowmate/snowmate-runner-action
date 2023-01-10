import * as core from '@actions/core';
import * as github from '@actions/github';
import * as child_process from 'child_process';

    // get token for octokit
    const token = core.getInput('repo-token');
    const octokit = github.getOctokit(token)
    console.log(github.context.runId)

    let beforeBranch;
    let beforeCommit
    switch(github.context.eventName) { 
        case "push": { 
           beforeBranch = github.context.ref
           console.log("dfdfffd")
           break; 
        } 
        case "pull_request": {
            const pull_request = github.context.payload.pull_request
            beforeBranch = pull_request?.base.ref
            beforeCommit = pull_request?.base.sha
            break; 
        } 
        default: { 
           //statements; 
           break; 
        } 
     }
     console.log(beforeBranch, beforeCommit)

    
  

//     // call octokit to create a check with annotation and details
//    octokit.rest.checks.create({
//         owner: github.context.repo.owner,
//         repo: github.context.repo.repo,
//         name: 'Snowmate Tests',
//         head_sha: github.context.sha,
//         status: 'completed',
//         conclusion: 'failure',
//         output: {
//             title: 'README.md must ssfsfsdftart witdfgdfgdffgdgdsdfsffgdfgfdggsdfdgdfgdgfsfsfh a title',
//             summary: 'result',
//         }
//     });
   