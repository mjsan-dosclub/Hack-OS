const title = process.argv[2] ?? process.env.PR_TITLE ?? "";
const conventionalTitle =
	/^(feat|fix|docs|test|chore)(\([a-z0-9][a-z0-9._/-]*\))?: .{1,100}$/i;

if (!conventionalTitle.test(title)) {
	console.error(`Invalid pull request title: ${title || "(empty)"}`);
	console.error(
		"Use one of: feat:, fix:, docs:, test:, chore:. An optional lowercase scope is allowed.",
	);
	console.error("Example: feat(radar): add an online event filter");
	process.exitCode = 1;
} else {
	console.info(`Pull request title follows the project convention: ${title}`);
}
