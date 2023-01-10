import * as core from "@actions/core";
import * as github from "@actions/github";
import * as child_process from "child_process";

const runRunner = () => {
  console.log('start')
  let summary;
  let conclusion;
  let title;
  try {
    summary = child_process.execSync("ls").toString();
    conclusion = "success";
    title = "The tests successfully passed";
  } catch (error: any) {
    summary = error.message;
    conclusion = "failure";
    title = "The tests were failed";
    core.setFailed(title);
  } finally {
    octokit.rest.checks.create({
      owner: github.context.repo.owner,
      epo: github.context.repo.repo,
      name: "Snowmate Tests",
      head_sha: github.context.sha,
      status: "completed",
      conclusion: conclusion,
      output: {
        title,
        summary,
      },
    });
  }
};

// get token for octokit
const token = core.getInput("github-token");
const projectPath = core.getInput("project-path");
const projectID = core.getInput("project-id");
const clientID = core.getInput("client-id");
const secretKey = core.getInput("secret-key");

const octokit = github.getOctokit(token);

let beforeBranch;
let beforeCommit;
switch (github.context.eventName) {
  case "push": {
    beforeBranch = github.context.payload.ref;
    beforeCommit = github.context.payload.before;
    break;
  }
  case "pull_request": {
    const pull_request = github.context.payload.pull_request;
    beforeBranch = pull_request?.base.ref;
    beforeCommit = pull_request?.base.sha;
    break;
  }
  default: {
    // Todo: add message to user that explain the runner is not supported in this case.
    break;
  }
}
console.log(beforeBranch, beforeCommit, github.context.runId);
runRunner();
