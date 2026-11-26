// Conti del calcolatore pagamenti e resa nel documento (pagina = PDF).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAutomaticPlan, sumPlanCents, ACTIVATION_LABEL } from "../client/src/lib/payment-plan";
import { derivePaymentsAndBonuses } from "../shared/contract-document";

const start = new Date(2026, 9, 20); // 20/10/2026

test("6000 € con attivazione 600 compresa: 600 alla firma + 12 rate da 450, totale 6000", () => {
  const r = buildAutomaticPlan({ total: 6000, frequency: "monthly", startDate: start, activationFee: 600, includeActivation: true });
  assert.equal(r.error, undefined);
  assert.equal(r.plan.length, 13);
  assert.deepEqual(r.plan[0], { rata_importo: "600.00", rata_scadenza: "20/10/2026", rata_descrizione: ACTIVATION_LABEL });
  assert.ok(r.plan.slice(1).every((p) => p.rata_importo === "450.00" && !p.rata_descrizione));
  assert.equal(r.plan[1].rata_scadenza, "20/11/2026", "prima rata un mese dopo la firma");
  assert.equal(r.plan[12].rata_scadenza, "20/10/2027");
  assert.equal(sumPlanCents(r.plan), 600000);
  assert.equal(r.totalToPay, 6000);
  assert.equal(r.regularInstallment, 450);
});

test("attivazione compresa con le altre frequenze: la somma resta il totale", () => {
  for (const [frequency, n, each] of [["quarterly", 4, "1350.00"], ["semiannual", 2, "2700.00"], ["annual", 1, "5400.00"]] as const) {
    const r = buildAutomaticPlan({ total: 6000, frequency, startDate: start, activationFee: 600, includeActivation: true });
    assert.equal(r.plan.length, n + 1, frequency);
    assert.ok(r.plan.slice(1).every((p) => p.rata_importo === each), frequency);
    assert.equal(sumPlanCents(r.plan), 600000, frequency);
  }
});

test("attivazione NON compresa: il piano divide solo il prezzo totale (come prima)", () => {
  const r = buildAutomaticPlan({ total: 6000, frequency: "monthly", startDate: start, activationFee: 600, includeActivation: false });
  assert.equal(r.plan.length, 12);
  assert.ok(r.plan.every((p) => p.rata_importo === "500.00"));
  assert.equal(r.plan[0].rata_scadenza, "20/10/2026");
  assert.equal(sumPlanCents(r.plan), 600000);
});

test("arrotondamenti: la somma delle rate è sempre esattamente il totale", () => {
  const r = buildAutomaticPlan({ total: 1000, frequency: "monthly", startDate: start });
  assert.equal(sumPlanCents(r.plan), 100000);
  assert.equal(r.plan[0].rata_importo, "83.33");
  assert.equal(r.plan[11].rata_importo, "83.37", "il resto va sull'ultima rata");
  for (const total of [99.99, 1234.56, 3333.33, 7, 10000.01]) {
    for (const frequency of ["monthly", "quarterly", "semiannual", "annual"] as const) {
      for (const includeActivation of [false, true]) {
        const r2 = buildAutomaticPlan({ total, frequency, startDate: start, activationFee: 1.11, includeActivation });
        assert.equal(sumPlanCents(r2.plan), Math.round(total * 100), `${total} ${frequency} ${includeActivation}`);
      }
    }
  }
});

test("sconto prima rata (abbonamento): solo sulla prima rata ordinaria, mai sull'attivazione", () => {
  const pct = buildAutomaticPlan({
    total: 6000, frequency: "monthly", startDate: start, isSubscription: true,
    discount: { enabled: true, type: "percentage", value: 50 }, activationFee: 600, includeActivation: true,
  });
  assert.equal(pct.plan[0].rata_importo, "600.00");
  assert.equal(pct.plan[1].rata_importo, "225.00");
  assert.equal(pct.discountAmount, 225);
  assert.equal(pct.totalToPay, 5775);
  assert.equal(sumPlanCents(pct.plan), 577500);

  const fixed = buildAutomaticPlan({
    total: 1200, frequency: "monthly", startDate: start, isSubscription: true,
    discount: { enabled: true, type: "fixed", value: 500 },
  });
  assert.equal(fixed.plan[0].rata_importo, "0.00", "lo sconto non supera la rata");
  assert.equal(fixed.totalToPay, 1100);

  const notSubscription = buildAutomaticPlan({
    total: 1200, frequency: "monthly", startDate: start, discount: { enabled: true, type: "fixed", value: 50 },
  });
  assert.equal(notSubscription.totalToPay, 1200, "senza abbonamento lo sconto non si applica");
});

test("errori: attivazione mancante o non minore del totale", () => {
  assert.match(buildAutomaticPlan({ total: 600, frequency: "monthly", activationFee: 600, includeActivation: true }).error!, /minore/);
  assert.match(buildAutomaticPlan({ total: 600, frequency: "monthly", activationFee: 0, includeActivation: true }).error!, /Inserisci/);
  assert.equal(buildAutomaticPlan({ total: 0, frequency: "monthly" }).plan.length, 0);
});

test("documento: la riga Attivazione non consuma un numero; i piani storici restano 1, 2, 3", () => {
  const r = buildAutomaticPlan({ total: 6000, frequency: "quarterly", startDate: start, activationFee: 600, includeActivation: true });
  const { paymentPlan } = derivePaymentsAndBonuses({ payment_plan: r.plan }, null);
  assert.deepEqual(paymentPlan.map((p) => p.rata_descrizione || p.rata_numero), ["Attivazione", 1, 2, 3, 4]);

  const old = derivePaymentsAndBonuses({ payment_plan: [{ rata_importo: "500.00", rata_scadenza: "2026-01-01" }, { rata_importo: "500.00", rata_scadenza: "2026-02-01" }] }, null);
  assert.deepEqual(old.paymentPlan, [
    { rata_numero: 1, rata_importo: "500.00", rata_scadenza: "2026-01-01" },
    { rata_numero: 2, rata_importo: "500.00", rata_scadenza: "2026-02-01" },
  ]);
});

test("durata del contratto: sotto i 12 mesi le rate seguono la durata, da 12 in su restano quelle storiche", async () => {
  const { installmentCount, contractDurationMonths, inferPlanFrequency } = await import("../client/src/lib/payment-plan");
  // 3 mesi a 1500 €: 3 rate mensili da 500, una trimestrale, unica soluzione
  const monthly = buildAutomaticPlan({ total: 1500, frequency: "monthly", startDate: start, durationMonths: 3 });
  assert.deepEqual(monthly.plan.map((p) => [p.rata_importo, p.rata_scadenza]),
    [["500.00", "20/10/2026"], ["500.00", "20/11/2026"], ["500.00", "20/12/2026"]]);
  assert.equal(buildAutomaticPlan({ total: 1500, frequency: "quarterly", startDate: start, durationMonths: 3 }).plan.length, 1);
  assert.equal(buildAutomaticPlan({ total: 1500, frequency: "annual", startDate: start, durationMonths: 3 }).plan.length, 1);
  assert.equal(installmentCount("quarterly", 7), 3);
  assert.equal(installmentCount("semiannual", 7), 2);
  for (const months of [12, 24, 36, undefined, null, 0, NaN]) {
    assert.deepEqual(
      (["monthly", "quarterly", "semiannual", "annual"] as const).map((f) => installmentCount(f, months)),
      [12, 4, 2, 1], String(months),
    );
  }
  assert.equal(contractDurationMonths("2026-10-20", "2027-01-20"), 3);
  assert.equal(contractDurationMonths("2026-10-20", "2027-01-19"), 3);
  assert.equal(contractDurationMonths("2026-10-20", "2027-10-20"), 12);
  assert.equal(contractDurationMonths("2026-10-20", "2026-10-20"), undefined);
  assert.equal(contractDurationMonths("", "2027-01-20"), undefined);
  // Riapertura di una bozza: frequenza dedotta da rate e durata
  assert.equal(inferPlanFrequency(3, 3), "monthly");
  assert.equal(inferPlanFrequency(1, 3), "annual");
  assert.equal(inferPlanFrequency(12, 12), "monthly");
  assert.equal(inferPlanFrequency(4), "quarterly");
  assert.equal(inferPlanFrequency(2, 12), "semiannual");
});

test("prima rata: inizio contratto futuro solo per contratti sotto i 12 mesi", async () => {
  const { planStartDate } = await import("../client/src/lib/payment-plan");
  const today = new Date(2026, 9, 20);
  const d = (x: Date) => `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
  assert.equal(d(planStartDate("2026-11-01", 3, today)), "2026-11-1");
  assert.equal(d(planStartDate("2026-11-01", 12, today)), "2026-10-20", "12 mesi: come prima (oggi)");
  assert.equal(d(planStartDate("2026-10-01", 3, today)), "2026-10-20", "inizio passato: oggi");
  assert.equal(d(planStartDate(null, 3, today)), "2026-10-20");
});
