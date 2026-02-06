import { beforeEach, describe, expect, it } from 'vitest';
import { useSelectionStore } from './selectionStore';
import type { FieldState } from '../types';

describe('selectionStore', () => {
  beforeEach(() => {
    useSelectionStore.setState({
      selections: [],
      fieldStates: new Map(),
      history: [],
      historyIndex: -1,
    });
  });

  it('returns possible for unknown values while selections exist', () => {
    useSelectionStore.getState().selectValue({
      table: 'customers',
      column: 'Name',
      value: 'Karin Olsen',
    });

    const state = useSelectionStore
      .getState()
      .getValueState('sales', 'ProductID', 101);

    expect(state).toBe('possible');
  });

  it('returns excluded for unknown values not present in computed field state', () => {
    const computedState: FieldState = {
      table: 'sales',
      column: 'ProductID',
      valueStates: new Map([[100, 'possible']]),
    };

    useSelectionStore.getState().setFieldStates([computedState]);

    const state = useSelectionStore
      .getState()
      .getValueState('sales', 'ProductID', 101);

    expect(state).toBe('excluded');
  });

  it('matches equivalent Date values across different object instances', () => {
    const timestamp = new Date('2024-01-01T00:00:00.000Z');
    useSelectionStore.getState().setFieldStates([
      {
        table: 'sales',
        column: 'SaleDate',
        valueStates: new Map([[timestamp, 'possible']]),
      },
    ]);

    const state = useSelectionStore
      .getState()
      .getValueState('sales', 'SaleDate', new Date('2024-01-01T00:00:00.000Z'));

    expect(state).toBe('possible');
  });
});
