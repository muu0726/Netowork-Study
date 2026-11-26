import { describe, expect, it } from "vitest";
import {
  addSandboxDevice,
  connectSandboxLink,
  decodeSandboxStateFromBase64Url,
  disconnectSandboxLink,
  encodeSandboxStateToBase64Url,
  parseSandboxJson,
  removeSandboxDevice,
  SANDBOX_PRESETS,
  toggleSandboxLinkUp,
} from "./sandbox-utils";

describe("Sandbox topology builder & serialization", () => {
  it("adds, connects, toggles, and removes devices/links immutably", () => {
    const base = SANDBOX_PRESETS[0].state;
    const { nextState: withSw, device: sw } = addSandboxDevice(base, "switch");
    expect(sw.hostname).toBe("SW1");
    expect(Object.keys(withSw.devices)).toHaveLength(3);
    expect(Object.keys(base.devices)).toHaveLength(2);

    const conn = connectSandboxLink(withSw, "r1", "Gig0/1", sw.id, "Fa0/1");
    expect(conn.ok).toBe(true);
    if (!conn.ok) {
      return;
    }
    const addedLink = conn.nextState.links[conn.nextState.links.length - 1];
    expect(addedLink.up).toBe(true);

    // Duplicate port usage rejected
    const dup = connectSandboxLink(
      conn.nextState,
      "r1",
      "Gig0/1",
      sw.id,
      "Fa0/2",
    );
    expect(dup.ok).toBe(false);

    const downed = toggleSandboxLinkUp(conn.nextState, addedLink.id);
    expect(downed.links.find((l) => l.id === addedLink.id)?.up).toBe(false);

    const disconnected = disconnectSandboxLink(downed, addedLink.id);
    expect(disconnected.links).toHaveLength(base.links.length);

    const removed = removeSandboxDevice(disconnected, sw.id);
    expect(removed.devices[sw.id]).toBeUndefined();
  });

  it("roundtrips sandbox topologies via JSON and Base64URL", () => {
    const preset = SANDBOX_PRESETS[1].state;
    const encoded = encodeSandboxStateToBase64Url(preset);
    const decoded = decodeSandboxStateFromBase64Url(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.state).toEqual(preset);
    }

    expect(parseSandboxJson("{bad").ok).toBe(false);
    expect(parseSandboxJson(JSON.stringify({ devices: {}, links: [] })).ok).toBe(
      false,
    );
  });
});
