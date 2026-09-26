import React, { useState } from "react";
import { cn } from "../utils/cn";

import controllerSvg from "../assets/mascot/character-controller.svg";
import laptopSvg from "../assets/mascot/character-laptop.svg";
import friendlySvg from "../assets/mascot/character-friendly.svg";
import celebrateSvg from "../assets/mascot/character-celebrate.svg";
import thumbsupSvg from "../assets/mascot/character-thumbsup.svg";
import happySvg from "../assets/mascot/character-happy.svg";
import surprisedSvg from "../assets/mascot/character-surprised.svg";
import neutralSvg from "../assets/mascot/character-neutral.svg";
import winkingSvg from "../assets/mascot/character-winking.svg";

export type MascotPose =
  | "controller"
  | "laptop"
  | "friendly"
  | "celebrate"
  | "thumbsup"
  | "happy"
  | "surprised"
  | "neutral"
  | "winking";

export const MASCOT_POSES: Record<
  MascotPose,
  {
    src: string;
    titleDe: string;
    titleEn: string;
    vibeDe: string;
    vibeEn: string;
  }
> = {
  controller: {
    src: controllerSvg,
    titleDe: "Gamer Pose",
    titleEn: "Gamer Pose",
    vibeDe: "Gaming ready mit Retro-Controller",
    vibeEn: "Gaming ready with retro controller",
  },
  laptop: {
    src: laptopSvg,
    titleDe: "Dev / Terminal Pose",
    titleEn: "Dev / Terminal Pose",
    vibeDe: "Prüft Code & Logs am Laptop",
    vibeEn: "Inspecting code & logs on laptop",
  },
  friendly: {
    src: friendlySvg,
    titleDe: "Freundlich",
    titleEn: "Friendly",
    vibeDe: "Begrüßung und Bereitschaft",
    vibeEn: "Welcoming & standing by",
  },
  happy: {
    src: happySvg,
    titleDe: "Glücklich",
    titleEn: "Happy",
    vibeDe: "Alles läuft wie geschmiert",
    vibeEn: "Everything running like butter",
  },
  celebrate: {
    src: celebrateSvg,
    titleDe: "Feiernd",
    titleEn: "Celebrating",
    vibeDe: "Highscore & alle Tests grün!",
    vibeEn: "Highscore & all tests green!",
  },
  thumbsup: {
    src: thumbsupSvg,
    titleDe: "Daumen hoch",
    titleEn: "Thumbs Up",
    vibeDe: "Verifiziert & von Mensch bestätigt",
    vibeEn: "Verified & approved by human",
  },
  winking: {
    src: winkingSvg,
    titleDe: "Zwinkernd",
    titleEn: "Winking",
    vibeDe: "Keine Sorge, Cabinet ist safe",
    vibeEn: "No worries, cabinet is safe",
  },
  surprised: {
    src: surprisedSvg,
    titleDe: "Aufmerksam / Überrascht",
    titleEn: "Attentive / Surprised",
    vibeDe: "Halt! Hier wird ein YES gebraucht!",
    vibeEn: "Hold on! Human YES needed here!",
  },
  neutral: {
    src: neutralSvg,
    titleDe: "Neutral / Bedacht",
    titleEn: "Neutral / Thoughtful",
    vibeDe: "Plan abgelehnt, nichts angerührt",
    vibeEn: "Plan refused, nothing touched",
  },
};

const POSE_KEYS: MascotPose[] = [
  "controller",
  "laptop",
  "friendly",
  "happy",
  "thumbsup",
  "celebrate",
  "winking",
  "surprised",
  "neutral",
];

export interface MascotProps {
  pose?: MascotPose;
  className?: string;
  speech?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "custom";
  interactive?: boolean;
  glow?: boolean;
  float?: boolean;
  alt?: string;
  onPoseChange?: (nextPose: MascotPose) => void;
}

const sizeClasses: Record<NonNullable<MascotProps["size"]>, string> = {
  xs: "w-10 h-10",
  sm: "w-16 h-16",
  md: "w-28 h-28",
  lg: "w-44 h-44 sm:w-52 sm:h-52",
  xl: "w-56 h-56 sm:w-64 sm:h-64",
  custom: "",
};

export function Mascot({
  pose = "controller",
  className,
  speech,
  size = "md",
  interactive = false,
  glow = true,
  float = false,
  alt = "Fried's Retrogaming Mascot",
  onPoseChange,
}: MascotProps) {
  const [currentPose, setCurrentPose] = useState<MascotPose>(pose);

  // Sync if external prop changes
  React.useEffect(() => {
    setCurrentPose(pose);
  }, [pose]);

  const activePose = currentPose;
  const poseData = MASCOT_POSES[activePose] ?? MASCOT_POSES.controller;

  const handleClick = () => {
    if (!interactive) return;
    const nextIndex = (POSE_KEYS.indexOf(activePose) + 1) % POSE_KEYS.length;
    const nextPose = POSE_KEYS[nextIndex];
    setCurrentPose(nextPose);
    onPoseChange?.(nextPose);
  };

  return (
    <div
      className={cn(
        "relative inline-flex flex-col items-center select-none",
        float && "animate-float",
        className,
      )}
    >
      {/* Speech bubble */}
      {speech && (
        <div className="relative mb-2 max-w-[240px] animate-rise rounded-xl border border-primary/40 bg-surface/95 px-3 py-1.5 text-center font-mono text-xs text-text shadow-[0_8px_20px_-4px_rgb(0_230_118/0.3)] backdrop-blur">
          <span>{speech}</span>
          <div className="absolute -bottom-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-r border-b border-primary/40 bg-surface/95" />
        </div>
      )}

      {/* Mascot Image Container */}
      <div
        onClick={handleClick}
        title={
          interactive
            ? `Klick mich für nächsten Pose! (${poseData.titleDe})`
            : poseData.titleDe
        }
        className={cn(
          "relative flex items-center justify-center transition-transform duration-200",
          sizeClasses[size],
          interactive && "cursor-pointer hover:scale-105 active:scale-95",
        )}
      >
        {/* CRT neon glow halo */}
        {glow && (
          <div className="absolute inset-2 -z-10 rounded-full bg-primary/20 blur-xl transition-all duration-300 group-hover:bg-primary/30" />
        )}

        <img
          src={poseData.src}
          alt={alt}
          className="h-full w-full object-contain drop-shadow-[0_12px_28px_rgb(0_230_118/0.25)] transition-all duration-200"
          loading="lazy"
        />

        {interactive && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface border border-primary/60 text-[9px] text-primary shadow">
            ✦
          </span>
        )}
      </div>
    </div>
  );
}
