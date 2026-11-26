import { Suspense } from "react";
import { SandboxWorkspace } from "@/components/labs/SandboxWorkspace";

export default function SandboxLabsPage() {
  return (
    <Suspense fallback={null}>
      <SandboxWorkspace />
    </Suspense>
  );
}
