import Dashboard from "@/components/dashboard/Dashboard";
import { loadFarmData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { data, demo, error } = await loadFarmData();

  return <Dashboard initialData={data} initialDemo={demo} loadError={error} />;
}
