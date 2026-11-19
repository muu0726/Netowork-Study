import { LabWorkspace } from "@/components/labs/LabWorkspace";
import { TROUBLESHOOT_SCENARIOS } from "@/data/scenarios";

export default function TroubleshootLabsPage() {
  return (
    <LabWorkspace
      category="troubleshoot"
      scenarios={TROUBLESHOOT_SCENARIOS}
    />
  );
}
