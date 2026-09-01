"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import type { Player } from "@/lib/types";
import { displayName } from "@/lib/format";

interface PlayerPickerProps {
  label: string;
  players: Player[];
  value: string | null;
  onChange: (id: string | null) => void;
  excludeIds?: string[];
  /** Show an "Anyone" / clear row at the top of the list. */
  allowClear?: boolean;
  clearLabel?: string;
  placeholder?: string;
}

type PickerInnerProps = PlayerPickerProps & {
  excludeIds: string[];
  allowClear: boolean;
  clearLabel: string;
  placeholder: string;
};

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [breakpoint]);

  return isMobile;
}

function filterPlayers(
  players: Player[],
  query: string,
  excludeIds: string[],
  value: string | null
) {
  const q = query.trim().toLowerCase();
  return players
    .filter((p) => !excludeIds.includes(p.id) || p.id === value)
    .filter((p) => {
      if (!q) return true;
      return (
        p.nickname.toLowerCase().includes(q) ||
        p.realName.toLowerCase().includes(q) ||
        displayName(p).toLowerCase().includes(q)
      );
    });
}

function useScrollSafePick(onPick: () => void) {
  const tracking = useRef<{ x: number; y: number; id: number } | null>(null);
  const scrolled = useRef(false);
  const THRESHOLD = 10;

  return {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      tracking.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      scrolled.current = false;
    },
    onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
      if (!tracking.current || tracking.current.id !== e.pointerId) return;
      const dx = e.clientX - tracking.current.x;
      const dy = e.clientY - tracking.current.y;
      if (Math.abs(dx) > THRESHOLD || Math.abs(dy) > THRESHOLD) {
        scrolled.current = true;
      }
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      if (!tracking.current || tracking.current.id !== e.pointerId) return;
      if (!scrolled.current) {
        e.preventDefault();
        onPick();
      }
      tracking.current = null;
    },
    onPointerCancel: () => {
      tracking.current = null;
      scrolled.current = false;
    },
  };
}

function PlayerOptionButton({
  player,
  active,
  selected,
  onPick,
  pickMode = "instant",
}: {
  player: Player;
  active?: boolean;
  selected?: boolean;
  onPick: () => void;
  /** instant = desktop pointerdown; tap = mobile scroll-safe */
  pickMode?: "instant" | "tap";
}) {
  const tap = useScrollSafePick(onPick);

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected ?? false}
      className={`picker-option ${active ? "is-active" : ""} ${selected ? "is-selected" : ""}`}
      {...(pickMode === "tap"
        ? tap
        : {
            onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
              e.preventDefault();
              onPick();
            },
          })}
    >
      <span className="picker-option-name">{displayName(player)}</span>
      <span className="picker-option-meta">{player.elo} ELO</span>
    </button>
  );
}

function ClearOptionButton({
  label,
  active,
  selected,
  onPick,
  pickMode = "instant",
}: {
  label: string;
  active?: boolean;
  selected?: boolean;
  onPick: () => void;
  pickMode?: "instant" | "tap";
}) {
  const tap = useScrollSafePick(onPick);

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected ?? false}
      className={`picker-option ${active ? "is-active" : ""} ${selected ? "is-selected" : ""}`}
      {...(pickMode === "tap"
        ? tap
        : {
            onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
              e.preventDefault();
              onPick();
            },
          })}
    >
      <span className="picker-option-name">{label}</span>
      <span className="picker-option-meta">Clear filter</span>
    </button>
  );
}

function DesktopCombobox({
  label,
  players,
  value,
  onChange,
  excludeIds,
  allowClear,
  clearLabel,
  placeholder,
}: PickerInnerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = players.find((p) => p.id === value) ?? null;

  const options = useMemo(
    () => filterPlayers(players, query, excludeIds, value),
    [players, query, excludeIds, value]
  );

  const showClear =
    allowClear &&
    (!query.trim() || clearLabel.toLowerCase().includes(query.trim().toLowerCase()));

  /** Index 0 may be the clear row when allowClear is visible. */
  const rowCount = options.length + (showClear ? 1 : 0);

  useEffect(() => {
    if (selected && !open) setQuery(displayName(selected));
    if (!selected && !open) setQuery("");
  }, [selected, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pickPlayer = useCallback(
    (player: Player) => {
      onChange(player.id);
      setQuery(displayName(player));
      setOpen(false);
    },
    [onChange]
  );

  const pickClear = useCallback(() => {
    onChange(null);
    setQuery("");
    setOpen(false);
  }, [onChange]);

  function activateRow(index: number) {
    if (showClear && index === 0) {
      pickClear();
      return;
    }
    const playerIndex = showClear ? index - 1 : index;
    if (options[playerIndex]) pickPlayer(options[playerIndex]);
  }

  return (
    <div className="space-y-1.5" ref={rootRef}>
      <label className="label !mb-0" htmlFor={listId + "-input"}>
        {label}
      </label>
      <div className="picker-combo">
        <input
          id={listId + "-input"}
          className="field"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listId}
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onFocus={() => {
            setOpen(true);
            setActiveIndex(0);
            if (selected) setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(0);
            if (value) onChange(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((i) => Math.min(i + 1, Math.max(rowCount - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              if (open && rowCount > 0) {
                e.preventDefault();
                activateRow(activeIndex);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
              if (selected) setQuery(displayName(selected));
            }
          }}
        />
        {open && (
          <div className="picker-panel" role="listbox" id={listId}>
            {showClear && (
              <ClearOptionButton
                label={clearLabel}
                active={activeIndex === 0}
                selected={value === null}
                onPick={pickClear}
              />
            )}
            {options.length === 0 && !showClear ? (
              <p className="picker-empty">No players match</p>
            ) : (
              options.map((p, i) => {
                const rowIndex = showClear ? i + 1 : i;
                return (
                  <PlayerOptionButton
                    key={p.id}
                    player={p}
                    active={rowIndex === activeIndex}
                    selected={p.id === value}
                    onPick={() => pickPlayer(p)}
                  />
                );
              })
            )}
            {options.length === 0 && showClear && query.trim() && (
              <p className="picker-empty">No players match</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Ignore reopen clicks that fire on the trigger after the sheet unmounts. */
const SHEET_REOPEN_GUARD_MS = 450;

function MobileSheetPicker({
  label,
  players,
  value,
  onChange,
  excludeIds,
  allowClear,
  clearLabel,
  placeholder,
}: PickerInnerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const suppressOpenUntil = useRef(0);
  const selected = players.find((p) => p.id === value) ?? null;

  const options = useMemo(
    () => filterPlayers(players, query, excludeIds, value),
    [players, query, excludeIds, value]
  );

  const showClear =
    allowClear &&
    (!query.trim() || clearLabel.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => searchRef.current?.focus(), 250);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open]);

  function openSheet() {
    if (Date.now() < suppressOpenUntil.current) return;
    setQuery("");
    setOpen(true);
  }

  function closeSheet() {
    // Sheet closes on pointerdown; the matching click can hit the trigger
    // underneath and reopen it. Block opens briefly after every close.
    suppressOpenUntil.current = Date.now() + SHEET_REOPEN_GUARD_MS;
    setOpen(false);
    setQuery("");
  }

  function pick(player: Player) {
    onChange(player.id);
    closeSheet();
  }

  function clear() {
    onChange(null);
    closeSheet();
  }

  const sheet =
    mounted &&
    open &&
    createPortal(
      <div className="picker-sheet-root" role="presentation">
        <button
          type="button"
          className="picker-sheet-backdrop"
          aria-label="Close"
          onPointerDown={(e) => {
            e.preventDefault();
            closeSheet();
          }}
        />
        <div
          className="picker-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <div className="picker-sheet-handle" aria-hidden />
          <div className="picker-sheet-head">
            <h3 className="picker-sheet-title">{label}</h3>
            <input
              ref={searchRef}
              className="field"
              type="search"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="picker-sheet-list" role="listbox">
            {showClear && (
              <ClearOptionButton
                label={clearLabel}
                selected={value === null}
                onPick={clear}
                pickMode="tap"
              />
            )}
            {options.length === 0 ? (
              <p className="picker-empty">No players match</p>
            ) : (
              options.map((p) => (
                <PlayerOptionButton
                  key={p.id}
                  player={p}
                  selected={p.id === value}
                  onPick={() => pick(p)}
                  pickMode="tap"
                />
              ))
            )}
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <div className="space-y-1.5">
      <span className="label !mb-0">{label}</span>
      <button
        type="button"
        className="picker-trigger field"
        onClick={openSheet}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className={selected ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
          {selected ? displayName(selected) : clearLabel}
        </span>
        <span className="picker-chev" aria-hidden>
          ▼
        </span>
      </button>
      {sheet}
    </div>
  );
}

export function PlayerPicker({
  label,
  players,
  value,
  onChange,
  excludeIds = [],
  allowClear = false,
  clearLabel = "Anyone",
  placeholder = "Type a nickname or name...",
}: PlayerPickerProps) {
  const isMobile = useIsMobile(768);
  const inner = {
    label,
    players,
    value,
    onChange,
    excludeIds,
    allowClear,
    clearLabel,
    placeholder,
  };

  if (isMobile) return <MobileSheetPicker {...inner} />;
  return <DesktopCombobox {...inner} />;
}
