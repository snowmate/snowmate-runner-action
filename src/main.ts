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
	return { beforeBranch, beforeCommit }
}

const runRunner = (githubToken: string, cloneTempDir: string) => {
	let summary = ""
	let conclusion = " "
	let title = ""
	let isSucceed = false

	const projectPath = core.getInput("project-path")
	const projectID = core.getInput("project-id")
	const clientID = core.getInput("client-id")
	const secretKey = core.getInput("secret-key")

	const tempProjectDir = `${cloneTempDir}/${projectPath}`
	const rootDir = process.env.GITHUB_WORKSPACE
	try {
		const runnerCommand = `cd ${projectPath} && python3 -m pytest --snowmate --project-id ${projectID} --client-id ${clientID} --secret-key ${secretKey} --workflow-run-id ${github.context.runId} --cloned-repo-dir ${tempProjectDir} --project-root-path ${rootDir} -s`
		summary = child_process.execSync(runnerCommand).toString()
		conclusion = "success"
		title = "All tests successfully passed"
		isSucceed = true
	} catch (error: unknown) {
		if (error instanceof Error) {
			summary = error.message
		}
		conclusion = "failure"
		title = "One or more tests had failed"
	} finally {
		createCheck(githubToken, conclusion, title, summary)
		if (!isSucceed) {
			core.setFailed(title || "")
		}
	}
}

const createCheck = (
	githubToken: string,
	conclusion: string,
	title: string,
	summary: string
) => {
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
		await runRunner(githubToken, tempDir)
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
