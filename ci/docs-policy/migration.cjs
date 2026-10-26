"use strict";
// Offline preparation/verification only. No settings API write is performed.
const {policy,digest,REVIEW,CI,LEGACY}=require('./integration.cjs');
function prepare(current, proof) {
  if(!current || current.enforcement!=='active' || current.target!=='branch' || !Number.isSafeInteger(current.id))throw Error('Active branch ruleset required');
  if(!policy.integrationAllowlist.includes(current.source) || !current.conditions?.ref_name?.include?.some(r=>['refs/heads/main','~DEFAULT_BRANCH'].includes(r)))throw Error('Unsupported repository or target');
  if(!proof || proof.repository!==current.source || proof.appId!==policy.enforcementAppId ||
     !/^[a-f0-9]{40}$/.test(proof.installedSourceSha||'') || proof.independentBootstrapApproved!==true ||
     proof.positiveAndNegativeAccepted!==true || ![REVIEW,CI].every(c=>proof.contexts?.includes(c)) ||
     !Array.isArray(proof.evidenceUrls) || !proof.evidenceUrls.length ||
     proof.evidenceUrls.some(url=>!url.startsWith(`https://github.com/${current.source}/`)))throw Error('Verified installed producer and independent bootstrap evidence required');
  const payload=JSON.parse(JSON.stringify(Object.fromEntries(['name','target','enforcement','bypass_actors','conditions','rules'].map(k=>[k,current[k]]))));
  const status=payload.rules.filter(r=>r.type==='required_status_checks');
  if(status.length!==1)throw Error('Ambiguous required-check contract');
  const checks=status[0].parameters.required_status_checks;
  if(!checks.some(c=>c.context===LEGACY&&c.integration_id===policy.enforcementAppId))throw Error('Existing App guard must remain required');
  for(const context of [REVIEW,CI]) {
    if(checks.some(c=>c.context===context&&c.integration_id!==policy.enforcementAppId))throw Error('Existing context has wrong publisher');
    if(!checks.some(c=>c.context===context))checks.push({context,integration_id:policy.enforcementAppId});
  }
  return {version:1,repository:current.source,rulesetId:current.id,expectedCurrentDigest:digest(current),
    installedSourceSha:proof.installedSourceSha,method:'PUT',
    endpoint:`repos/${current.source}/rulesets/${current.id}`,payload,
    note:'Prepared only. Re-read exact ruleset and compare digest immediately before separately authorized admin execution. Retain all old guards; verify all effective rules afterward.'};
}
function assertUnchanged(plan,current) {
  if(plan.expectedCurrentDigest!==digest(current))throw Error('Ruleset drift; regenerate and review the plan');
  return true;
}
module.exports={prepare,assertUnchanged};
if(require.main===module){
  const fs=require('node:fs');
  const [before,proof]=process.argv.slice(2);
  if(!before||!proof)throw Error('Usage: node migration.cjs before-ruleset.json verified-publisher-proof.json');
  process.stdout.write(JSON.stringify(prepare(JSON.parse(fs.readFileSync(before)),JSON.parse(fs.readFileSync(proof))),null,2)+'\n');
}
