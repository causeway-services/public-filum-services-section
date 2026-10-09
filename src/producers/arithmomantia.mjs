#!/usr/bin/env node
import process from "node:process";
import { fileURLToPath } from "node:url";
import { reduceDate } from "@lenticule-science/divining/divination";
import { assertedNow, computesClaim, reportWrite, resolveDate, writeBundleIfAbsent } from "@causeway-services/koios-news/news/newswire";
const WIRE = "arithmomantia";
const WITNESS = "divination-topology numerology";
const STORE = fileURLToPath(new URL("../../store/arithmomantia/", import.meta.url));
const METHOD = "iterated digit sum; terminal set {1..9} ∪ {11, 22, 33}";
const date = resolveDate(process.argv.slice(2).find((argument)=>argument !== "--"));
const asserted = assertedNow();
const reduction = reduceDate(date);
function reductionClaim(id, predicate, object) {
    return computesClaim({
        id,
        predicate,
        object,
        asserted,
        valid: date,
        witness: WITNESS,
        method: METHOD
    });
}
const bundle = Object.freeze({
    subject: `reduction-${date}`,
    claims: Object.freeze([
        reductionClaim("title", "title", `The reduction of ${date}`),
        reductionClaim("reduces-to", "reduces-to", reduction.value),
        reductionClaim("orbit", "orbit", [
            ...reduction.steps
        ]),
        reductionClaim("kind", "kind", reduction.kind)
    ])
});
reportWrite(WIRE, bundle.subject, await writeBundleIfAbsent(STORE, bundle));
