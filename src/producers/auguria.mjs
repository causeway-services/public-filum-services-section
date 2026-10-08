#!/usr/bin/env node
// auguria: the Kalshi-markets wire. Reads the house's Kalshi market research briefs
// (forecasting-service data/records/kalshi-market-briefs/<date>/, schema content/schemas/
// kalshi-market-brief.schema.json) and asserts one claim-state bundle per event: the odds as of
// their instant with the Kalshi API source, the rule and settlement source, the house view with
// its evidence, and the base rate with its record. Prose projections come second: a question
// headline (title), a direct-answer paragraph (summary), and the full question-sectioned article
// with FAQ (article, faq) as claims, so the cable's feeds carry them to subscribers.
//
//   node src/producers/auguria.mjs [YYYY-MM-DD]      (KALSHI_BRIEFS_ROOT overrides the briefs root)
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { assertedNow, reportWrite, resolveDate, writeBundleIfAbsent } from "@causeway-services/koios-news/news/newswire";

const WIRE = "auguria";
const STORE = fileURLToPath(new URL("../../store/auguria/", import.meta.url));
const SERVICES_ROOT = fileURLToPath(new URL(".", import.meta.url)).split("/561-group/services/")[0] + "/561-group/services/";
const BRIEFS_ROOT = process.env.KALSHI_BRIEFS_ROOT ?? join(SERVICES_ROOT,
  "engineering-services-section/services/computer-engineering-services-section/services/computer-systems-engineering-services-section/services/computer-web-engineering-services-section/services/web-platform-services-section/services/web3-platform-services-section/web3-gambling-platform-services-section/services/kalshi-services-section/services/forecasting-service/data/records/kalshi-market-briefs");
const API = "https://api.elections.kalshi.com/trade-api/v2/events/";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const when = (instant) => { const d = new Date(instant); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} at ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`; };
const percent = (p) => (p === null || p === undefined ? "no quote" : p < 0.005 ? "<1%" : p > 0.995 ? ">99%" : `${Math.round(p * 100)}%`);
const pct1 = (p) => `${(p * 100).toFixed((p >= 0.1 && p < 0.99) || p === 0 ? 0 : 1)}%`;
const volume = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} million` : n >= 1e3 ? `${Math.round(n / 1e3)} thousand` : String(Math.round(n)));
const hoursPhrase = (h) => (h < 1 ? "in under an hour" : h < 36 ? `in about ${Math.round(h)} hours` : `in about ${Math.round(h / 24)} days`);
const joinList = (items) => (items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`);
const unquestion = (title) => title.replace(/\?\s*$/u, "");
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");

function leadMarkets(brief, count = 3) {
  const quoted = brief.markets.filter((m) => m.impliedYes !== null);
  const key = brief.event.mutuallyExclusive ? (a, b) => b.impliedYes - a.impliedYes : (a, b) => Math.abs(a.impliedYes - 0.5) - Math.abs(b.impliedYes - 0.5);
  return quoted.sort((a, b) => key(a, b) || b.volume24h - a.volume24h).slice(0, count);
}
const outcome = (m) => `${m.label} at ${percent(m.impliedYes)}`;

function headline(brief) {
  const { title, subTitle } = brief.event;
  const text = /\?\s*$/u.test(title) ? `${title.trim()} What Kalshi's odds say` : `What are the Kalshi odds on "${title.trim()}${subTitle && !title.includes(subTitle) ? ` (${subTitle})` : ""}"?`;
  return text.length <= 140 ? text : `${text.slice(0, 137).replace(/\s+\S*$/u, "")}...`;
}

function bandSentence(band, quote) {
  const interval = band.yesRate95?.[0] != null ? `; 95% interval ${pct1(band.yesRate95[0])} to ${pct1(band.yesRate95[1])}` : "";
  const where = band.scope === "family" ? `${band.family.replace("*", "")} daily markets` : `${band.category} markets`;
  return `${where} quoted ${quote} about ${band.horizonHours} hours before close settled YES ${pct1(band.yesRate)} of the time in our sample (${band.n.toLocaleString("en-US")} markets${interval}).${band.n < 30 ? " This is a small sample and a lead, not a rule." : ""}`;
}

/** The house view as prose, and as the evidence lines it rests on. */
function viewOf(brief, leads) {
  const parts = [];
  if (brief.house.status === "priced") {
    const priced = leads.filter((m) => m.house?.probability != null);
    if (priced.length) parts.push(`Our own model, built on NOAA's National Blend of Models forecast, puts ${joinList(priced.map((m) => `${m.label} at ${percent(m.house.probability)} (the market: ${percent(m.impliedYes)})`))}.`);
    parts.push("The model has not beaten the market near the middle of the range in our out-of-sample test, so we treat Kalshi's price as the better estimate there and use the model chiefly to judge the extreme brackets.");
  }
  const favorite = brief.markets.find((m) => m.baseRate?.scope === "family" && m.baseRate.band === "favorite");
  if (favorite) parts.push(`${bandSentence(favorite.baseRate, `at ${favorite.yesBidCents} to ${favorite.yesAskCents} cents`)} The ${favorite.label.toLowerCase()} contract is quoted at ${favorite.yesBidCents} to ${favorite.yesAskCents} cents: a favorite that pays little when it wins.`);
  if (!parts.length) {
    const lead = leads.find((m) => m.baseRate);
    parts.push("We have no model of our own for this market, so the odds above are the traders' consensus and not an independent estimate.");
    if (lead) parts.push(bandSentence(lead.baseRate, lead.baseRate.band === "longshot" ? `at ${lead.yesAskCents} cents or less` : `at ${lead.yesAskCents} cents or more`));
    else if (brief.baseRate?.category) parts.push(`For calibration: in our sample of settled ${brief.event.category} markets, the Kalshi mid-price a day before close scored a Brier error of ${brief.baseRate.category.brierOfMid} (a coin-flip price scores 0.25; lower is better).`);
  }
  return parts.join(" ");
}

function reliability(brief) {
  const c = brief.baseRate?.category;
  if (!c) return "We have no settled-market sample for this category, so we cannot say how well calibrated its prices have been.";
  const lines = [`Across ${c.markets.toLocaleString("en-US")} settled ${brief.event.category} markets in our sample (Kalshi, ${c.window?.[0] ?? ""} to ${c.window?.[1] ?? ""}), the Kalshi mid-price about ${c.horizonHours} hours before close had a Brier error of ${c.brierOfMid}; a coin-flip price scores 0.25 and lower is better.`];
  if (c.longshot?.n) lines.push(`Contracts quoted at 5 cents or less settled YES ${pct1(c.longshot.yesRate)} of the time (${c.longshot.n} markets); contracts quoted at 95 cents or more settled YES ${c.favorite?.n ? `${pct1(c.favorite.yesRate)} (${c.favorite.n} markets)` : "in too few cases to say"}.`);
  lines.push("The sample covers a few weeks, so it is a guide to how markets like this have behaved, not a guarantee of how this one will settle.");
  return lines.join(" ");
}

function faqOf(brief, leads) {
  const t = unquestion(brief.event.title);
  const src = brief.settlementSource.primary;
  return [
    { q: `What are the odds on "${t}"?`, a: `As of ${when(brief.asOf)}, Kalshi implies ${joinList(leads.map(outcome))}. These move with every trade; the live market is at ${brief.event.url}.` },
    { q: "What does a price on Kalshi mean as a probability?", a: "A contract that pays $1 if the outcome happens and trades at 45 cents implies about a 45% chance, before fees and ignoring the small gap between the bid and the ask. We take the middle of the bid and the ask." },
    { q: "When does this market close and settle?", a: `It closes ${when(brief.event.closesAt)} and is expected to settle ${when(brief.event.expectedSettleAt)}, ${hoursPhrase(brief.event.hoursToClose)} from the time of writing.` },
    { q: "Where does the settlement data come from?", a: `${src ? `Kalshi names ${src.name} (${src.url}) as the settlement source.` : `Kalshi's rules name the source; read them at ${brief.event.url}.`}${brief.rules.contractTermsUrl ? ` The full contract terms are at ${brief.rules.contractTermsUrl}.` : ""}` },
    { q: "Can I bet on this on Kalshi?", a: `Kalshi is a federally regulated exchange (a CFTC-designated contract market). Whether you can trade depends on your location and eligibility under Kalshi's terms. The market is at ${brief.event.url}.` },
    { q: "Is this financial advice?", a: "No. This wire reports a market's odds and its publisher's analysis from public information. Prediction-market contracts can lose their entire price." },
  ];
}

function articleOf(brief, leads, faq) {
  const asOf = when(brief.asOf);
  const src = brief.settlementSource.primary;
  const top = (brief.event.mutuallyExclusive ? [...brief.markets].sort((a, b) => (b.impliedYes ?? 0) - (a.impliedYes ?? 0)) : [...brief.markets].sort((a, b) => b.volume24h - a.volume24h)).slice(0, 8);
  return [
    `## What are the current Kalshi odds?\n\nOdds as of ${asOf}. Each price is the middle of the bid and the ask, read as a probability; the market lists ${brief.book.markets} outcome${brief.book.markets === 1 ? "" : "s"} and ${volume(brief.book.volume24h)} contracts traded in the last 24 hours.\n\n${top.map((m) => `- **${m.label}**: ${percent(m.impliedYes)} (bid ${m.yesBidCents ?? "-"} cents, ask ${m.yesAskCents ?? "-"} cents; ${volume(m.volume24h)} contracts in 24 hours)`).join("\n")}\n\nPrices change with every trade; the [live Kalshi market](${brief.event.url}) is the current figure.`,
    `## What is our view?\n\n${viewOf(brief, leads)}${brief.house.evidence.length ? `\n\nWhat the view rests on:\n\n${brief.house.evidence.map((e) => `- **${e.label}**: ${e.value}${e.url ? ` ([source](${e.url}))` : ""}`).join("\n")}` : ""}`,
    `## How does this market resolve?\n\n${brief.rules.primary ? `${brief.rules.primary.trim().split("\n").map((l) => `> ${l}`).join("\n")}\n\n${brief.rules.perMarket ? "Each outcome's rule names its own threshold; the one quoted is for the most-traded outcome.\n\n" : ""}` : ""}Close: ${when(brief.event.closesAt)}. Expected settlement: ${when(brief.event.expectedSettleAt)}.${src ? ` Settlement source: [${src.name}](${src.url}).` : ""}${brief.rules.contractTermsUrl ? ` Full terms: [Kalshi contract terms](${brief.rules.contractTermsUrl}).` : ""}`,
    `## What could move the odds?\n\n${brief.whatWouldMoveIt.slice(0, 6).map((l) => `- ${l}`).join("\n")}`,
    `## How reliable are markets like this one?\n\n${reliability(brief)}`,
    `## Frequently asked questions\n\n${faq.map(({ q, a }) => `### ${q}\n\n${a}`).join("\n\n")}`,
    `## About these odds\n\nOdds are a snapshot taken ${asOf} from Kalshi's public market data and are not a prediction. This uses public information only and is not financial advice; prediction-market contracts can lose their entire price. The 561 Group, which publishes this wire and Koios.News, may trade on Kalshi, including in this market.`,
  ].join("\n\n");
}

/** The newest brief per event in a day's directory (reruns leave several). */
function latestBriefs(directory) {
  const newest = new Map();
  for (const name of readdirSync(directory).filter((n) => n.endsWith(".json") && !n.startsWith("index."))) {
    const brief = JSON.parse(readFileSync(join(directory, name), "utf8"));
    if (brief.type !== "KalshiMarketBrief") continue;
    const held = newest.get(brief.event.eventTicker);
    if (!held || held.asOf < brief.asOf) newest.set(brief.event.eventTicker, brief);
  }
  return [...newest.values()];
}

function bundleOf(brief, asserted) {
  const leads = leadMarkets(brief);
  const faq = faqOf(brief, leads);
  const src = brief.settlementSource.primary;
  const valid = brief.asOf;
  const apiUrl = `${API}${brief.event.eventTicker}`;
  const claim = (id, predicate, object, force, witness, extra = {}) => Object.freeze({
    id, proposition: Object.freeze({ predicate, object }), time: Object.freeze({ asserted, valid }), force,
    provenance: Object.freeze({ witness, ...extra }), status: "supported",
  });
  const claims = [
    // prose projections: the headline and the direct answer lead, the article and FAQ follow
    claim("title", "title", headline(brief), "computes", "auguria prose projection", { method: "question headline from the event title" }),
    claim("summary", "summary", `As of ${when(brief.asOf)}, Kalshi traders price ${joinList(leads.map(outcome))} on "${unquestion(brief.event.title)}". The market closes ${hoursPhrase(brief.event.hoursToClose)} and settles on ${src ? src.name : "the source named in its rules"}. ${viewOf(brief, leads).split(". ")[0].replace(/\.$/u, "")}. Live market: ${brief.event.url}`, "computes", "auguria prose projection", { method: "direct answer: odds as of T, close, settlement source, house view", citation: brief.event.url }),
    claim("article", "article", articleOf(brief, leads, faq), "computes", "auguria prose projection", { method: "question-sectioned article from the claims of this bundle" }),
    ...faq.map(({ q, a }, i) => claim(`faq-${i + 1}`, "faq", { question: q, answer: a }, "computes", "auguria prose projection", { method: "FAQ from the claims of this bundle" })),
    // claim state: what the sources say, what the house computes
    claim("odds", "odds-as-of", { asOf: brief.asOf, event: brief.event.eventTicker, markets: brief.markets.map((m) => ({ ticker: m.ticker, label: m.label, yesBidCents: m.yesBidCents, yesAskCents: m.yesAskCents, impliedYes: m.impliedYes, impliedYesNormalized: m.impliedYesNormalized, volume24h: m.volume24h })) }, "confirms", "Kalshi public market data", { method: "mid of the two-sided book; bid and ask as quoted at the instant", citation: apiUrl }),
    claim("rule", "rule", { primary: brief.rules.primary, secondary: brief.rules.secondary, leadMarket: brief.rules.leadMarket, closesAt: brief.event.closesAt, expectedSettleAt: brief.event.expectedSettleAt }, "confirms", "Kalshi contract rules", { method: "verbatim from the market record", citation: brief.rules.contractTermsUrl ?? brief.event.url }),
    claim("settlement-source", "settlement-source", src ?? { name: "named in the rules", url: brief.event.url }, "confirms", "Kalshi event record", { method: "settlement_sources of the event", citation: src?.url ?? brief.event.url }),
    claim("market-url", "market-url", brief.event.url, "confirms", "Kalshi public site", { method: "url form kalshi.com/markets/{series}/{series-title}/{event}", citation: brief.event.seriesUrl }),
    claim("house-view", "house-view", { model: brief.house.model, status: brief.house.status, ...(brief.house.reason ? { reason: brief.house.reason } : {}), usableAs: brief.house.usableAs, probabilities: brief.markets.filter((m) => m.house?.probability != null).map((m) => ({ ticker: m.ticker, label: m.label, probability: m.house.probability })), evidence: brief.house.evidence }, "computes", brief.house.model ?? "no house model applies", { method: brief.house.status === "priced" ? "NBM station guidance through the fitted Student-t (forecasting-service temperature-market-model)" : "none; absence stated", accuracy: brief.house.usableAs ?? undefined }),
    ...(brief.baseRate ? [claim("base-rate", "base-rate", { category: brief.baseRate.category, family: brief.baseRate.family }, "computes", "house settled-market sample", { method: "forecasting-service content/config/kalshi-category-base-rates.json (derive.py over settled Kalshi markets)", accuracy: "few weeks of settlements; small bands are leads, not rules", citation: "https://api.elections.kalshi.com/trade-api/v2/markets?status=settled" })] : []),
    claim("brief", "source-brief", { briefId: brief.briefId, opportunities: brief.opportunities.length }, "computes", "forecasting-service kalshi-market-brief", { method: "buildKalshiMarketBrief" }),
  ];
  const stamp = brief.asOf.replace(/[-:.]/gu, "").slice(0, 13).toLowerCase();
  return Object.freeze({ subject: `${slug(brief.event.eventTicker)}-${stamp}`, claims: Object.freeze(claims.map((c) => (c.provenance.accuracy === undefined ? { ...c, provenance: Object.fromEntries(Object.entries(c.provenance).filter(([, v]) => v !== undefined)) } : c))) });
}

const date = resolveDate(process.argv.slice(2).find((argument) => argument !== "--"));
const directory = join(BRIEFS_ROOT, date);
if (!existsSync(directory)) {
  console.log(`auguria: no briefs at ${directory}; nothing to assert`);
} else {
  const asserted = assertedNow();
  for (const brief of latestBriefs(directory)) {
    const bundle = bundleOf(brief, asserted);
    reportWrite(WIRE, bundle.subject, await writeBundleIfAbsent(STORE, bundle));
  }
}
