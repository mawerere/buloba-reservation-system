"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Command, Terminal } from "lucide-react";
import { HOTEL } from "@/lib/crs";

export type ConsoleLine = {
  id: number;
  text: string;
  tone: "ok" | "err" | "info" | "cmd";
};

export default function CommandConsole({
  lines,
  onCommand,
  role,
  staffId,
}: {
  lines: ConsoleLine[];
  onCommand: (command: string) => void | Promise<void>;
  role: string;
  staffId: string;
}) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [lines]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    setHistory((current) => [...current.slice(-30), value]);
    setHistoryIndex(-1);
    setInput("");
    void onCommand(value);
  };

  return (
    <section className="crs-terminal" id="command-console">
      <header className="crs-terminal-head">
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}><Terminal size={13} /> CRS command line · {HOTEL.name}</span>
        <span>{role} / {staffId} · session online</span>
      </header>
      <div className="crs-terminal-output" ref={outputRef} aria-live="polite">
        {lines.map((line) => (
          <div key={line.id} className={`crs-terminal-line ${line.tone}`}>{line.text}</div>
        ))}
      </div>
      <form className="crs-terminal-input-row" onSubmit={submit}>
        <span className="crs-terminal-prompt">crs@buloba:~$</span>
        <input
          className="crs-terminal-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" && history.length) {
              event.preventDefault();
              const next = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
              setHistoryIndex(next);
              setInput(history[next]);
            }
            if (event.key === "ArrowDown" && historyIndex >= 0) {
              event.preventDefault();
              const next = historyIndex + 1;
              if (next >= history.length) {
                setHistoryIndex(-1);
                setInput("");
              } else {
                setHistoryIndex(next);
                setInput(history[next]);
              }
            }
          }}
          placeholder="Type HELP for commands · e.g. AVAIL 2026-06-01 2026-06-04, FOLIO 112, REPORT DAILY CASHIER"
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" className="crs-btn gold small" aria-label="Run command"><Command size={13} /> RUN</button>
      </form>
    </section>
  );
}
