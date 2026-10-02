# Condition-aware project whiteboard

The initial visual layout documented here was superseded by the [connected topology correction](connected-topology.md); its stacked cards did not meet the branching-network acceptance requirement.

Adds no schema, dependencies, provider calls or migrations. Reuses the existing project aggregation engine and review controls. Each reviewed reaction identity is laid out with all participants and an aggregate reaction connection. Nodes are keyed by identity, compound ID and participant occurrence, never by name. This is a bounded reaction hypergraph, not an inferred pathway or a name-based compound merge.

Evidence is partitioned by its own experiment atmosphere, then individually matched against all selected conditions before aggregation. Oxygen/air, explicitly oxygen-free/inert, and unknown are separate groups. Filters never borrow conditions across experiments, stages or papers. Matched refutations remain with support; unknown records retain nodes and source access without inventing a proposal connection. Class selection happens before strength aggregation. Unaccepted scientific reviews may be inspected but cannot acquire support lines.

The visible controls use explicit existing condition fields with these conventions:

| key | dimension | basis | unit | values |
| --- | --- | --- | --- | --- |
| substrate | composition | feed | empty | glucose, cellulose; mixed feed retains both |
| alkali | composition | added_alkali | empty | NaOH, KOH, none |
| solvent | composition | reaction_medium | empty | water, non_aqueous |
| NaOH_concentration | concentration | user-selected solution_volume, solvent_mass, solution_mass or dry_substrate_mass | exact mol/L, mol/kg, wt% or g/L | reported interval |
| temperature | temperature | reaction_medium | degC | reported interval |
| atmosphere | composition | headspace | empty | oxygen, air, inert, oxygen_free |
| added_catalyst | composition | added_catalyst | empty | none or explicit reported catalyst terms |

These are filter conventions, not automatic chemistry classification. Existing records without matching explicit keys/basis/units remain unknown. Names, pH and incomplete alkali/catalyst inventories do not imply these facts. Users can enter the existing structured condition forms without JSON; no existing records are backfilled. Pure-substrate assumptions are not made: selecting glucose means glucose is explicitly included, and a mixed glucose/cellulose experiment can match both selectors while retaining its full feed list.

Numerical matching requires the entire reported interval to fall inside inclusive filter bounds. Open reported endpoints are retained. Missing requested endpoints, unknown/ambiguous states, duplicate keys and incompatible units/bases are unknown. No conversions between concentration forms, pH, temperatures, solution and dry-substrate bases are attempted. Reversed and negative concentration filter ranges are rejected. Absence/only filters require a complete explicit inventory, including the explicit `none` value.

One SVG whiteboard supports pointer dragging and accessible zoom buttons, node search without identity merging, keyboard node/edge selection, and a source panel showing original experiment, all conditions, evidence class/stance, exact stored passage/pages/hash and human review context. On mobile, filters collapse and the panel follows the canvas. The editable case and source-page links retain the existing correction and review workflow. The board does not promise a pinned Drive download.

The local-only fixture deliberately includes same-display-name free glucose and polymer nodes, mixed substrate, distinct oxygen groups, added catalyst, range conditions and a matched refutation. Screenshots are synthetic UI evidence, not scientific claims.

Validation on 2026-10-02: 72 domain tests and 87 app/server tests passed, along with typecheck, lint, production build and 3 HTTP smoke checks. The browser run passed 46/48 checks; two new tests stopped at an overly strict label locator. After correcting the locator, all 8 focused desktop/mobile graph/review checks passed (40 unaffected checks plus 8 focused checks cover all 48 unique browser cases). Desktop and mobile screenshots were opened and visually inspected; mobile has no page-level horizontal overflow and pans within the canvas. No SQL changed, so the previous 201 SQL plus 6 concurrency/pool results were not rerun or represented as new verification.
