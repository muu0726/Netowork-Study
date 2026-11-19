import { describe, expect, it } from "vitest";
import {
  analyzeIpv6,
  areIpv6Equal,
  compressIpv6,
  expandIpv6,
  generateIpv6ConversionDrill,
  generateIpv6TypeQuiz,
  isCanonicalCompressedIpv6,
  parseIpv6,
} from "./ipv6-math";

describe("Phase 8: IPv6 parsing, RFC 5952 compression/expansion & classification", () => {
  it("validates IPv6 strings strictly and rejects malformed syntax", () => {
    expect(parseIpv6("2001:db8::1").ok).toBe(true);
    expect(parseIpv6("fe80::1/64")).toMatchObject({ ok: true, prefixLength: 64 });
    expect(parseIpv6("::1").ok).toBe(true);
    expect(parseIpv6("::").ok).toBe(true);

    // Reject multiple ::, :::, invalid hex, wrong group counts, bad prefix
    expect(parseIpv6("2001::db8::1").ok).toBe(false);
    expect(parseIpv6("2001:::1").ok).toBe(false);
    expect(parseIpv6("2001:db8:gggg::1").ok).toBe(false);
    expect(parseIpv6("2001:db8:1:2:3").ok).toBe(false);
    expect(parseIpv6("2001:db8::1/129").ok).toBe(false);
    expect(parseIpv6(":2001:db8::1").ok).toBe(false);
  });

  it("expands and compresses according to RFC 5952 longest-run & single-zero rules", () => {
    expect(expandIpv6("2001:db8::1")).toBe(
      "2001:0db8:0000:0000:0000:0000:0000:0001",
    );
    expect(expandIpv6("::/128")).toBe(
      "0000:0000:0000:0000:0000:0000:0000:0000/128",
    );

    expect(compressIpv6("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe(
      "2001:db8::1",
    );
    // Longest zero run wins over shorter earlier zero run; single zero stays "0"
    expect(compressIpv6("2001:0db8:0000:0001:0000:0000:0000:0001")).toBe(
      "2001:db8:0:1::1",
    );
    // Tie between two 2-group zero runs -> leftmost collapses per RFC 5952
    expect(compressIpv6("2001:0db8:0000:0000:0001:0000:0000:0001")).toBe(
      "2001:db8::1:0:0:1",
    );
    // Single 0 group is NEVER collapsed into ::
    expect(compressIpv6("2001:0db8:0000:000a:0001:0002:0003:0004")).toBe(
      "2001:db8:0:a:1:2:3:4",
    );
    expect(compressIpv6("0000:0000:0000:0000:0000:0000:0000:0001")).toBe("::1");
    expect(compressIpv6("0000:0000:0000:0000:0000:0000:0000:0000")).toBe("::");

    expect(areIpv6Equal("2001:0db8:0:0::1", "2001:db8::1")).toBe(true);
    expect(isCanonicalCompressedIpv6("2001:db8:0:1::1")).toBe(true);
    expect(isCanonicalCompressedIpv6("2001:db8::1:0:0:0:1")).toBe(false);
  });

  it("classifies GUA, Link-Local, Unique Local, Multicast, Loopback & generates deterministic drills", () => {
    expect(analyzeIpv6("2001:db8::1")?.typeInfo.type).toBe("global-unicast");
    expect(analyzeIpv6("fe80::1")?.typeInfo.type).toBe("link-local");
    expect(analyzeIpv6("fc00::1")?.typeInfo.type).toBe("unique-local");
    expect(analyzeIpv6("fd12:3456::1")?.typeInfo.type).toBe("unique-local");
    expect(analyzeIpv6("ff02::1")?.typeInfo.type).toBe("multicast");
    expect(analyzeIpv6("::1")?.typeInfo.type).toBe("loopback");
    expect(analyzeIpv6("::")?.typeInfo.type).toBe("unspecified");

    const conv1 = generateIpv6ConversionDrill(1, "compress");
    expect(conv1.expectedAnswer).toBe(compressIpv6(conv1.promptAddress));

    const quiz1 = generateIpv6TypeQuiz(1);
    expect(quiz1.choices.some((c) => c.type === quiz1.expectedType)).toBe(true);
  });
});
