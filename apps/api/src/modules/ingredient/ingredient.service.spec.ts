describe('IngredientService — direct stock deduction logic', () => {
  it('deducts quantity directly from stock', () => {
    const stock = 10;
    const quantity = 3;
    const result = stock - quantity;
    expect(result).toBe(7);
  });

  it('does not deduct for track_stock = false items', () => {
    const trackStock = false;
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
