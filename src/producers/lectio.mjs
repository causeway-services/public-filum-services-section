#!/usr/bin/env node
import process from "node:process";
import { fileURLToPath } from "node:url";
import { lectionFor, rclYear, romanDay } from "@lenticule-science/divining/liturgy";
import { assertedNow, computesClaim, reportWrite, resolveDate, writeBundleIfAbsent } from "@causeway-services/koios-news-service-section/news/newswire";
const WIRE = "lectio";
const WITNESS = "liturgy-topology";
const STORE = fileURLToPath(new URL("../../store/lectio/", import.meta.url));
const date = resolveDate(process.argv.slice(2).find((argument)=>argument !== "--"));
const asserted = assertedNow();
const day = romanDay(date);
const cycle = rclYear(date);
const outcome = lectionFor(date, "rcl");
const readingsClaim = outcome.outcome === "found" ? computesClaim({
    id: "readings",
    predicate: "readings",
    object: {
        name: outcome.entry.name,
        service: outcome.entry.service,
        readings: outcome.entry.readings
    },
    asserted,
    valid: date,
    witness: WITNESS,
    method: "lectionFor(date, \"rcl\") over the package's recorded tables",
    citation: outcome.entry.provenance
}) : computesClaim({
    id: "readings",
    predicate: "readings",
    object: "no entry recorded",
    asserted,
    valid: date,
    witness: WITNESS,
    method: "lectionFor(date, \"rcl\") over the package's recorded tables",
    accuracy: outcome.note
});
const bundle = Object.freeze({
    subject: `lection-${date}`,
    claims: Object.freeze([
        computesClaim({
            id: "title",
            predicate: "title",
            object: `The lection of ${date}`,
            asserted,
            valid: date,
            witness: WITNESS,
            method: "romanDay + rclYear + lectionFor"
        }),
        computesClaim({
            id: "season",
            predicate: "season",
            object: day,
            asserted,
            valid: date,
            witness: WITNESS,
            method: "romanDay (General Roman Calendar season partition and day chart)"
        }),
        computesClaim({
            id: "rcl-year",
            predicate: "rcl-year",
            object: cycle,
            asserted,
            valid: date,
            witness: WITNESS,
            method: "rclYear (RCL Sunday cycle of the liturgical year)"
        }),
        readingsClaim
    ])
});
reportWrite(WIRE, bundle.subject, await writeBundleIfAbsent(STORE, bundle));
