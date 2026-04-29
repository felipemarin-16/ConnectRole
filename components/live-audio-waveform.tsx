"use client";

import { useAudioWaveform } from "@/hooks/useAudioWaveform";
import { cn } from "@/lib/utils";

type LiveAudioWaveformProps = {
  tone: "coach" | "candidate";
  active: boolean;
  mediaElement?: HTMLMediaElement | null;
  mediaStream?: MediaStream | null;
  activityLevel?: number;
  className?: string;
  barCount?: number;
};

export function LiveAudioWaveform({
  tone,
  active,
  mediaElement,
  mediaStream,
  activityLevel,
  className,
  barCount = 20,
}: LiveAudioWaveformProps) {
  const levels = useAudioWaveform({
    active,
    mediaElement,
    mediaStream,
    activityLevel,
    barCount,
  });

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative isolate flex h-[56px] items-center justify-center overflow-hidden rounded-full border border-white/70 bg-white/70 px-3 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-md",
        className,
      )}
    >
      <div className="flex h-full w-full items-end justify-center gap-[3px] overflow-hidden">
        {levels.map((level, index) => (
          <span
            key={`${tone}-${index}`}
            className={cn(
              "inline-block shrink-0 rounded-full transition-[height,opacity] duration-75 ease-out",
              tone === "coach"
                ? "bg-gradient-to-t from-[#6B4E18] via-[#8B6420] to-[#AE853A]"
                : "bg-gradient-to-t from-[#4AA3D8] via-[#63B7E8] to-[#2D63C3]",
            )}
            style={{
              width: 4,
              height: `${Math.max(8, Math.round(8 + level * 32))}px`,
              opacity: Math.max(0.35, Math.min(1, 0.45 + level * 0.75)),
            }}
          />
        ))}
      </div>
    </div>
  );
}
