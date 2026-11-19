import { CloudVpcWorkspace } from "@/components/labs/CloudVpcWorkspace";
import { CLOUD_VPC_SCENARIOS } from "@/data/scenarios/cloud-vpc-scenarios";

export default function CloudLabsPage() {
  return <CloudVpcWorkspace scenarios={CLOUD_VPC_SCENARIOS} />;
}
