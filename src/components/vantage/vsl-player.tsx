export const VSL_YOUTUBE_ID = "F6PHSd9JtQs";
export const VSL_WATCH_URL = "https://vantage-financial.net/watch";

export function VslPlayer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`w-full overflow-hidden rounded-[8px] border border-vantage-gold/30 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)] ${className}`}
    >
      <iframe
        className="aspect-video w-full"
        src={`https://www.youtube-nocookie.com/embed/${VSL_YOUTUBE_ID}?rel=0`}
        title="Vantage Financial opportunity overview"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}
