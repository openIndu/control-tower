// spec/005 section 2.1's PR body requirement (RULE 4): "PR 正文写明意图、爆炸半径、
// 回滚方式、测试结果". Intent and test results are already fully written out in
// step 2/3's own documents (proposal-review.mjs's renderSolutionDocument,
// implement-review.mjs's renderReviewDocument) -- this module embeds them
// rather than re-deriving a second, shorter summary of the same facts.
// R3 (section 2.3's known residual risks): a repo with
// dev.publishes_on_merge:true must call that out separately here, since a
// squash-merge revert cannot un-publish an image a main-branch push already
// pushed.

export function renderPrTitle(issue) {
  return `fix: ${issue.title} (#${issue.number})`;
}

export function renderPrBody({
  issue,
  repo,
  branchName,
  solutionDocument,
  implementationReviewDocument,
  publishesOnMerge = false,
}) {
  const lines = [
    `Closes #${issue.number}`,
    "",
    "## Blast radius",
    "",
    `\`${repo}\` only, on branch \`${branchName}\`.`,
    "",
    "## Rollback",
    "",
    "Revert this PR's squash commit.",
    "",
  ];
  if (publishesOnMerge) {
    lines.push(
      "## ⚠️ Publishes on merge",
      "",
      "Merging this PR to the default branch publishes an image (R3): a `git revert` cannot un-publish it.",
      "",
    );
  }
  lines.push(
    "## Solution",
    "",
    solutionDocument,
    "",
    "## Implementation review",
    "",
    implementationReviewDocument,
  );
  return lines.join("\n");
}
