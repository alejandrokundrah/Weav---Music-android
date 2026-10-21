import { cn } from "@/lib/utils";
import { APP_SKINS, setAppSkin, useAppSkin, type AppSkinId } from "../settings/appSkin";

/**
 * Choice of desktop skin, each shown as a small drawing of itself.
 *
 * The previews hard-code their own colours instead of using the theme tokens on purpose: the
 * tokens follow whichever skin is active, so a token-coloured Glass card would turn black the
 * moment Noir was selected — and you could no longer tell what you were switching back to.
 */
export function AppSkinPicker({ labelledBy }: { labelledBy: string }) {
  const selected = useAppSkin();

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]"
    >
      {APP_SKINS.map((skin) => {
        const isSelected = skin.id === selected;

        return (
          <div
            key={skin.id}
            className={cn(
              "relative flex flex-col gap-3 rounded-2xl p-3 transition-colors",
              isSelected ? "bg-primary/15" : "hover:bg-muted",
            )}
          >
            <div
              className="pointer-events-none overflow-hidden rounded-xl ring-1 ring-inset ring-white/10"
              aria-hidden="true"
            >
              <SkinPreview id={skin.id} />
            </div>

            <span className="flex flex-col gap-0.5">
              <strong className="text-sm font-medium text-foreground">{skin.name}</strong>
              <span className="text-xs text-muted-foreground">{skin.description}</span>
            </span>

            {/* A sibling overlay rather than a wrapping button, as the mini player skins do. */}
            <button
              type="button"
              aria-pressed={isSelected}
              aria-label={`${skin.name} skin`}
              onClick={() => setAppSkin(skin.id)}
              className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        );
      })}
    </div>
  );
}

function SkinPreview({ id }: { id: AppSkinId }) {
  return id === "noir" ? <NoirPreview /> : <GlassPreview />;
}

/** A frosted pane over the dusk-valley scene, with the lime accent. */
function GlassPreview() {
  return (
    <div
      className="relative aspect-[16/10] w-full"
      style={{ background: "linear-gradient(180deg,#6c7860 0%,#454c3f 48%,#2a2d26 100%)" }}
    >
      {/* The lime hill the real scene has along its foot. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[34%]"
        style={{ background: "linear-gradient(180deg,#92D906 0%,#46474C 100%)", opacity: 0.55 }}
      />
      <div className="absolute inset-[7%] flex flex-col gap-[5%] rounded-[10px] bg-white/[0.14] p-[4%] ring-1 ring-inset ring-white/25">
        <div className="flex min-h-0 flex-1 gap-[4%]">
          <div className="flex w-[22%] flex-col gap-[7%]">
            {[0, 1, 2, 3].map((tile) => (
              <div key={tile} className="aspect-square w-full rounded-[3px] bg-white/25" />
            ))}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[6%]">
            <div className="h-[9%] w-1/2 rounded-full bg-white/80" />
            <div className="grid min-h-0 flex-1 grid-cols-3 gap-[5%]">
              {[0, 1, 2].map((card) => (
                <div key={card} className="rounded-md bg-white/20" />
              ))}
            </div>
          </div>
        </div>
        <div className="flex h-[17%] items-center gap-[4%] rounded-full bg-black/30 px-[4%]">
          <div className="size-[34%] rounded-full bg-white/70 [aspect-ratio:1]" />
          <div className="h-[18%] flex-1 rounded-full bg-white/25">
            <div className="h-full w-2/5 rounded-full bg-[#92D906]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Black canvas, a hairline top bar, plain text lists, an arched hero and one red accent. */
function NoirPreview() {
  return (
    <div className="relative flex aspect-[16/10] w-full flex-col bg-black">
      {/* Top bar */}
      <div className="flex h-[12%] items-center gap-[4%] border-b border-white/10 px-[5%]">
        <div className="h-[28%] w-[9%] rounded-full bg-white/80" />
        <div className="h-[28%] w-[5%] rounded-full bg-white/35" />
        <div className="h-[28%] w-[16%] rounded-full bg-white/55" />
        <div className="ml-auto size-[34%] rounded-full bg-white/30 [aspect-ratio:1]" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Text-only rail with a single red marker */}
        <div className="flex w-[24%] flex-col gap-[7%] px-[5%] pt-[6%]">
          <div className="h-[6%] w-[70%] rounded-full bg-white/80" />
          <div className="relative flex flex-col gap-[16%]">
            <span className="absolute -left-[7%] top-[2%] size-[5%] rounded-full bg-[#e3121b] [aspect-ratio:1]" />
            <div className="h-[6%] w-[80%] rounded-full bg-white/75" />
            <div className="h-[6%] w-[60%] rounded-full bg-white/30" />
            <div className="h-[6%] w-[72%] rounded-full bg-white/30" />
          </div>
          <div className="mt-[4%] h-[6%] w-[50%] rounded-full bg-white/80" />
          <div className="flex flex-col gap-[16%]">
            <div className="h-[6%] w-[66%] rounded-full bg-white/30" />
            <div className="h-[6%] w-[78%] rounded-full bg-white/30" />
          </div>
        </div>

        {/* Hero: title and a red play button beside an arch of red light */}
        <div className="flex min-w-0 flex-1 flex-col px-[3%] pt-[5%]">
          <div className="flex items-end justify-between gap-[6%]">
            <div className="flex flex-1 flex-col gap-[9%] pb-[3%]">
              <div className="h-[5%] w-[28%] rounded-full bg-white/45" />
              <div className="h-[14%] w-[78%] rounded-full bg-white" />
              <div className="h-[5%] w-[60%] rounded-full bg-white/30" />
              <div className="size-[26%] rounded-full bg-[#e3121b] [aspect-ratio:1]" />
            </div>
            <div
              className="h-[88%] w-[34%] rounded-t-full"
              style={{
                background: "radial-gradient(120% 90% at 50% 18%,#e3121b 0%,#a30d14 42%,#7a0a10 100%)",
                maskImage: "linear-gradient(to bottom,#000 62%,transparent)",
                WebkitMaskImage: "linear-gradient(to bottom,#000 62%,transparent)",
              }}
            />
          </div>
          <div className="mt-[2%] flex flex-col gap-[6%] border-t border-white/10 pt-[4%]">
            <div className="h-[4%] w-full rounded-full bg-white/15" />
            <div className="h-[4%] w-full rounded-full bg-white/15" />
          </div>
        </div>
      </div>

      {/* Docked player */}
      <div className="flex h-[13%] items-center justify-center gap-[3%] border-t border-white/10 bg-[#0a0a0a]">
        <div className="size-[34%] rounded-full bg-white [aspect-ratio:1]" />
        <div className="h-[8%] w-[40%] rounded-full bg-white/20">
          <div className="h-full w-1/3 rounded-full bg-white/80" />
        </div>
      </div>
    </div>
  );
}
