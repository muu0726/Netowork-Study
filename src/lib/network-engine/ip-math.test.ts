import { describe, expect, it } from "vitest";
import {
  calculateSubnet,
  intToBinaryOctets,
  intToIpv4,
  ipv4ToInt,
  isIpInSubnet,
  isSameSubnet,
  isValidHostIp,
  isValidIpv4,
  isValidSubnetMask,
  longestPrefixMatch,
  maskToPrefix,
  parseIpv4,
  prefixToMask,
  prefixToMaskInt,
} from "./ip-math";

describe("ip-math", () => {
  describe("IPv4 strict validation and 32-bit unsigned conversion", () => {
    it("rejects malformed or out-of-range IPv4 addresses without NaN or overflow", () => {
      const invalidInputs = [
        "",
        "abc",
        "192.168.1",
        "192.168.1.1.1",
        "192.168.1.300",
        "256.0.0.1",
        "-1.0.0.1",
        "192.168.01.1",
        " 192.168.1.1",
        "192.168.1.1 ",
        "192.168.1.1a",
      ];

      for (const input of invalidInputs) {
        const parsed = parseIpv4(input);
        expect(parsed.ok).toBe(false);
        expect(isValidIpv4(input)).toBe(false);
        expect(() => ipv4ToInt(input)).toThrow();
      }
    });

    it("converts IPv4 strings to/from 32-bit unsigned integers across boundaries", () => {
      expect(ipv4ToInt("0.0.0.0")).toBe(0);
      expect(intToIpv4(0)).toBe("0.0.0.0");

      expect(ipv4ToInt("192.168.1.1")).toBe(3232235777);
      expect(intToIpv4(3232235777)).toBe("192.168.1.1");

      expect(ipv4ToInt("255.255.255.255")).toBe(4294967295);
      expect(intToIpv4(4294967295)).toBe("255.255.255.255");

      expect(intToBinaryOctets(ipv4ToInt("192.168.10.1"))).toBe(
        "11000000.10101000.00001010.00000001",
      );

      expect(() => intToIpv4(-1)).toThrow();
      expect(() => intToIpv4(0x1_0000_0000)).toThrow();
      expect(() => intToIpv4(Number.NaN)).toThrow();
    });
  });

  describe("Prefix length and subnet mask conversions", () => {
    it("converts prefixes /0 through /32 accurately", () => {
      expect(prefixToMaskInt(0)).toBe(0);
      expect(prefixToMask(0)).toBe("0.0.0.0");
      expect(prefixToMask(8)).toBe("255.0.0.0");
      expect(prefixToMask(16)).toBe("255.255.0.0");
      expect(prefixToMask(24)).toBe("255.255.255.0");
      expect(prefixToMask(26)).toBe("255.255.255.192");
      expect(prefixToMask(30)).toBe("255.255.255.252");
      expect(prefixToMask(31)).toBe("255.255.255.254");
      expect(prefixToMask(32)).toBe("255.255.255.255");

      expect(maskToPrefix("0.0.0.0")).toBe(0);
      expect(maskToPrefix("255.255.255.0")).toBe(24);
      expect(maskToPrefix("255.255.255.192")).toBe(26);
      expect(maskToPrefix("255.255.255.255")).toBe(32);

      expect(() => prefixToMask(-1)).toThrow();
      expect(() => prefixToMask(33)).toThrow();
    });

    it("rejects non-contiguous subnet masks", () => {
      const badMasks = [
        "255.0.255.0",
        "0.255.255.255",
        "128.0.0.1",
        "255.255.128.255",
        "255.255.255.300",
      ];
      for (const mask of badMasks) {
        expect(isValidSubnetMask(mask)).toBe(false);
        expect(() => maskToPrefix(mask)).toThrow();
      }
    });
  });

  describe("Subnet boundary calculations", () => {
    it("calculates /24, /26, /30, /31, /32, and /0 accurately", () => {
      const s24 = calculateSubnet("192.168.10.42", "255.255.255.0");
      expect(s24.prefixLength).toBe(24);
      expect(s24.networkAddress).toBe("192.168.10.0");
      expect(s24.broadcastAddress).toBe("192.168.10.255");
      expect(s24.firstHost).toBe("192.168.10.1");
      expect(s24.lastHost).toBe("192.168.10.254");
      expect(s24.usableHostCount).toBe(254);
      expect(s24.wildcardMask).toBe("0.0.0.255");

      const s26 = calculateSubnet("172.16.5.130", 26);
      expect(s26.mask).toBe("255.255.255.192");
      expect(s26.networkAddress).toBe("172.16.5.128");
      expect(s26.broadcastAddress).toBe("172.16.5.191");
      expect(s26.firstHost).toBe("172.16.5.129");
      expect(s26.lastHost).toBe("172.16.5.190");
      expect(s26.usableHostCount).toBe(62);

      const s30 = calculateSubnet("10.0.0.2", "/30");
      expect(s30.networkAddress).toBe("10.0.0.0");
      expect(s30.broadcastAddress).toBe("10.0.0.3");
      expect(s30.firstHost).toBe("10.0.0.1");
      expect(s30.lastHost).toBe("10.0.0.2");
      expect(s30.usableHostCount).toBe(2);

      const s31 = calculateSubnet("10.0.0.1", 31);
      expect(s31.networkAddress).toBe("10.0.0.0");
      expect(s31.broadcastAddress).toBe("10.0.0.1");
      expect(s31.firstHost).toBeNull();
      expect(s31.lastHost).toBeNull();
      expect(s31.usableHostCount).toBe(0);

      const s32 = calculateSubnet("10.1.1.1", 32);
      expect(s32.networkAddress).toBe("10.1.1.1");
      expect(s32.broadcastAddress).toBe("10.1.1.1");
      expect(s32.firstHost).toBe("10.1.1.1");
      expect(s32.lastHost).toBe("10.1.1.1");
      expect(s32.usableHostCount).toBe(1);

      const s0 = calculateSubnet("8.8.8.8", 0);
      expect(s0.networkAddress).toBe("0.0.0.0");
      expect(s0.broadcastAddress).toBe("255.255.255.255");
      expect(s0.firstHost).toBe("0.0.0.1");
      expect(s0.lastHost).toBe("255.255.255.254");
    });

    it("checks same subnet and host IP validity", () => {
      expect(isSameSubnet("192.168.1.10", "192.168.1.60", 26)).toBe(true);
      expect(isSameSubnet("192.168.1.10", "192.168.1.70", 26)).toBe(false);
      expect(isIpInSubnet("10.0.0.5", "10.0.0.0", "255.255.255.0")).toBe(true);

      expect(isValidHostIp("192.168.1.0", 24)).toBe(false);
      expect(isValidHostIp("192.168.1.255", 24)).toBe(false);
      expect(isValidHostIp("192.168.1.1", 24)).toBe(true);
      expect(isValidHostIp("10.0.0.1", 32)).toBe(true);
    });
  });

  describe("Longest Prefix Match (LPM)", () => {
    it("selects the most specific matching route and breaks ties by administrative distance", () => {
      const routes = [
        {
          id: "default",
          destination: "0.0.0.0",
          mask: "0.0.0.0",
          prefixLength: 0,
          adminDistance: 1,
        },
        {
          id: "slash16",
          destination: "192.168.0.0",
          mask: "255.255.0.0",
          prefixLength: 16,
          adminDistance: 1,
        },
        {
          id: "slash24-static",
          destination: "192.168.10.0",
          mask: "255.255.255.0",
          prefixLength: 24,
          adminDistance: 1,
        },
        {
          id: "slash24-connected",
          destination: "192.168.10.0",
          mask: "255.255.255.0",
          prefixLength: 24,
          adminDistance: 0,
        },
        {
          id: "host32",
          destination: "192.168.10.50",
          mask: "255.255.255.255",
          prefixLength: 32,
          adminDistance: 1,
        },
      ];

      expect(longestPrefixMatch("192.168.10.50", routes)?.id).toBe("host32");
      expect(longestPrefixMatch("192.168.10.20", routes)?.id).toBe(
        "slash24-connected",
      );
      expect(longestPrefixMatch("192.168.99.5", routes)?.id).toBe("slash16");
      expect(longestPrefixMatch("8.8.8.8", routes)?.id).toBe("default");

      expect(
        longestPrefixMatch("8.8.8.8", [
          {
            id: "lan",
            destination: "10.0.0.0",
            mask: "255.0.0.0",
            prefixLength: 8,
          },
        ]),
      ).toBeNull();
    });
  });
});
