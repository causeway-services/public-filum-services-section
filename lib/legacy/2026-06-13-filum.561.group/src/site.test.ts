// The sheath, tested over the REAL sites/ tree: the package's
// "561:newscable" block is a valid cable configuration, and discovery —
// being a sibling sites/<name>.filum.561.group with a "561:newswire" block
// IS being on the cable — finds exactly the five member wires.

import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createNewscable, discoverNewswires, readNewscableSiteConfig } from "@561-group/newscable";

const CONFIG_PATH = fileURLToPath(new URL("../package.json", import.meta.url));

test('the "561:newscable" block is a valid cable configuration', async () => {
  const config = await readNewscableSiteConfig(CONFIG_PATH);
  assert.equal(config.name, "filum"); // the domain's first label
  assert.equal(config.title, "Divinatio");
  assert.equal(config.domain, "filum.561.group");
  assert.equal(config.routing, "subdomain");
  assert.equal(config.port, 18804);
});

test("discovery over the real sites/ tree finds exactly the five members", async () => {
  const config = await readNewscableSiteConfig(CONFIG_PATH);
  const wires = await discoverNewswires(CONFIG_PATH, config);
  assert.deepEqual(
    wires.map((wire) => wire.name),
    ["arithmomantia", "astrologia", "cartomantia", "lectio", "rete-agentium"],
  );
  for (const wire of wires) {
    assert.equal(wire.baseUrl, `https://${wire.name}.filum.561.group/`);
    assert.ok(wire.storeDir.endsWith(`${wire.name}.filum.561.group/backstage/store`));
  }
  // The discovered membership bundles into a well-formed cable.
  const cable = createNewscable({
    name: config.name,
    title: config.title,
    description: config.description,
    domain: config.domain,
    routing: config.routing,
    wires,
  });
  assert.equal(cable.baseUrl, "https://filum.561.group/");
  assert.equal(cable.wires.length, 5);
});
