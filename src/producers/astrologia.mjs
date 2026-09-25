#!/usr/bin/env node
import process from "node:process";
import { fileURLToPath } from "node:url";
import { BODIES, EPHEMERIS_PROVENANCE, computeChart, findIngresses, findLunationQuarters, findStations, lunationOf, motionOf, signPlacement } from "@lenticule-science/divining/astrology";
import { addDays, assertedNow, computesClaim, reportWrite, resolveDate, writeBundleIfAbsent } from "@causeway-services/koios-news-service-section/src/news/newswire.mjs";
const WIRE = "astrologia";
const WITNESS = "astrology-topology ephemeris";
const STORE = fileURLToPath(new URL("../../store/astrologia/", import.meta.url));
function titleCase(atom) {
    return atom.charAt(0).toUpperCase() + atom.slice(1);
}
const date = resolveDate(process.argv.slice(2).find((argument)=>argument !== "--"));
const asserted = assertedNow();
function chartClaim(input) {
    return computesClaim({
        ...input,
        asserted,
        witness: WITNESS,
        method: EPHEMERIS_PROVENANCE.algorithm,
        accuracy: EPHEMERIS_PROVENANCE.accuracy
    });
}
const chartTime = `${date}T16:00:00Z`;
const chart = computeChart(chartTime);
const claims = [
    chartClaim({
        id: "title",
        predicate: "title",
        object: `The chart of ${date}`,
        valid: chartTime
    })
];
for (const body of BODIES){
    const state = chart.bodies[body];
    const placement = signPlacement(state.longitude);
    claims.push(chartClaim({
        id: `placement-${body}`,
        predicate: `placement-${body}`,
        object: {
            longitude: state.longitude,
            sign: placement.sign.name,
            degreeInSign: placement.degreeInSign,
            speed: state.speed,
            motion: motionOf(state)
        },
        valid: chartTime
    }));
}
const lunation = lunationOf(chart.bodies);
claims.push(chartClaim({
    id: "lunation",
    predicate: "lunation",
    object: {
        phase: lunation.phase,
        elongation: lunation.elongation,
        illuminatedFraction: lunation.illuminatedFraction,
        trend: lunation.trend
    },
    valid: chartTime
}));
const chartBundle = Object.freeze({
    subject: `chart-${date}`,
    claims: Object.freeze(claims)
});
reportWrite(WIRE, chartBundle.subject, await writeBundleIfAbsent(STORE, chartBundle));
const windowStart = `${date}T00:00:00Z`;
const windowEnd = `${addDays(date, 30)}T00:00:00Z`;
function eventBundle(subject, title, occursAt) {
    return Object.freeze({
        subject,
        claims: Object.freeze([
            chartClaim({
                id: "title",
                predicate: "title",
                object: title,
                valid: occursAt
            }),
            chartClaim({
                id: "occurs-at",
                predicate: "occurs-at",
                object: occursAt,
                valid: occursAt
            })
        ])
    });
}
for (const body of BODIES){
    for (const event of findIngresses(body, windowStart, windowEnd)){
        const sign = event.signTo.name;
        const subject = `ingress-${body}-${sign.toLowerCase()}-${event.time.slice(0, 10)}`;
        const note = event.direction === "retrograde" ? ", moving retrograde," : "";
        const title = `${titleCase(body)} enters ${sign}${note} at ${event.time}`;
        reportWrite(WIRE, subject, await writeBundleIfAbsent(STORE, eventBundle(subject, title, event.time)));
    }
}
for (const body of BODIES.filter((candidate)=>candidate !== "sun" && candidate !== "moon")){
    for (const event of findStations(body, windowStart, windowEnd)){
        const subject = `station-${body}-${event.time.slice(0, 10)}`;
        const placement = signPlacement(event.longitude);
        const title = `${titleCase(body)} stations ${event.stationTo} at ${event.time}, at ${placement.degreeInSign.toFixed(1)}° ${placement.sign.name}`;
        reportWrite(WIRE, subject, await writeBundleIfAbsent(STORE, eventBundle(subject, title, event.time)));
    }
}
for (const event of findLunationQuarters(windowStart, windowEnd)){
    const subject = `quarter-${event.quarter.replace(/ /g, "-")}-${event.time.slice(0, 10)}`;
    const title = `${titleCase(event.quarter)} at ${event.time}`;
    reportWrite(WIRE, subject, await writeBundleIfAbsent(STORE, eventBundle(subject, title, event.time)));
}
