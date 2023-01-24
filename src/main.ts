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

const runRunner = async (githubToken: string, cloneTempDir: string) => {
	const summary = ""
	let conclusion = ""
	let title = ""

	const projectPath = core.getInput("project-path") || ""
	const projectID = core.getInput("project-id") || ""
	const clientID = core.getInput("client-id") || ""
	const secretKey = core.getInput("secret-key") || ""

	const tempProjectDir = `${cloneTempDir}/${projectPath}`
	const rootDir = process.env.GITHUB_WORKSPACE || ""
	const pythonCommand = "python3"
	const runID = github.context.runId.toString()
	const result = child_process.spawnSync(
		pythonCommand,
		[
			"-m",
			"pytest",
			"--snowmate",
			"--project-id",
			projectID,
			"--client-id",
			clientID,
			"--secret-key",
			secretKey,
			"--workflow-run-id",
			runID,
			"--cloned-repo-dir",
			tempProjectDir,
			"--project-root-path",
			rootDir,
			"-s",
		],
		{
			encoding: "utf-8",
			cwd: path.join(rootDir || "", projectPath),
		}
	)
	console.log(result.error)
	console.log(result.stdout)
	if (result.error) {
		conclusion = "failure"
		title = "One or more tests had failed"
	} else {
		conclusion = "success"
		title = "All tests successfully passed"
	}

	await createCheck(githubToken, conclusion, title, summary)
}

const createCheck = async (
	githubToken: string,
	conclusion: string,
	title: string,
	summary: string
) => {
	console.log(conclusion, title, summary)
	const octokit = await github.getOctokit(githubToken)
	await octokit.rest.checks.create({
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
