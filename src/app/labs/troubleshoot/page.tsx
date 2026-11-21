import { Suspense } from "react";
import { LabWorkspace } from "@/components/labs/LabWorkspace";
import { TROUBLESHOOT_SCENARIOS } from "@/data/scenarios";

export default function TroubleshootLabsPage() {
  return (
    <Suspense fallback={null}>
      <LabWorkspace
        category="troubleshoot"
        scenarios={TROUBLESHOOT_SCENARIOS}
      />
    </Suspense>
  );
}
