(function () {
  const BUDGET_TYPE_ALIASES = {
    "1.1": "01.1",
    "01.1": "01.1",
    "2.1": "02.1",
    "02.1": "02.1",
    "2.2": "02.2",
    "02.2": "02.2",
    "3.1": "03.1",
    "03.1": "03.1"
  };

  function normalizeBudgetType(value) {
    const raw = String(value == null ? "" : value).trim();
    if (BUDGET_TYPE_ALIASES[raw]) return BUDGET_TYPE_ALIASES[raw];
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      const key = numeric.toFixed(1);
      if (BUDGET_TYPE_ALIASES[key]) return BUDGET_TYPE_ALIASES[key];
    }
    return raw;
  }

  function computeBudgetTotals(material, labor, budgetType) {
    const type = normalizeBudgetType(budgetType);
    const supervision = labor * 0.3;
    const transport = material * 0.05;
    const subtotal = material + labor + supervision + transport;
    const misc = subtotal * 0.05;
    const overhead = (subtotal + misc) * 0.05;
    const preFinal = subtotal + misc + overhead;
    const profit = type === "02.2" ? preFinal * 0.3 : 0;
    let total = preFinal + profit;
    if (type === "03.1") total *= 0.5;

    return {
      budgetType: type,
      material,
      labor,
      supervision,
      transport,
      misc,
      overhead,
      profit,
      preFinal,
      total
    };
  }

  function computeBudgetTotalsFromItems(items, budgetType) {
    let material = 0;
    let labor = 0;

    (items || []).forEach(item => {
      material += (Number(item.matPrice) || 0) * (Number(item.qty) || 0);
      labor += (Number(item.labPrice) || 0) * (Number(item.qty) || 0);
    });

    return computeBudgetTotals(material, labor, budgetType);
  }

  window.BudgetFormula = {
    BUDGET_TYPE_ALIASES,
    normalizeBudgetType,
    computeBudgetTotals,
    computeBudgetTotalsFromItems
  };
})();
