export const GAPS = [
  { gap: 0, pct: 50 },
  { gap: 50, pct: 57 },
  { gap: 100, pct: 64 },
  { gap: 200, pct: 76 },
  { gap: 400, pct: 91 },
];

export const MARGINS = [
  { label: "Deuce / 11–9", hint: "Closest games (floor)", mult: "0.82" },
  { label: "11–6", hint: "Typical match", mult: "1.00" },
  { label: "11–5", hint: "A bit wide", mult: "1.06" },
  { label: "11–3 or worse", hint: "Blowout (cap)", mult: "1.18" },
];

export const K_TIERS = [
  {
    label: "Games 1–10",
    hint: "Wins + losses, singles and doubles combined",
    k: "64",
  },
  {
    label: "Game 11 onward",
    hint: "Established. Same K as everyone else",
    k: "32",
  },
];

export const TEAM_EXAMPLES = [
  { pair: "1100 & 1100", elo: "1100", hint: "Even pair stays even" },
  { pair: "800 & 1400", elo: "1010", hint: "65% weaker + 35% stronger" },
];

export const STEPS = [
  {
    n: "01",
    title: "Everyone starts at 1000",
    body: "One rating per person. Singles and doubles both feed the same number. Your first 10 games use K = 64 so you move fast; after that K = 32.",
  },
  {
    n: "02",
    title: "Figure out who was favored",
    body: "Singles compares the two ratings. Doubles weights the weaker partner 65% and the stronger 35%, because the weaker player sets more of the team’s floor.",
  },
  {
    n: "03",
    title: "Turn the gap into a win chance",
    body: "Classic Elo curve. Every 400 points is about a 10× favorite. A 100-point edge is roughly 64%, not a lock.",
  },
  {
    n: "04",
    title: "Decide how far the rating moves",
    body: "K × score-margin × autocorrelation × surprise. 11–6 is a normal game (×1.00). Expected blowouts are shrunk; upsets are boosted. Partners get the same match, but each uses their own K.",
  },
];
