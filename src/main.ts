import * as core from "@actions/core"
import * as github from "@actions/github"
import * as child_process from "child_process"
import git from "isomorphic-git"
import * as path from "path"
import * as os from "os"
import * as fs from "fs"
import http from "isomorphic-git/http/node"

const calculateGitData = () => {
	let beforeBranch
	let beforeCommit
	let pullRequestNumber
	switch (github.context.eventName) {
	case "push": {
		beforeBranch = github.context.payload.ref
		beforeCommit = github.context.payload.before
		break
	}
	case "pull_request": {
		const pullRequest = github.context.payload.pull_request
		beforeBranch = pullRequest?.base.ref
		beforeCommit = pullRequest?.base.sha
		pullRequestNumber = pullRequest?.number
		console.log(pullRequest?.number)
		break
	}
	default: {
		core.setFailed(
			"Stopping Snowmate, currently our tests only run on a push/pull request."
		)
		break
	}
	}
	return { beforeBranch, beforeCommit, pullRequestNumber }
}

const runRunner = async (
	githubToken: string,
	cloneTempDir: string,
	pullRequestNumber?: number
) => {
	let conclusion = ""
	let title = ""

	const projectPath = core.getInput("project-path")
	const projectID = core.getInput("project-id")
	const clientID = core.getInput("client-id")
	const secretKey = core.getInput("secret-key")

	const tempProjectDir = `${cloneTempDir}/${projectPath}`
	const rootDir = process.env.GITHUB_WORKSPACE
	const runnerCommand = `cd ${projectPath} && python3 -m pytest --snowmate --project-id ${projectID} --client-id ${clientID} --secret-key ${secretKey} --workflow-run-id ${github.context.runId} --cloned-repo-dir ${tempProjectDir} --project-root-path ${rootDir} -s`
	try {
		const result = child_process.execSync(runnerCommand, { encoding: "utf-8" })
		conclusion = "success"
		title = "All tests successfully passed"
		console.log(result)
	} catch (e) {
		const err = e as Error & { stdout: string }
		conclusion = "failure"
		title = "One or more tests had failed"
		console.log(err.stdout)
	} finally {
		let summary
		try {
			summary = fs.readFileSync("/tmp/snowmate_result.md", {
				encoding: "utf-8",
			})
		} catch {
			summary = ""
		}
		await createCheck(
			githubToken,
			conclusion,
			title,
			summary,
			pullRequestNumber
		)
	}
}

const createCheck = async (
	githubToken: string,
	conclusion: string,
	title: string,
	summary: string,
	pullRequestNumber?: number
) => {
	const octokit = await github.getOctokit(githubToken)
	const pullRequests = pullRequestNumber ? [pullRequestNumber] : undefined
	console.log(pullRequests)
	const check = await octokit.rest.checks.create({
		owner: github.context.repo.owner,
		repo: github.context.repo.repo,
		name: "Snowmate Regression Tests",
		head_sha: github.context.sha,
		status: "completed",
		external_id: "snowmate-tests",
		conclusion: conclusion,
		output: {
			title,
			summary,
		},
		pull_requests: pullRequests,
	})
	console.log(check)
}

const cloneRepo = async (
	dir: string,
	baseBranch: string,
	baseCommit: string,
	githubToken: string
) => {
	const githubRepo = github.context.repo
	const githubRepoURL = `${github.context.serverUrl}/${githubRepo.owner}/${githubRepo.repo}`
	await git.clone({
		fs,
		http,
		dir,
		url: githubRepoURL,
		ref: baseBranch,
		onAuth: () => {
			return { username: "token", password: githubToken }
		},
	})
	await git.checkout({
		fs,
		dir,
		ref: baseCommit,
		force: true,
	})
}

const startRun = async () => {
	const gitData = calculateGitData()
	const githubToken = core.getInput("github-token")
	let tempDir
	try {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snow-"))
		await cloneRepo(
			tempDir,
			gitData.beforeBranch,
			gitData.beforeCommit,
			githubToken
		)
		await runRunner(githubToken, tempDir, gitData.pullRequestNumber)
	} catch (e) {
		console.error(e)
	} finally {
		try {
			if (tempDir) {
				fs.rmSync(tempDir, { recursive: true })
			}
		} catch (e) {
			console.error(
				`An error has occurred while removing the temp folder at ${tempDir}. Please remove it manually. Error: ${e}`
			)
		}
	}
}

startRun()
