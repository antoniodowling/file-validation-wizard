"use strict";
const {repository}=require("./profile.json");
const SHA=/^[a-f0-9]{40}$/;
// Keep App status authentication outside Octokit's default auth hook. A per-request
// Authorization override on the ordinary workflow client is overwritten by that
// hook and cannot establish the distinct App source required by native rules.
async function postStatus({repo, sha, contextName, state, description, targetUrl, statusToken, fetchImpl = fetch}) {
  if (!statusToken) throw new Error('Dedicated enforcement App token is required; no GITHUB_TOKEN fallback');
  if (`${repo.owner}/${repo.repo}` !== repository || (typeof sha !== 'string' || sha.length !== 40 || !SHA.test(sha))) throw new Error('Invalid status destination');
  const response = await fetchImpl(`https://api.github.com/repos/${repo.owner}/${repo.repo}/statuses/${sha}`, {
    method: 'POST', redirect: 'error',
    headers: {accept: 'application/vnd.github+json', authorization: `Bearer ${statusToken}`,
      'content-type': 'application/json', 'user-agent': 'docs-policy-enforcement', 'x-github-api-version': '2022-11-28'},
    body: JSON.stringify({context: contextName, state, description: description.slice(0,140), target_url: targetUrl})
  });
  if (response.status !== 201) throw new Error(`Dedicated App status publication failed (HTTP ${response.status})`);
}

module.exports={postStatus};
