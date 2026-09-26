import { useEffect, useState } from "react";

export interface TerminalLine {
  text: string;
  kind?: "cmd" | "ok" | "warn" | "err" | "info" | "dim" | "plain";
  delay?: number;
}

/**
 * Types out a script of terminal lines. Command lines are typed
 * character by character; output lines appear whole after `delay` ms.
 */
export function useTypewriter(script: TerminalLine[], active = true, loop = true) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [current, setCurrent] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timers: number[] = [];

    const wait = (ms: number) =>
      new Promise<void>((res) => {
        const t = window.setTimeout(res, ms);
        timers.push(t);
      });

    const run = async () => {
      setLines([]);
      setCurrent("");
      setDone(false);
      for (const line of script) {
        if (cancelled) return;
        if (line.kind === "cmd") {
          await wait(line.delay ?? 400);
          for (let i = 1; i <= line.text.length; i++) {
            if (cancelled) return;
            setCurrent(line.text.slice(0, i));
            await wait(28 + Math.random() * 40);
          }
          await wait(250);
          setLines((l) => [...l, line]);
          setCurrent("");
        } else {
          await wait(line.delay ?? 220);
          setLines((l) => [...l, line]);
        }
      }
      setDone(true);
      if (loop) {
        await wait(6000);
        if (!cancelled) run();
      }
    };

    run();
    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
      timers = [];
    };
  }, [script, active, loop]);

  return { lines, current, done };
}
