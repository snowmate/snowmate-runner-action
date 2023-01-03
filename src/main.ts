import * as core from '@actions/core';
// import * as github from '@actions/github';
import * as child_process from 'child_process';

    // // get token for octokit
    // const token = core.getInput('repo-token');
    // const octokit = github.getOctokit(token)
    let dataToSend  = '5';
    const python = child_process.spawn('ls');
    // collect data from script
    python.stdout.on('data', function (data) {
     console.log('Pipe data from python script ...');
     dataToSend = data.toString();
     console.log(dataToSend)
    });
    // in close event we are sure that stream from child process is closed
    python.on('close', (code) => {
    console.log(`child process close all stdio with code ${code}`);
    // send data to browser
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
   