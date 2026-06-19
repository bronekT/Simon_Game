// Shown automatically by Next.js while a route segment loads — a glowing gold
// progress sliver at the very top so every tab switch feels alive.
export default function Loading() {
  return (
    <div className="fixed inset-x-0 top-0 z-[80] h-[3px] overflow-hidden">
      <div
        className="h-full w-2/5 rounded-full bg-accent-grad"
        style={{ animation: "barslide 1s ease-in-out infinite", boxShadow: "0 0 12px 1px rgba(233,162,59,0.7)" }}
      />
    </div>
  );
}
