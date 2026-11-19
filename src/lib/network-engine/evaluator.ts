import { normalizeInterfaceName } from "./cli-engine";
import { simulateNslookup, simulatePing } from "./packet-simulator";
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
