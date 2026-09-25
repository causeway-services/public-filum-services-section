#!/usr/bin/env node
import process from "node:process";
import { fileURLToPath } from "node:url";
import { dailySpread } from "@lenticule-science/divining/divination";
import { assertedNow, computesClaim, reportWrite, resolveDate, writeBundleIfAbsent } from "@causeway-services/koios-news-service-section/src/news/newswire.mjs";
const WIRE = "cartomantia";
const WITNESS = "divination-topology seeded draw";
const STORE = fileURLToPath(new URL("../../store/cartomantia/", import.meta.url));
const SEED_SALT = "cartomantia";
const date = resolveDate(process.argv.slice(2).find((argument)=>argument !== "--"));
const asserted = assertedNow();
const spread = dailySpread(date, SEED_SALT);
const position = spread.positions[0];
if (position === undefined) throw new TypeError("dailySpread yielded no positions");
const card = Object.freeze({
    name: position.card.name,
    arcana: position.card.arcana,
    orientation: position.orientation,
    position: position.position
});
const bundle = Object.freeze({
    subject: `draw-${date}`,
    claims: Object.freeze([
        computesClaim({
            id: "title",
            predicate: "title",
            object: `The draw of ${date}`,
            asserted,
            valid: date,
            witness: WITNESS,
            method: spread.provenance.method
        }),
        computesClaim({
            id: "card",
            predicate: "card",
            object: card,
            asserted,
            valid: date,
            witness: WITNESS,
            method: spread.provenance.method
        }),
        computesClaim({
            id: "seed",
            predicate: "seed",
            object: spread.provenance.seed,
            asserted,
            valid: date,
            witness: WITNESS,
            method: spread.provenance.method
        })
    ])
});
reportWrite(WIRE, bundle.subject, await writeBundleIfAbsent(STORE, bundle));
