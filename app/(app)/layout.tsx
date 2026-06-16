import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorker } from "@/components/ServiceWorker";
import { PullToRefresh } from "@/components/PullToRefresh";

// Layout for all signed-in screens. Adds the persistent bottom nav and leaves
// room at the bottom so content isn't hidden behind it.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards, but double-check here too.
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-24 pt-[max(env(safe-area-inset-top),1rem)]">
      <ServiceWorker />
      <PullToRefresh />
      {children}
      <BottomNav />
    </div>
  );
}
