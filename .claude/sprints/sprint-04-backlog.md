# Sprint 04 — UI Overhaul + Developer Console

**Goal:** Replace CRT/NGE aesthetic with classified intelligence system design. Complete developer console.
**Length:** 2 weeks
**Prerequisite:** Sprint 1 recommended (for security headers that affect CSP). Can parallel Sprint 2/3.

> For exact copy-paste prompts, see `.claude/commands/plan.md` Sprint 4 section.

---

## Hard Constraints

- `docs/index.html` stays a single file — no separate CSS/JS files
- All existing JavaScript functionality must be preserved
- API call logic, debug fetch, export transcript — all must still work
- Fonts: Space Grotesk (headings/labels), JetBrains Mono (data/monospace)
- No external JS framework dependencies — vanilla JS only

---

## Design System Reference

### Color Palette (CSS Variables)
```css
--bg-base:       #0a0c10   /* page background */
--bg-surface:    #0f1318   /* card/panel backgrounds */
--bg-raised:     #161b22   /* elevated elements */
--border:        #21262d   /* default borders */
--border-bright: #30363d   /* focused/active borders */
--text-primary:  #e6edf3   /* primary content */
--text-secondary:#8b949e   /* labels, metadata */
--text-dim:      #484f58   /* placeholders, disabled */
--accent-blue:   #58a6ff   /* primary actions, links */
--accent-amber:  #d29922   /* warnings, caution states */
--accent-red:    #f85149   /* escalation, errors */
--accent-green:  #3fb950   /* approved, success */
```

### Typography
- Headings / Labels: `Space Grotesk`, 400/600 weight
- Data / Code / Monospace: `JetBrains Mono`, 400 weight
- Body: Space Grotesk 14px, line-height 1.6

---

## Stories

### S4-01 — Design System Foundation
**File:** `docs/index.html`

- Import Space Grotesk + JetBrains Mono from Google Fonts
- Replace all CSS variables with new palette (above)
- Apply base reset: `box-sizing: border-box`, body background, font stack
- Remove all CRT effects: scanlines, glow, Orbitron font, green color scheme
- No functional changes

Done when:
- Page loads with new background color and fonts
- No green CRT elements visible
- All interactive elements still function

---

### S4-02 — Header + Navigation
**File:** `docs/index.html`

Rebuild header:
- Left: `MAGI` wordmark (Space Grotesk 600, 18px) + `MULTI-AGENT GOVERNANCE INTELLIGENCE` subtitle (monospace, 9px, letter-spacing 3px, --text-dim)
- Right: status pill `● SYSTEM ONLINE` (--accent-green), query count pill, dev console toggle button
- Classification banner below header: `CLASSIFICATION: RESTRICTED — AI GOVERNANCE MIDDLEWARE` (monospace, amber, 8px)
- Sticky header, 1px bottom border (--border)

Keep all existing JS bindings for dev console toggle, query count display.

---

### S4-03 — Query Input Panel
**File:** `docs/index.html`

Rebuild input section:
- Tester ID field: inline label `ANALYST ID`, placeholder `Optional identifier`, monospace input, 40% width
- Query textarea: label `SUBMIT QUERY`, 5-row min-height, monospace, placeholder `Enter query for deliberation...`
- Mode selector: horizontal pill group — Standard | Emergency | Critical | Advisory
  - Selected state: --accent-blue text, --bg-raised background, bright border
- `INITIATE DELIBERATION` button: full-width, --accent-blue background, Space Grotesk 600, uppercase, letter-spacing 2px
- Keyboard shortcut hint: `CTRL+ENTER` displayed as kbd element
- Character counter for query (show when >1500 chars)

Preserve: Ctrl+Enter binding, mode value sent to API, testerId persistence in localStorage.

---

### S4-04 — Results Panel — Compiled Intelligence Report
**File:** `docs/index.html`

Replace three separate unit panels with a single compiled report:

**Report Header**
- Verdict badge: `APPROVED` / `REJECTED` / `SPLIT` / `DEADLOCK` / `INSUFFICIENT_CONTEXT`
  - Color-coded: green/red/amber/red/amber
- Weighted confidence score (e.g., `73% CONFIDENCE`)
- Duration pill (`2.4s`)
- Classification badge (`FACTUAL` / `PERSONAL` / `CURRENT`)
- Search used indicator (if applicable)

**Section 1: Unit Assessments** (collapsible, default open)
- Three rows: MELCHIOR-1 | BALTHASAR-2 | CASPER-3
- Each row: unit name + role label + verdict badge + confidence % + response text (truncated, expand on click)
- Provider badge: OpenAI | Anthropic | Google

**Section 2: Assumption Exchange** (collapsible)
- Three rows showing Stage 2 assumptions
- UPDATE badge (--accent-amber) if unit changed verdict, HOLD badge (--text-dim) if unchanged
- Show both Stage 1 and Stage 2 verdicts side-by-side when UPDATE

**Section 3: Synthesis**
- Convergence points (bulleted, --accent-green)
- Divergence points (bulleted, --accent-amber)
- Dominant theme label
- Verdict rationale (paragraph, --text-primary)
- Verdict summary (larger text, prominent)

**Section 4: Escalation Brief** (only if `escalate: true`)
- Red left-border panel
- `⚠ ESCALATION REQUIRED` header
- Escalation brief text

**Footer**
- Export Transcript button (preserved)
- Timestamp + deliberation ID from audit log

Done when:
- All 7 stage result fields rendered correctly
- No data from existing API response is lost/hidden
- Collapsible sections work without JS errors

---

### S4-05 — Developer Console (Complete)
**File:** `docs/index.html`

Full dev console panel (fixed right, 480px, 80vh, z-index 9999):

**Toolbar**
- Title: `DEV CONSOLE` (monospace, --text-dim)
- Close button (×)
- Status pills: SEARCH: ON/OFF, TOKENS: total, TIME: duration

**Tabs:** REQUEST | SEARCH | UNITS | TOKENS | EVENTS

- **REQUEST**: raw request body sent to `/api/deliberate`
- **SEARCH**: search queries formed + Tavily results (if searchUsed)
- **UNITS**: raw Stage 1 and Stage 2 responses per unit
- **TOKENS**: grid — per unit: model, prompt tokens, completion tokens, estimated cost
  - Total row at bottom
- **EVENTS**: timeline of Crucible stage completions with timestamps

**Debug Token**: Ctrl+Shift+D → prompt for debug token → stored in sessionStorage (not localStorage)

Keep all existing debug fetch logic (`fetchLastDebugTrace`, `debugRefreshTimer`, etc.) — restyle only.

Done when:
- All 5 tabs render correct data
- Token cost calculation matches backend pricing constants
- Debug token prompt works

---

### S4-06 — Responsive + Accessibility Polish
**File:** `docs/index.html`

Mobile (≤768px):
- Stack layout (single column)
- Dev console: full-screen overlay on mobile, toggle button becomes fixed bottom-right FAB
- Font size adjustments (base 13px on mobile)

Loading state:
- During deliberation: show progress indicator with stage labels
  - `[■■■□□□□] Stage 2: Assumption Exchange...`
  - Update label per stage if backend streams status (if not: cycle through labels on timer)
- Disable submit button during loading

Empty state:
- Before first deliberation: centered placeholder with MAGI logo mark + `Submit a query to initiate deliberation`

Accessibility:
- `aria-label` on all icon buttons
- `role="status"` on verdict badge
- Focus-visible styles on all interactive elements (outline: 2px --accent-blue)
- Keyboard navigation through mode selector

---

## Exit Criteria
- [ ] No CRT/NGE visual elements remain
- [ ] Space Grotesk + JetBrains Mono loaded and applied correctly
- [ ] All 7 Crucible stage results visible in compiled report
- [ ] Developer console shows data in all 5 tabs
- [ ] Export transcript button still works
- [ ] Mobile layout usable at 375px width
- [ ] No JavaScript errors in browser console
- [ ] Ctrl+Enter still initiates deliberation

## CSP Note
After Sprint 1 adds Helmet, verify Google Fonts loads correctly.
May need to add `https://fonts.googleapis.com` and `https://fonts.gstatic.com` to CSP `style-src` and `font-src`.
