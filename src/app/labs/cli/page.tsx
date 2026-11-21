import { Suspense } from "react";
import { LabWorkspace } from "@/components/labs/LabWorkspace";
import { CLI_LAB_SCENARIOS } from "@/data/scenarios";

export default function CliLabsPage() {
  return (
    <Suspense fallback={null}>
      <LabWorkspace category="lab" scenarios={CLI_LAB_SCENARIOS} />
    </Suspense>
  );
}
