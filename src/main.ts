import * as core from '@actions/core';
// import * as github from '@actions/github';
import * as child_process from 'child_process';

    // // get token for octokit
    // const token = core.getInput('repo-token');
    // const octokit = github.getOctokit(token)
    console.log(process.cwd())
    child_process.exec('pwd', {cwd: `${process.cwd()}/check`} , function(error, stdout) {
        console.log(stdout, error)
    });

//     // call octokit to create a check with annotation and details
//    octokit.rest.checks.create({
//         owner: github.context.repo.owner,
//         repo: github.context.repo.repo,
//         name: 'Readme Validator',
//         head_sha: github.context.sha,
//         status: 'completed',
//         conclusion: 'failure',
//         output: {
//             title: 'README.md must start with a title',
//             summary: dataToSend,
//         }
//     });
   