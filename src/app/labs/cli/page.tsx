import { LabWorkspace } from "@/components/labs/LabWorkspace";
import { CLI_LAB_SCENARIOS } from "@/data/scenarios";

export default function CliLabsPage() {
  return <LabWorkspace category="lab" scenarios={CLI_LAB_SCENARIOS} />;
}
