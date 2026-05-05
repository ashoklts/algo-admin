import { useParams } from "react-router";
import AnalyseView from "../../components/common/AnalyseView";

export default function SLSimulatorPage() {
  const { entityType, entityId } = useParams<{ entityType: string; entityId: string }>();
  return <AnalyseView entityType={entityType!} entityId={entityId!} />;
}
