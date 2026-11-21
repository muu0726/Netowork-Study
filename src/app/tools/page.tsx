import { Suspense } from "react";
import { ToolsWorkspace } from "@/components/tools/ToolsWorkspace";

export default function ToolsPage() {
  return (
    <Suspense fallback={null}>
      <ToolsWorkspace />
    </Suspense>
  );
}
