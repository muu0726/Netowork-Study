"use client";

import { BookMarked, Check, Copy, CornerDownLeft, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import type { DeviceType } from "@/lib/network-engine";
import { cn } from "@/lib/cn";

interface CheatSheetItem {
  command: string;
  description: string;
}

interface CheatSheetSection {
  title: string;
  badge: string;
  forEndHost?: boolean;
  items: CheatSheetItem[];
}

const CHEAT_SHEET_SECTIONS: CheatSheetSection[] = [
  {
    title: "モード遷移・基本 (Router / Switch)",
    badge: "IOS EXEC",
    items: [
      { command: "enable", description: "特権EXECモード (#) へ移行" },
      { command: "configure terminal", description: "グローバル設定モードへ移行 (conf t)" },
      { command: "exit", description: "1つ上のモードへ戻る" },
      { command: "end", description: "特権EXECモード (#) へ一気に戻る" },
      { command: "?", description: "現在のモードで使えるコマンド一覧を表示" },
    ],
  },
  {
    title: "状態確認コマンド (show)",
    badge: "SHOW",
    items: [
      { command: "show ip interface brief", description: "IFごとのIP・Link状態一覧 (sh ip int br)" },
      { command: "show vlan brief", description: "VLAN一覧と割り当てポート確認 (sh vl br)" },
      { command: "show ip route", description: "ルーティングテーブル確認 (sh ip ro)" },
      { command: "show running-config", description: "現在の設定全文を表示 (sh run)" },
      { command: "show mac address-table", description: "学習済みMACアドレステーブル確認" },
      { command: "show arp", description: "ARP解決済みIPとMAC対応を確認" },
    ],
  },
  {
    title: "IP設定・スタティックルート (Router)",
    badge: "L3",
    items: [
      { command: "interface Gig0/0", description: "物理インターフェース設定へ移動" },
      { command: "ip address 192.168.10.1 255.255.255.0", description: "IPアドレスとサブネットマスクを設定" },
      { command: "no shutdown", description: "ポートを有効化 (Link Up)" },
      { command: "ip route 192.168.20.0 255.255.255.0 10.0.0.2", description: "スタティックルートを追加" },
    ],
  },
  {
    title: "VLAN・Router-on-a-Stick (SW / Router)",
    badge: "VLAN / 802.1Q",
    items: [
      { command: "vlan 10", description: "VLAN 10 を作成してVLAN設定モードへ" },
      { command: "name Sales", description: "VLAN名を Sales に設定" },
      { command: "switchport mode access", description: "ポートをアクセスモードに設定" },
      { command: "switchport access vlan 10", description: "アクセスポートの所属VLANを設定" },
      { command: "switchport mode trunk", description: "ポートを802.1Qトランクに設定" },
      { command: "switchport trunk allowed vlan 10,20", description: "トランクで許可するVLANを指定" },
      { command: "interface Gig0/0.10", description: "サブインターフェースを作成・選択" },
      { command: "encapsulation dot1Q 10", description: "サブIFに802.1Q VLANタグを設定" },
    ],
  },
  {
    title: "設定の削除・初期化 (no 構文)",
    badge: "NO",
    items: [
      { command: "no ip route 192.168.20.0 255.255.255.0 10.0.0.2", description: "指定スタティックルートを削除" },
      { command: "no ip address", description: "IFのIP設定を削除" },
      { command: "no switchport access vlan", description: "アクセスVLANをデフォルト(1)に戻す" },
      { command: "no vlan 10", description: "VLANを削除 (VLAN 1除く)" },
      { command: "no encapsulation dot1Q", description: "802.1Qタグ設定を削除" },
      { command: "no interface Gig0/0.10", description: "サブインターフェースを削除" },
    ],
  },
  {
    title: "エンドホスト操作 (PC / Server)",
    badge: "HOST",
    forEndHost: true,
    items: [
      { command: "ipconfig", description: "IP・サブネット・GW・DNS設定を表示" },
      { command: "set ip 192.168.10.10 255.255.255.0 192.168.10.1", description: "IP・マスク・GWを設定" },
      { command: "set dns 192.168.20.10", description: "DNSサーバIPを変更" },
      { command: "nslookup intranet.local", description: "ホスト名のDNS名前解決を検証" },
      { command: "ping 192.168.20.10", description: "ICMP疎通確認を実行" },
      { command: "traceroute 192.168.20.10", description: "L3ホップ経路を追跡" },
    ],
  },
];

interface CheatSheetDrawerProps {
  open: boolean;
  onClose: () => void;
  onInsertCommand: (command: string) => void;
  deviceType: DeviceType;
}

export function CheatSheetDrawer({
  open,
  onClose,
  onInsertCommand,
  deviceType,
}: CheatSheetDrawerProps) {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const isHost = deviceType === "pc" || deviceType === "server";

  const handleCopy = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(command);
      window.setTimeout(() => setCopiedCommand(null), 1500);
    } catch {
      onInsertCommand(command);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="コマンド逆引きチートシート"
    >
      <button
        type="button"
        aria-label="チートシートを閉じる"
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-xs"
      />

      <div className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-slate-800 bg-[#080d19] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <BookMarked className="h-5 w-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                コマンド逆引きチートシート
              </h3>
              <p className="text-xs text-slate-400">
                「入力」ボタンでそのままCLI入力欄にセットできます
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="terminal-scroll flex-1 space-y-5 overflow-y-auto p-5">
          {CHEAT_SHEET_SECTIONS.map((section) => {
            const highlighted = isHost
              ? Boolean(section.forEndHost)
              : !section.forEndHost;
            return (
              <div
                key={section.title}
                className={cn(
                  "rounded-xl border p-4",
                  highlighted
                    ? "border-slate-700/90 bg-[#0d1322]"
                    : "border-slate-800/70 bg-[#0a0f1c] opacity-80",
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-100">
                    {section.title}
                  </h4>
                  <Badge variant={highlighted ? "cyan" : "slate"}>
                    {section.badge}
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  {section.items.map((item) => (
                    <div
                      key={item.command}
                      className="rounded-lg border border-slate-800/90 bg-[#05080f] p-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <code className="font-mono text-xs text-cyan-300">
                          {item.command}
                        </code>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopy(item.command)}
                            className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-300 hover:border-slate-700"
                          >
                            {copiedCommand === item.command ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-400" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onInsertCommand(item.command);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-200 hover:bg-cyan-500/20"
                          >
                            <CornerDownLeft className="h-3 w-3" />
                            <span>入力</span>
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
