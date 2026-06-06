import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { VoiceBar } from "@/components/VoiceBar";
import { ServiceWorker } from "@/components/ServiceWorker";

// Layout for all signed-in screens. Adds the persistent voice bar + bottom nav
// and leaves room at the bottom so content isn't hidden behind them.
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
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-32 pt-[max(env(safe-area-inset-top),1rem)]">
      <ServiceWorker />
      {children}
      <VoiceBar />
      <BottomNav />
    </div>
  );
}
