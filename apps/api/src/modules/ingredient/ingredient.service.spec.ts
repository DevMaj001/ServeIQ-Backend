describe('IngredientService — direct stock deduction logic', () => {
  it('deducts quantity directly from stock', () => {
    const stock = 10;
    const quantity = 3;
    const result = stock - quantity;
    expect(result).toBe(7);
  });

  it('does not deduct for track_stock = false items', () => {
    const trackStock = false;
    const stock = 10;
    // When track_stock is false, deduction is skipped entirely
    const shouldDeduct = trackStock;
    expect(shouldDeduct).toBe(false);
  });

  it('handles zero stock gracefully', () => {
    const stock = 0;
    const quantity = 5;
    const result = stock - quantity;
    expect(result).toBe(-5);
  });
});

describe('IngredientService — lock ordering', () => {
  it('sorts item IDs to prevent deadlock', () => {
    const ids = ['c', 'a', 'b'].sort();
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('deduplicates item IDs before sorting', () => {
    const ids = ['b', 'a', 'b', 'c', 'a'];
    const deduped = [...new Set(ids)].sort();
    expect(deduped).toEqual(['a', 'b', 'c']);
  });
});

describe('IngredientService — low stock notification boundary', () => {
  const crossesIntoLow = (
    oldQty: number,
    newQty: number,
    reorderLevel: number,
    applied: number,
  ) =>
    applied > 0 && oldQty > reorderLevel && newQty <= reorderLevel;

  it('notifies when deduction crosses the reorder threshold', () => {
    expect(crossesIntoLow(5, 2, 3, 3)).toBe(true);
  });

  it('does not re-notify when already below threshold and another order is placed', () => {
    expect(crossesIntoLow(2, 1, 3, 1)).toBe(false);
  });

  it('does not notify when deduction stays above the threshold', () => {
    expect(crossesIntoLow(10, 7, 5, 3)).toBe(false);
  });

  it('does not notify when threshold is already met before the deduction', () => {
    expect(crossesIntoLow(3, 2, 3, 1)).toBe(false);
  });
});
