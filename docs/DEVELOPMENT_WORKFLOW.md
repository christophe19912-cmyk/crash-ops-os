# Crash Ops OS — Development Workflow

## Feature Workflow

Every feature or fix should follow these seven steps:

### 1. Define the operational problem

State what collision-repair operational question you are answering. Examples:

- "Managers cannot see which shop is in True Overload"
- "C/HLD repairs inflate WIP hour totals on WIP Intelligence"
- "A new stage code appeared in the Nexsyis export"

### 2. Identify the owning engine or service

Before writing code, determine which module owns the logic:

| Problem type | Owner |
|--------------|-------|
| Stage meaning or classification | `src/services/stageDictionary.ts` |
| Import parsing or normalization | `src/services/importedData.ts` |
| Repair/shop health or priority | `src/engine/operationsEngine.ts` |
| Capacity status or thresholds | `src/engine/capacityEngine.ts` |
| Drop planning or severity mix | `src/engine/capacityPlanningEngine.ts` |
| Daily operational actions | `src/services/recommendationEngine.ts` |
| Store settings persistence | `src/services/capacitySettings.ts` |
| Display or user interaction | Page component in `src/*.tsx` |

If no existing module owns the logic, propose a new engine or service — not a component-local function.

### 3. Plan the smallest focused change

- List the specific files to modify
- Avoid touching unrelated modules
- Prefer extending an existing engine over creating parallel logic
- Do not rewrite large files unless the change requires it

### 4. Modify only necessary files

- React components: display and input changes only
- Engines/services: business logic changes
- Models: type changes when the data shape changes
- Do not change styles, dependencies, or unrelated components

### 5. Run the build

```bash
npm run build
```

This runs TypeScript compilation (`tsc -b`) followed by the Vite production build. Fix all errors before proceeding.

Optional during development:

```bash
npm run dev      # local dev server with HMR
npm run lint     # ESLint check
```

### 6. Summarize changed files and behavior

After the build succeeds, report:

- Which files changed and why
- What behavior changed from the user's perspective
- Any assumptions made (especially stage mappings or import column names)
- Any conflicts with documented business rules

### 7. Commit after validation

Commit only when:

1. `npm run build` succeeds with zero errors
2. The user has visually validated the change in the browser

Do not commit on behalf of the user unless explicitly requested.

## Where to Put New Code

```
Is it a data type?
  └── src/models/

Is it a business calculation (no React)?
  ├── Health, risk, priority     → src/engine/operationsEngine.ts
  ├── Capacity evaluation        → src/engine/capacityEngine.ts
  ├── Drop/severity planning     → src/engine/capacityPlanningEngine.ts
  └── New engine domain          → src/engine/ (new file, no React imports)

Is it data access, normalization, or configuration?
  ├── Import / localStorage      → src/services/importedData.ts
  ├── Stage definitions          → src/services/stageDictionary.ts
  ├── Recommendations            → src/services/recommendationEngine.ts
  ├── Capacity settings          → src/services/capacitySettings.ts
  └── New service domain         → src/services/ (new file)

Is it UI?
  ├── New page                   → src/NewPage.tsx + route in App.tsx
  ├── Shared panel/widget        → src/SharedPanel.tsx
  └── Existing page change       → modify the page component only for display
```

## Adding a New Stage

1. Add the stage definition to `src/services/stageDictionary.ts`
2. Set `countsAsActiveProduction`, `countsAsCompleted`, blocker, defaultOwner, and defaultAction
3. If the stage appears on the Production Board, update column mapping in `ProductionBoard.tsx` (until board columns are derived from the dictionary)
4. Run `npm run build`
5. Report the mapping decision — flag if the stage meaning is uncertain

## Adding a New Shop

1. Add the shop name to `SHOP_OPTIONS` in `src/services/capacitySettings.ts`
2. Add the same name to `shopOptions` in `src/ImportCenter.tsx` (known duplication — keep in sync)
3. Default capacity settings are created automatically via `createDefaultCapacitySettings()`
4. Run `npm run build`

## Adding a New Page

1. Create the component in `src/`
2. Add the page name to the `Page` type and `navigationItems` in `App.tsx`
3. Add a render branch in `renderPage()`
4. Consume engines/services — do not embed business logic
5. Run `npm run build`

## Agent Checklist

When an AI agent works on Crash Ops OS:

- [ ] Read `docs/ARCHITECTURE.md` and `docs/BUSINESS_RULES.md` before significant edits
- [ ] Explain the plan (problem, owner, files) before editing
- [ ] Do not duplicate business logic in components
- [ ] Do not silently change collision-repair definitions (C/HLD, BOP, PO, capacity statuses)
- [ ] Run `npm run build` after changes
- [ ] Report assumptions and uncertain mappings
- [ ] Summarize changed files and behavior
- [ ] Do not commit unless the user requests it
- [ ] Do not change application behavior, styles, or dependencies unless that is the stated task

## Code Quality Standards

- TypeScript must compile with zero errors
- Avoid unused imports and unused declarations (`noUnusedLocals`, `noUnusedParameters` are enabled)
- Prefer focused modules under roughly 300 lines when practical
- Preserve existing working behavior while refactoring
- New engines must not import React
- Explainable rules are preferred over opaque scoring
