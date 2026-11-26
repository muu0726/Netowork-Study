import {
  computeEtherChannelSummary,
  simulateIpv6Ping,
} from "./advanced-protocols";
import { normalizeInterfaceName } from "./cli-engine";
import { isIpInSubnet } from "./ip-math";
import { areIpv6Equal } from "./ipv6-math";
import {
  simulateNslookup,
  simulatePing,
  simulateTcpConnect,
} from "./packet-simulator";
import {
  computeHsrpTable,
  computeOspfNeighbors,
  computeOspfRoutes,
  computeStpForVlan,
  syncHsrpRoles,
} from "./routing-redundancy";
import type {
  GoalEvaluationResult,
  NetworkState,
  ScenarioDefinition,
  ScenarioEvaluationResult,
  ScenarioGoal,
} from "./types";

function evaluateSingleGoal(
  state: NetworkState,
  goal: ScenarioGoal,
): GoalEvaluationResult {
  switch (goal.type) {
    case "ping": {
      const sim = simulatePing(state, goal.sourceDeviceId, goal.target);
      if (sim.trace.success) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: true,
          detail: `${goal.target} への往復Ping成功`,
        };
      }
      return {
        goalId: goal.id,
        description: goal.description,
        passed: false,
        detail: `${sim.trace.failureReason ?? "Failed"}: ${sim.trace.failureMessage ?? "疎通できません"}`,
      };
    }

    case "nslookup": {
      const sim = simulateNslookup(state, goal.sourceDeviceId, goal.hostname);
      if (sim.trace.success && sim.trace.resolvedIp === goal.expectedIp) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: true,
          detail: `${goal.hostname} → ${sim.trace.resolvedIp} の名前解決成功`,
        };
      }
      if (sim.trace.success) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `解決IPが一致しません（期待: ${goal.expectedIp}, 実際: ${sim.trace.resolvedIp ?? "none"}）`,
        };
      }
      return {
        goalId: goal.id,
        description: goal.description,
        passed: false,
        detail: `${sim.trace.failureReason ?? "Failed"}: ${sim.trace.failureMessage ?? "名前解決に失敗しました"}`,
      };
    }

    case "vlan_membership": {
      const device = state.devices[goal.deviceId];
      if (!device) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `デバイス "${goal.deviceId}" が見つかりません`,
        };
      }
      const normIf =
        normalizeInterfaceName(goal.interfaceName, device.interfaces) ??
        goal.interfaceName;
      const iface = device.interfaces[normIf];
      if (!iface) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `インターフェース "${goal.interfaceName}" が見つかりません`,
        };
      }

      const mode = iface.switchportMode ?? "access";
      if (goal.expectedMode && mode !== goal.expectedMode) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `${normIf} のモードが ${mode} です（期待: ${goal.expectedMode}）`,
        };
      }

      const actualVlan = iface.accessVlan ?? 1;
      const vlanEntry = device.vlans[goal.expectedVlan];
      if (actualVlan !== goal.expectedVlan) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `${normIf} の所属VLANが ${actualVlan} です（期待: VLAN ${goal.expectedVlan}）`,
        };
      }
      if (!vlanEntry || !vlanEntry.active) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `VLAN ${goal.expectedVlan} が存在しないか非アクティブです`,
        };
      }

      return {
        goalId: goal.id,
        description: goal.description,
        passed: true,
        detail: `${device.hostname} ${normIf} は VLAN ${goal.expectedVlan} に所属しています`,
      };
    }

    case "route_exists": {
      const device = state.devices[goal.deviceId];
      if (!device) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `デバイス "${goal.deviceId}" が見つかりません`,
        };
      }
      const found = device.staticRoutes.some(
        (r) =>
          r.destination === goal.destination &&
          r.mask === goal.mask &&
          (goal.nextHop === undefined || r.nextHop === goal.nextHop),
      );
      return {
        goalId: goal.id,
        description: goal.description,
        passed: found,
        detail: found
          ? `${device.hostname} に ${goal.destination} ${goal.mask} へのルートが存在します`
          : `${device.hostname} に ${goal.destination} ${goal.mask}${goal.nextHop ? ` via ${goal.nextHop}` : ""} のルートが設定されていません`,
      };
    }

    case "route_absent": {
      const device = state.devices[goal.deviceId];
      if (!device) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `デバイス "${goal.deviceId}" が見つかりません`,
        };
      }
      const stillPresent = device.staticRoutes.some(
        (r) =>
          r.destination === goal.destination &&
          r.mask === goal.mask &&
          (goal.nextHop === undefined || r.nextHop === goal.nextHop),
      );
      return {
        goalId: goal.id,
        description: goal.description,
        passed: !stillPresent,
        detail: !stillPresent
          ? `${device.hostname} から誤ったルートが削除されています`
          : `${device.hostname} に削除対象のルート (${goal.destination} ${goal.mask}) が残っています`,
      };
    }

    case "interface_config": {
      const device = state.devices[goal.deviceId];
      if (!device) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `デバイス "${goal.deviceId}" が見つかりません`,
        };
      }
      const normIf =
        normalizeInterfaceName(goal.interfaceName, device.interfaces) ??
        goal.interfaceName;
      const iface = device.interfaces[normIf];
      if (!iface) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `${device.hostname} にインターフェース ${goal.interfaceName} が存在しません`,
        };
      }

      if (goal.expectedIp !== undefined && iface.ip !== goal.expectedIp) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `${normIf} のIPが ${iface.ip ?? "未設定"} です（期待: ${goal.expectedIp}）`,
        };
      }
      if (
        goal.expectedMask !== undefined &&
        iface.subnetMask !== goal.expectedMask
      ) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `${normIf} のマスクが ${iface.subnetMask ?? "未設定"} です（期待: ${goal.expectedMask}）`,
        };
      }
      if (
        goal.expectedAdminUp !== undefined &&
        iface.adminUp !== goal.expectedAdminUp
      ) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `${normIf} の管理状態が ${iface.adminUp ? "up" : "shutdown"} です`,
        };
      }
      if (
        goal.expectedDot1qVlan !== undefined &&
        iface.dot1qVlan !== goal.expectedDot1qVlan
      ) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `${normIf} の dot1Q VLAN が ${iface.dot1qVlan ?? "未設定"} です（期待: ${goal.expectedDot1qVlan}）`,
        };
      }

      return {
        goalId: goal.id,
        description: goal.description,
        passed: true,
        detail: `${device.hostname} ${normIf} の設定が要件を満たしています`,
      };
    }

    case "dns_setting": {
      const device = state.devices[goal.deviceId];
      if (!device) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `デバイス "${goal.deviceId}" が見つかりません`,
        };
      }
      const passed = device.dnsServer === goal.expectedDnsIp;
      return {
        goalId: goal.id,
        description: goal.description,
        passed,
        detail: passed
          ? `${device.hostname} のDNS設定が ${goal.expectedDnsIp} に更新されました`
          : `${device.hostname} のDNS設定が ${device.dnsServer ?? "未設定"} です（期待: ${goal.expectedDnsIp}）`,
      };
    }

    case "tcp_connect": {
      const sim = simulateTcpConnect(
        state,
        goal.sourceDeviceId,
        goal.target,
        goal.port,
        "nc",
      );
      const expectSuccess = goal.expectSuccess ?? true;
      const passed = sim.trace.success === expectSuccess;
      return {
        goalId: goal.id,
        description: goal.description,
        passed,
        detail: passed
          ? expectSuccess
            ? `TCP/${goal.port} への接続に成功しました`
            : `TCP/${goal.port} は期待通り遮断/拒否されました (${sim.trace.failureReason ?? "Blocked"})`
          : expectSuccess
            ? `TCP/${goal.port} 接続失敗: ${sim.trace.failureReason ?? sim.output}`
            : `TCP/${goal.port} がまだ到達可能です（遮断される必要があります）`,
      };
    }

    case "nat_translation": {
      const sim =
        goal.port !== undefined
          ? simulateTcpConnect(
              state,
              goal.sourceDeviceId,
              goal.target,
              goal.port,
              "nc",
            )
          : simulatePing(state, goal.sourceDeviceId, goal.target);
      const natHop = sim.trace.hops.find(
        (h) =>
          h.deviceId === goal.natRouterId &&
          h.natTranslation?.direction === "inside-to-outside" &&
          h.natTranslation.afterIp === goal.expectedGlobalIp,
      );
      const passed = sim.trace.success && Boolean(natHop);
      return {
        goalId: goal.id,
        description: goal.description,
        passed,
        detail: passed && natHop?.natTranslation
          ? `${natHop.hostname} で NAPT 変換済み (${natHop.natTranslation.beforeIp} → ${natHop.natTranslation.afterIp})`
          : !sim.trace.success
            ? `通信が失敗しました (${sim.trace.failureReason ?? "Unreachable"})`
            : `${goal.natRouterId} で ${goal.expectedGlobalIp} への NAT 変換が確認できません`,
      };
    }

    case "dhcp_lease": {
      const device = state.devices[goal.clientDeviceId];
      if (!device) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `デバイス "${goal.clientDeviceId}" が見つかりません`,
        };
      }
      const primaryIface = Object.values(device.interfaces).find(
        (i) => i.name !== "Loopback0",
      );
      const ip = primaryIface?.ip;
      const mask = primaryIface?.subnetMask;
      let inSubnet = false;
      if (ip && mask === goal.expectedMask) {
        try {
          inSubnet = isIpInSubnet(ip, goal.expectedNetwork, goal.expectedMask);
        } catch {
          inSubnet = false;
        }
      }
      const gwOk =
        !goal.expectedGateway || device.defaultGateway === goal.expectedGateway;
      const dnsOk = !goal.expectedDns || device.dnsServer === goal.expectedDns;
      const passed = Boolean(ip && inSubnet && gwOk && dnsOk);
      return {
        goalId: goal.id,
        description: goal.description,
        passed,
        detail: passed
          ? `${device.hostname} が IP ${ip} / ${mask} を自動取得済みです`
          : !ip
            ? `${device.hostname} にまだ IP が割り当てられていません (ipconfig /renew)`
            : !inSubnet
              ? `${device.hostname} の IP ${ip} (${mask ?? "-"}) が期待ネットワーク ${goal.expectedNetwork} (${goal.expectedMask}) と一致しません`
              : !gwOk
                ? `GW が ${device.defaultGateway ?? "未設定"} です（期待: ${goal.expectedGateway}）`
                : `DNS が ${device.dnsServer ?? "未設定"} です（期待: ${goal.expectedDns}）`,
      };
    }

    case "acl_applied": {
      const device = state.devices[goal.deviceId];
      if (!device) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `デバイス "${goal.deviceId}" が見つかりません`,
        };
      }
      const resolvedIfName =
        normalizeInterfaceName(goal.interfaceName, device.interfaces) ??
        goal.interfaceName;
      const iface =
        device.interfaces[resolvedIfName] ??
        Object.values(device.interfaces).find(
          (i) => i.name.toLowerCase() === goal.interfaceName.toLowerCase(),
        );
      if (!iface) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `${device.hostname} に ${goal.interfaceName} が見つかりません`,
        };
      }
      const appliedAcl =
        goal.direction === "in" ? iface.inboundAcl : iface.outboundAcl;
      const aclExists = Boolean(appliedAcl && device.acls?.[appliedAcl]);
      const nameMatches = !goal.aclName || appliedAcl === goal.aclName;
      const passed = Boolean(appliedAcl && aclExists && nameMatches);
      return {
        goalId: goal.id,
        description: goal.description,
        passed,
        detail: passed
          ? `${device.hostname} ${iface.name} (${goal.direction}) に ACL ${appliedAcl} が適用されています`
          : `${device.hostname} ${iface.name} (${goal.direction}) の ACL 適用を確認してください（現在: ${appliedAcl ?? "未適用"}）`,
      };
    }

    case "ospf_neighbor": {
      const device = state.devices[goal.deviceId];
      if (!device) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `デバイス "${goal.deviceId}" が見つかりません`,
        };
      }
      const neighbors = computeOspfNeighbors(state, goal.deviceId);
      const minNeighbors = goal.minNeighbors ?? 1;
      const matchesDev =
        !goal.expectedNeighborDeviceId ||
        neighbors.some(
          (n) => n.neighborDeviceId === goal.expectedNeighborDeviceId,
        );
      const matchesRid =
        !goal.expectedNeighborRouterId ||
        neighbors.some(
          (n) => n.neighborRouterId === goal.expectedNeighborRouterId,
        );
      const passed =
        neighbors.length >= minNeighbors && matchesDev && matchesRid;
      return {
        goalId: goal.id,
        description: goal.description,
        passed,
        detail: passed
          ? `${device.hostname} が OSPF ネイバー (${neighbors.map((n) => n.neighborRouterId).join(", ")}) を確立しています`
          : `${device.hostname} の OSPF ネイバー要件を満たしていません（現在のネイバー数: ${neighbors.length}）`,
      };
    }

    case "ospf_route": {
      const device = state.devices[goal.deviceId];
      if (!device) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `デバイス "${goal.deviceId}" が見つかりません`,
        };
      }
      const routes = computeOspfRoutes(state, goal.deviceId);
      const hit = routes.find((r) => {
        if (r.destination !== goal.destination || r.mask !== goal.mask) {
          return false;
        }
        if (goal.expectedNextHop && r.nextHop !== goal.expectedNextHop) {
          return false;
        }
        if (goal.expectedInterface && r.interfaceName !== goal.expectedInterface) {
          return false;
        }
        return true;
      });
      const passed = Boolean(hit);
      return {
        goalId: goal.id,
        description: goal.description,
        passed,
        detail: passed && hit
          ? `${device.hostname} が O ロート ${hit.destination}/${hit.prefixLength} via ${hit.nextHop} (${hit.interfaceName}, cost=${hit.metric}) を学習済みです`
          : `${device.hostname} に期待される OSPF ルート (${goal.destination}/${goal.mask}${goal.expectedNextHop ? ` via ${goal.expectedNextHop}` : ""}) がありません`,
      };
    }

    case "stp_root": {
      const stpMap = computeStpForVlan(state, goal.vlanId);
      const expectedSw = state.devices[goal.expectedRootDeviceId];
      const swState = stpMap[goal.expectedRootDeviceId];
      const passed = Boolean(swState && swState.isRoot);
      const actualRoot = Object.values(stpMap).find((s) => s.isRoot);
      return {
        goalId: goal.id,
        description: goal.description,
        passed,
        detail: passed
          ? `VLAN ${goal.vlanId} の Root Bridge は ${expectedSw?.hostname ?? goal.expectedRootDeviceId} (Priority ${swState?.bridgePriority}) です`
          : `VLAN ${goal.vlanId} の現在の Root Bridge は ${actualRoot?.hostname ?? "不明"} (Priority ${actualRoot?.bridgePriority ?? "-"}) です`,
      };
    }

    case "hsrp_state": {
      const device = state.devices[goal.deviceId];
      if (!device) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `デバイス "${goal.deviceId}" が見つかりません`,
        };
      }
      const resolvedIf =
        normalizeInterfaceName(goal.interfaceName, device.interfaces) ??
        goal.interfaceName;
      const table = computeHsrpTable(state);
      const entry = table.find(
        (e) =>
          e.deviceId === goal.deviceId &&
          e.interfaceName.toLowerCase() === resolvedIf.toLowerCase() &&
          e.group === goal.group,
      );
      const stateOk = entry?.state === goal.expectedState;
      const vipOk =
        !goal.expectedVirtualIp || entry?.virtualIp === goal.expectedVirtualIp;
      const preemptOk =
        goal.expectedPreempt === undefined ||
        entry?.preempt === goal.expectedPreempt;
      const passed = Boolean(entry && stateOk && vipOk && preemptOk);
      return {
        goalId: goal.id,
        description: goal.description,
        passed,
        detail: passed && entry
          ? `${device.hostname} ${entry.interfaceName} Grp ${entry.group} は ${entry.state} (VIP ${entry.virtualIp}, Preempt=${entry.preempt ? "ON" : "OFF"}) です`
          : `${device.hostname} ${resolvedIf} Grp ${goal.group}: 状態=${entry?.state ?? "未設定"}, VIP=${entry?.virtualIp ?? "-"}, Preempt=${entry?.preempt ? "ON" : "OFF"}`,
      };
    }

    case "hsrp_failover": {
      const activeDev = state.devices[goal.activeDeviceId];
      if (!activeDev) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `デバイス "${goal.activeDeviceId}" が見つかりません`,
        };
      }
      const resolvedActiveIf =
        normalizeInterfaceName(goal.activeInterfaceName, activeDev.interfaces) ??
        goal.activeInterfaceName;
      const cloned: NetworkState = structuredClone(state);
      const targetIface = cloned.devices[goal.activeDeviceId]?.interfaces[resolvedActiveIf];
      if (!targetIface) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `${activeDev.hostname} に ${goal.activeInterfaceName} が見つかりません`,
        };
      }
      targetIface.adminUp = false;
      const failedState = syncHsrpRoles(cloned);
      const failoverTable = computeHsrpTable(failedState);
      const standbyPromoted = failoverTable.some(
        (e) =>
          e.deviceId === goal.expectedStandbyDeviceId && e.state === "Active",
      );
      const pingAfter = simulatePing(
        failedState,
        goal.testSourceDeviceId,
        goal.testTarget,
      );
      const passed = standbyPromoted && pingAfter.trace.success;
      return {
        goalId: goal.id,
        description: goal.description,
        passed,
        detail: passed
          ? `${activeDev.hostname} ${resolvedActiveIf} 障害時に ${goal.expectedStandbyDeviceId} へ Active が切り替わり通信が継続します`
          : !standbyPromoted
            ? `${activeDev.hostname} 障害時に ${goal.expectedStandbyDeviceId} が Active へ昇格しませんでした`
            : `フェイルオーバー後の疎通テストに失敗しました (${pingAfter.trace.failureReason ?? "Unreachable"})`,
      };
    }

    case "etherchannel_up": {
      const summary = computeEtherChannelSummary(state, goal.deviceId);
      const grp = summary.find((g) => g.groupId === goal.groupId);
      const bundled = grp?.members.filter((m) => m.flag === "P").length ?? 0;
      const passed = Boolean(grp && grp.status === "SU" && bundled >= goal.minMembers);
      return {
        goalId: goal.id,
        description: goal.description,
        passed,
        detail: passed
          ? `Port-Channel ${goal.groupId} (SU) が ${bundled} 本のリンクで稼働中です`
          : `Port-Channel ${goal.groupId} の稼働メンバー数: ${bundled} / ${goal.minMembers}（show etherchannel summary で確認）`,
      };
    }

    case "port_security_ok": {
      const device = state.devices[goal.deviceId];
      if (!device) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `デバイス "${goal.deviceId}" が見つかりません`,
        };
      }
      const normIf =
        normalizeInterfaceName(goal.interfaceName, device.interfaces) ??
        goal.interfaceName;
      const iface = device.interfaces[normIf];
      if (!iface) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `インターフェース "${goal.interfaceName}" が見つかりません`,
        };
      }
      const ps = iface.portSecurity;
      const enabledOk = Boolean(ps?.enabled);
      const notErrOk =
        goal.requireNotErrDisabled === false || !ps?.errDisabled;
      const maxMacOk =
        goal.minMaxMac === undefined || (ps?.maxMac ?? 0) >= goal.minMaxMac;
      const adminOk = iface.adminUp;
      const passed = enabledOk && notErrOk && maxMacOk && adminOk;
      return {
        goalId: goal.id,
        description: goal.description,
        passed,
        detail: passed
          ? `${device.hostname} ${normIf} の Port Security が正常復旧しています (max=${ps?.maxMac})`
          : `${device.hostname} ${normIf}: errDisabled=${Boolean(ps?.errDisabled)}, adminUp=${adminOk}, maxMac=${ps?.maxMac ?? 0}`,
      };
    }

    case "ipv6_interface": {
      const device = state.devices[goal.deviceId];
      if (!device) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `デバイス "${goal.deviceId}" が見つかりません`,
        };
      }
      const normIf =
        normalizeInterfaceName(goal.interfaceName, device.interfaces) ??
        goal.interfaceName;
      const iface = device.interfaces[normIf];
      if (!iface) {
        return {
          goalId: goal.id,
          description: goal.description,
          passed: false,
          detail: `インターフェース "${goal.interfaceName}" が見つかりません`,
        };
      }
      const addrOk = Boolean(
        iface.ipv6Address && areIpv6Equal(iface.ipv6Address, goal.expectedIpv6),
      );
      const adminOk =
        goal.expectedAdminUp === undefined || iface.adminUp === goal.expectedAdminUp;
      const passed = addrOk && adminOk;
      return {
        goalId: goal.id,
        description: goal.description,
        passed,
        detail: passed
          ? `${device.hostname} ${normIf} に IPv6 ${iface.ipv6Address} が設定・有効化されています`
          : `${device.hostname} ${normIf} IPv6=${iface.ipv6Address ?? "未設定"} (期待: ${goal.expectedIpv6}), adminUp=${iface.adminUp}`,
      };
    }

    case "ipv6_ping": {
      const sim = simulateIpv6Ping(state, goal.sourceDeviceId, goal.targetIpv6);
      return {
        goalId: goal.id,
        description: goal.description,
        passed: sim.trace.success,
        detail: sim.trace.success
          ? `${goal.targetIpv6} への往復 IPv6 Ping 成功`
          : `${sim.trace.failureReason ?? "Failed"}: ${sim.trace.failureMessage ?? "IPv6疎通できません"}`,
      };
    }
  }
}

export function evaluateScenario(
  state: NetworkState,
  scenario: ScenarioDefinition,
): ScenarioEvaluationResult {
  const results = scenario.goals.map((goal) =>
    evaluateSingleGoal(state, goal),
  );
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  return {
    scenarioId: scenario.id,
    passed: totalCount > 0 && passedCount === totalCount,
    passedCount,
    totalCount,
    results,
  };
}
