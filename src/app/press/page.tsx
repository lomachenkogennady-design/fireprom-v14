import { StationShell } from "@/components/StationShell";
import { STATIONS } from "@/lib/stations";

export default function Page() {
  return <StationShell spec={STATIONS.press} />;
}
