import * as core from "@actions/core"
import * as github from "@actions/github"
import * as child_process from "child_process"

const runRunner = (baseBranch: string, baseCommit: string) => {
	let summary
	let conclusion
	let title

	const githubToken = core.getInput("github-token")
	const projectPath = core.getInput("project-path")
	const projectID = core.getInput("project-id")
	const clientID = core.getInput("client-id")
	const secretKey = core.getInput("secret-key")
	try {
		const runnerCommand = `cd ${projectPath} && python3 -m pytest --snowmate --project-id ${projectID} --client-id ${clientID} --secret-key ${secretKey} --base-branch ${baseBranch} --base-commit ${baseCommit} --workflow-run-id ${github.context.runId} -s`
		summary = child_process.execSync(runnerCommand).toString()
		conclusion = "success"
		title = "All tests successfully passed"
	} catch (error: unknown) {
		if (error instanceof Error) {
			summary = error.message
		}
		conclusion = "failure"
		title = "One or more tests had failed"
		core.setFailed(title)
	} finally {
		console.log(conclusion, summary, title)
		const octokit = github.getOctokit(githubToken)
		octokit.rest.checks.create({
			owner: github.context.repo.owner,
			repo: github.context.repo.repo,
			name: "Snowmate Regression Tests",
			head_sha: github.context.sha,
			status: "completed",
			conclusion: conclusion,
			output: {
				title,
				summary,
			},
		})
	}
}

let beforeBranch
let beforeCommit
switch (github.context.eventName) {
case "push": {
	beforeBranch = github.context.payload.ref
	beforeCommit = github.context.payload.before
	break
}
case "pull_request": {
	const pull_request = github.context.payload.pull_request
	beforeBranch = pull_request?.base.ref
	beforeCommit = pull_request?.base.sha
	break
}
default: {
	core.setFailed(
		"Stopping Snowmate, currently our tests only run on a push/pull request."
	)
	break
}
}
runRunner(beforeBranch, beforeCommit)
