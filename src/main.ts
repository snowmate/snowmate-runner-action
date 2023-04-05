import * as core from "@actions/core"
import * as github from "@actions/github"
import * as child_process from "child_process"
import git from "isomorphic-git"
import * as path from "path"
import * as os from "os"
import * as fs from "fs"
import http from "isomorphic-git/http/node"
import axios from "axios"

const SNOWMATE_APP_URL = "https://app.snowmate.io"
const SNOWMATE_AUTH_URL = "https://auth.snowmate.io"
const SNOWMATE_API_URL = "https://api.snowmate.io"
const PROJECTS_ROUTE = "/baseline/api/projects"

const REGRESSIONS_ROUTE = "regressions"
const SNOWMATE_REPORT_FILE_PATH = "/tmp/snowmate_result.md"

const createSnowmateAccessToken = async (
	authURL: string,
	clientId: string,
	secret: string
) => {
	const url = `${authURL}/identity/resources/auth/v1/api-token`
	const { data } = await axios.post<{ accessToken: string }>(
		url,
		{ clientId, secret },
		{
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
		}
	)
	return data.accessToken
}

const calculateGitData = () => {
	let beforeBranch
	let beforeCommit
	let currentSha
	let pullRequestNumber
	switch (github.context.eventName) {
	case "pull_request": {
		const pullRequest = github.context.payload.pull_request
		beforeBranch = pullRequest?.base.ref
		beforeCommit = pullRequest?.base.sha
		currentSha = pullRequest?.head.sha
		pullRequestNumber = pullRequest?.number
		break
	}
	default: {
		return undefined
	}
	}
	return { beforeBranch, beforeCommit, currentSha, pullRequestNumber }
}

const getProjectSettings = async (
	projectID: string,
	accessToken: string,
	apiURL: string
): Promise<Record<string, unknown>> => {
	const res = await axios.get(`${apiURL}/${PROJECTS_ROUTE}/${projectID}`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	})
	const settings = res.data.settings
	if (!settings) {
		return {}
	}
	try {
		return JSON.parse(settings)
	} catch (e) {
		return {}
	}
}

const runRunner = async (
	cloneTempDir: string,
	currentSha: string,
	pullRequestNumber: number
) => {
	let state = "success"
	let description = "All tests successfully passed"

	const projectPath = core.getInput("project-path")
	const projectID = core.getInput("project-id")
	const clientID = core.getInput("client-id")
	const secretKey = core.getInput("secret-key")
	const apiURL = core.getInput("api-url")
	const authURL = core.getInput("auth-url")
	const appURL = core.getInput("app-url")
	const additionalFlags = core.getInput("additional-flags")
	const disableStatusCreation: boolean =
		core.getInput("disable-status-creation").toLowerCase() === "true"

	const NO_TESTS_STATUS_CODE = 5
	const PROJECT_DOES_NOT_EXIST_STATUS_CODE = 255

	let doesProjectExist = true

	const tempProjectDir = `${cloneTempDir}/${projectPath}`
	const rootDir = `${process.env.GITHUB_WORKSPACE}/${projectPath}`
	const workflowRunID = github.context.runId
	const detailsURL = `${
		appURL ? appURL : SNOWMATE_APP_URL
	}/${REGRESSIONS_ROUTE}/${projectID}/${workflowRunID}`
	let runnerCommand = `cd ${projectPath} && snowmate_runner run --project-id ${projectID} --client-id ${clientID} --secret-key ${secretKey} --workflow-run-id ${workflowRunID} --cloned-repo-dir ${tempProjectDir} --project-root-path ${rootDir} --details-url ${detailsURL} --pull-request-number ${pullRequestNumber} ${
		additionalFlags || ""
	}`

	if (apiURL) {
		runnerCommand = `${runnerCommand} --api-url ${apiURL}`
	}

	if (authURL) {
		runnerCommand = `${runnerCommand} --auth-url ${authURL}`
	}

	const accessToken = await createSnowmateAccessToken(
		authURL ? authURL : SNOWMATE_AUTH_URL,
		clientID,
		secretKey
	)
	try {
		const result = child_process.execSync(runnerCommand, { encoding: "utf-8" })

		console.log(result)
	} catch (e) {
		const err = e as Error & { stdout: string; status: number }

		if (err.status === PROJECT_DOES_NOT_EXIST_STATUS_CODE) {
			doesProjectExist = false
			core.setFailed(
				`Stopping Snowmate, the Project ID: ${projectID} does not exist. Please make sure to enter a valid Project ID.`
			)
		} else if (err.status !== NO_TESTS_STATUS_CODE) {
			state = "failure"
			description = "One or more tests had failed"
		}

		if (doesProjectExist) {
			console.log(err.stdout)
		}
	} finally {
		if (doesProjectExist) {
			let summary
			try {
				summary = fs.readFileSync(SNOWMATE_REPORT_FILE_PATH, {
					encoding: "utf-8",
				})
			} catch {
				summary = ""
			}
			const projectSettings = await getProjectSettings(
				projectID,
				accessToken,
				apiURL ? apiURL : SNOWMATE_API_URL
			)
			if (!projectSettings.githubSilentMode) {
				await createCommitStatus(
					apiURL ? apiURL : SNOWMATE_API_URL,
					{
						owner: github.context.repo.owner,
						repo: github.context.repo.repo,
						sha: currentSha,
						state,
						description,
						detailsURL,
						pullRequestNumber,
						summary,
						disableStatusCreation: disableStatusCreation
							? disableStatusCreation
							: undefined,
					},
					accessToken
				)
			}
		}
	}
}

export type StatusRequest = {
	owner: string
	repo: string
	sha: string
	detailsURL: string
	state: string
	description: string
	summary: string
	pullRequestNumber: number
	disableStatusCreation?: boolean
}

const createCommitStatus = async (
	apiURL: string,
	statusRequest: StatusRequest,
	accessToken: string
) => {
	const url = `${apiURL}/github-events/api/status`
	await axios.post(url, statusRequest, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
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
	if (gitData === undefined) {
		core.setFailed(
			"Stopping Snowmate, currently our tests only run on pull requests."
		)
		return
	}
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
		await runRunner(
			tempDir,
			gitData.currentSha,
			gitData.pullRequestNumber || -1
		)
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
