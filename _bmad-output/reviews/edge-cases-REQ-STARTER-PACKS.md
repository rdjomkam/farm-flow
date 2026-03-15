# Edge Case Analysis: REQ-STARTER-PACKS.md

**Date:** 2026-03-15
**Reviewer:** BMad Master (Edge Case Hunter Task)
**Document:** docs/requirements/REQ-STARTER-PACKS.md v1.1

---

## 1. Pack Definition & Structure (7 cases)

- **EC-1.1** `nombreAlevins` has no min constraint. 0 alevins causes division-by-zero in survie/FCR/SGR
- **EC-1.2** Pack Custom has no upper/lower bounds on quantities
- **EC-1.3** PackProduit `quantite` allows 0/negative values
- **EC-1.4** Pack with zero PackProduit rows triggers all STOCK_BAS rules immediately
- **EC-1.5** Deactivating Pack while activations exist — behavior undefined
- **EC-1.6** Deleting Produit referenced by PackProduit — no onDelete specified
- **EC-1.7** prixTotal allows negative/zero, currency unspecified

## 2. Pack Activation / Onboarding (10 cases)

- **EC-2.1** Double activation of same Pack for same user — no prevention
- **EC-2.2** User already has a Site with active Vague — conflicts unhandled
- **EC-2.3** Partial failure during 6-entity provisioning — no rollback spec
- **EC-2.4** Bac volume unknown at activation — default breaks density calc
- **EC-2.5** Code "ACT-YYYY-NNN" caps at 999/year — no overflow handling
- **EC-2.6** User with no email AND no phone — no credential delivery channel
- **EC-2.7** clientSiteId @unique prevents second pack on same site
- **EC-2.8** vagueId @unique prevents vague replacement on failed cycle
- **EC-2.9** dateExpiration reached — no logic for access revocation
- **EC-2.10** SUSPENDUE status — no trigger, UI, or behavior spec

## 3. Activity Engine / Rules (13 cases)

- **EC-3.1** CRON double-run generates duplicate RECURRENT activities
- **EC-3.2** SEUIL_POIDS fires repeatedly after threshold crossed (no once-only flag)
- **EC-3.3** Multiple conflicting rules match simultaneously — no priority resolution
- **EC-3.4** Mortality rate % base undefined (initial count vs current living)
- **EC-3.5** phaseMin > phaseMax (reversed) — no validation
- **EC-3.6** Placeholder resolution undefined — no fallback for unresolvable values
- **EC-3.7** RECURRENT interval start reference point undefined
- **EC-3.8** CALENDRIER rules don't account for vague pauses
- **EC-3.9** Activities generated for vague with 0 living fish
- **EC-3.10** Missing TypeActivite values (TRI, MEDICATION)
- **EC-3.11** Concurrent releve submissions trigger duplicate threshold activities
- **EC-3.12** Rules with null conditions — match always or never?
- **EC-3.13** STOCK_BAS checks categorieProduit not specific product — ambiguous

## 4. Feeding Calculations (5 cases)

- **EC-4.1** "Nombre de vivants" not tracked — must derive from releves + ventes
- **EC-4.2** Poids moyen staleness — no interpolation/projection for stale data
- **EC-4.3** Feeding rate is range, not value — selection logic unclear
- **EC-4.4** Phase boundary (exactly 15g) belongs to two phases
- **EC-4.5** Multiple bacs with different fish sizes after tri — no per-bac feeding

## 5. ConfigElevage (8 cases)

- **EC-5.1** No ConfigElevage for site — refactored code fails with no fallback
- **EC-5.2** Multiple isDefault=true per site — no unique constraint
- **EC-5.3** JSON fields with no schema validation — gaps/overlaps in weight ranges
- **EC-5.4** Config modified during active vague — phase jumps unexpectedly
- **EC-5.5** Deletion of ConfigElevage linked to Pack — no onDelete
- **EC-5.6** Benchmark inversions (excellent > acceptable) — no validation
- **EC-5.7** Phase seuils not monotonically increasing — breaks detection
- **EC-5.8** "Copie ou liee" ambiguity — fundamentally different behaviors

## 6. AI Advisor (7 cases)

- **EC-6.1** Claude API unavailable — fallback UX undefined
- **EC-6.2** Rate limit reset timing undefined (UTC? local? rolling?)
- **EC-6.3** AI returns harmful advice — no content safety filtering
- **EC-6.4** ConseilIA missing @relation for siteId and userId
- **EC-6.5** AI context data freshness unspecified
- **EC-6.6** Large context payloads for long-running vagues
- **EC-6.7** activiteId on ConseilIA — no cascade on Activite deletion

## 7. Engineer Monitoring (6 cases)

- **EC-7.1** NoteIngenieur has no recipient — multi-member site visibility unclear
- **EC-7.2** NoteIngenieur missing siteId @relation — breaks R8
- **EC-7.3** Engineer as ADMIN has write access — should be read-only
- **EC-7.4** "3 days inactive" alert fires on weekends/holidays
- **EC-7.5** Dashboard loads all clients — no pagination
- **EC-7.6** Engineer AI calls exhaust client's rate limit

## 8. Concurrency & Race Conditions (4 cases)

- **EC-9.1** Two admins activating same pack for same user simultaneously
- **EC-9.2** CRON and event-driven evaluating same rules concurrently
- **EC-9.3** Stock decrement race condition on concurrent activity completion
- **EC-9.4** ConfigElevage update during rule evaluation — inconsistent thresholds

## 9. Data Lifecycle (4 cases)

- **EC-10.1** No archiving for completed activations (~480/client/cycle)
- **EC-10.2** ConseilIA records accumulate indefinitely (365K/year at scale)
- **EC-10.3** RegleActivite deletion — orphaned regleId references
- **EC-10.4** No lifecycle transition from ACTIVE PackActivation when vague completes

## 10. Timezone & Locale (3 cases)

- **EC-11.1** "Jour" definition ambiguous for day boundary
- **EC-11.2** Cameroon WAT (UTC+1) not specified for CRON/limits
- **EC-11.3** Number formatting (1,594g vs 1.594g) locale-dependent

## 11. Security & Authorization (4 cases)

- **EC-12.1** No new Permission values for Phase 3 features
- **EC-12.2** Client (PISCICULTEUR) can modify ConfigElevage — should be restricted
- **EC-12.3** AI "anonymization" undefined — vague codes may identify clients
- **EC-12.4** Engineer notes have no visibility flag (public vs internal)

## 12. Missing Specifications (5 cases)

- **EC-14.1** No offline/PWA spec — critical for Cameroon connectivity
- **EC-14.2** No SMS/WhatsApp integration design
- **EC-14.3** No backup/restore for client sites
- **EC-14.4** No unit conversion between stock (KG/SACS) and feeding (grams)
- **EC-14.5** No spec for vague ANNULEE/TERMINEE impact on PackActivation

---

## Summary: 76 unhandled edge cases

| Category | Count |
|----------|-------|
| Pack Definition | 7 |
| Activation/Onboarding | 10 |
| Activity Engine | 13 |
| Feeding Calculations | 5 |
| ConfigElevage | 8 |
| AI Advisor | 7 |
| Engineer Monitoring | 6 |
| Concurrency | 4 |
| Data Lifecycle | 4 |
| Timezone/Locale | 3 |
| Security | 4 |
| Missing Specs | 5 |
| **Total** | **76** |
