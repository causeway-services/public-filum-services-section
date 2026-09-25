import process from "node:process";
import { fileURLToPath } from "node:url";
import { assertedNow, resolveDate, reportWrite, writeBundleIfAbsent } from "@causeway-services/koios-news-service-section/news/newswire";
const CLAIM_SETS_URL = process.env.RETE_AGENTIUM_CLAIM_SETS ?? "http://127.0.0.1:18791/newsroom-claim-sets.json";
const STORE = fileURLToPath(new URL("../../store/rete-agentium/", import.meta.url));
function slug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "claim";
}
function witnessNames(value) {
    if (value === undefined) return [];
    return typeof value === "string" ? [
        value
    ] : value;
}
function projected(claim, index, asserted, status) {
    const names = [
        ...witnessNames(claim.claimedBy),
        ...witnessNames(claim.contraryClaimedBy)
    ];
    const witness = names.length > 0 ? names.join(", ") : "rete-agentium newsroom";
    return Object.freeze({
        id: `${slug(claim.predicate)}-${index}`,
        proposition: Object.freeze({
            predicate: claim.predicate,
            object: claim.object
        }),
        time: Object.freeze({
            asserted
        }),
        force: "confirms",
        provenance: Object.freeze({
            witness,
            method: "services/newsroom cycle (news claim set, projected)",
            ...claim.citation === undefined ? {} : {
                citation: claim.citation
            }
        }),
        status
    });
}
async function main() {
    resolveDate(process.argv.slice(2).find((argument)=>argument !== "--"));
    const asserted = assertedNow();
    let claimSets;
    try {
        const response = await fetch(CLAIM_SETS_URL, {
            headers: {
                accept: "application/json"
            }
        });
        if (!response.ok) throw new TypeError(`HTTP ${response.status}`);
        const payload = await response.json();
        claimSets = Array.isArray(payload) ? payload : payload.claimSets ?? [];
    } catch (error) {
        console.log(`rete-agentium newsroom unreachable (${error.message}); nothing to assert`);
        return;
    }
    for (const claimSet of claimSets){
        if (typeof claimSet?.subject !== "string" || claimSet.subject.length === 0) continue;
        const claims = [];
        let index = 0;
        for (const claim of claimSet.potential ?? [])claims.push(projected(claim, index += 1, asserted, "supported"));
        for (const claim of claimSet.stable ?? [])claims.push(projected(claim, index += 1, asserted, "contested"));
        for (const claim of claimSet.active ?? [])claims.push(projected(claim, index += 1, asserted, "retracted"));
        if (claims.length === 0) continue;
        const bundle = Object.freeze({
            subject: slug(claimSet.subject),
            claims: Object.freeze(claims)
        });
        const outcome = await writeBundleIfAbsent(STORE, bundle);
        reportWrite("rete-agentium", bundle.subject, outcome);
    }
}
main().catch((error)=>{
    console.error(error);
    process.exitCode = 1;
});
