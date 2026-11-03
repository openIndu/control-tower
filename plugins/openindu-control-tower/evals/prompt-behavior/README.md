# Prompt behavior evaluation

`cases.json` contains 20 representative, independently scored workflow cases.
`run.mjs` runs each version through a pinned model and scores the returned
decision labels. It reports pass rate, regressions, latency, input/output token
usage, and API cost when the provider returns it. The model, Claude Code CLI,
prompt-source revision, and case-set revision are recorded with the result.

Run against a previous prompt revision and the current working tree:

```powershell
node plugins/openindu-control-tower/evals/prompt-behavior/run.mjs `
  --baseline 46786d1 `
  --intermediate 25ec449 `
  --model claude-sonnet-5 `
  --output plugins/openindu-control-tower/evals/prompt-behavior/results/workflow-prompts.json
```

The baseline and intermediate refs are evaluated separately from the candidate
working tree. Do not commit secrets or private Issue content in cases or results.
The runner makes three model requests, with a USD 0.50 API-call budget per
request, and may use provider quota.
`workflow-contract.test.mjs` is a deterministic, zero-model-call CI check; it
does not replace this behavior evaluation.
