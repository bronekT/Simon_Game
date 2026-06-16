// Shown automatically by Next.js while a route segment loads — gives a clear
// top progress bar on every tab switch so nothing feels frozen.
export default function Loading() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-accent/15">
      <div
        className="h-full w-1/3 rounded-full bg-accent"
        style={{ animation: "barslide 0.9s ease-in-out infinite" }}
      />
    </div>
  );
}
