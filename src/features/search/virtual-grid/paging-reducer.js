/**
 * Reducer function for managing the pagination state of the virtualizer.
 *
 * @typeParam TListContextParams - The type of parameters that define the list's query context
 * @typeParam TStartRow - The type of data needed to anchor pagination
 */
export function pagingReducer(state, action) {
  switch (action.type) {
    case 'UPDATE_ESTIMATED_TOTAL': {
      const newTotal = Math.max(state.estimatedTotal, action.newTotal);
      if (newTotal === state.estimatedTotal) {
        return state;
      }
      return {
        ...state,
        estimatedTotal: newTotal,
      };
    }
    case 'REACHED_START':
      return { ...state, hasReachedStart: true };
    case 'REACHED_END':
      return { ...state, hasReachedEnd: true };
    case 'UPDATE_ANCHOR':
      return {
        ...state,
        queryAnchor: {
          ...state.queryAnchor,
          anchor: action.anchor,
        },
      };
    case 'SHIFT_ANCHOR_DOWN':
      return {
        ...state,
        queryAnchor: {
          ...state.queryAnchor,
          anchor: action.newAnchor,
        },
        pendingScrollAdjustment: action.offset,
        pagingPhase: 'adjusting',
      };
    case 'RESET_TO_TOP':
      return {
        ...state,
        queryAnchor: {
          ...state.queryAnchor,
          anchor: { index: 0, kind: 'forward', startRow: undefined },
        },
        pendingScrollAdjustment: action.offset,
        pagingPhase: 'adjusting',
      };
    case 'SCROLL_ADJUSTED':
      return {
        ...state,
        estimatedTotal: state.estimatedTotal + state.pendingScrollAdjustment,
        pendingScrollAdjustment: 0,
        pagingPhase: 'skipping',
      };
    case 'PAGING_COMPLETE':
      return {
        ...state,
        pagingPhase: 'idle',
      };
    case 'RESET_STATE':
      return {
        ...state,
        estimatedTotal: action.estimatedTotal,
        hasReachedStart: action.hasReachedStart,
        hasReachedEnd: action.hasReachedEnd,
        queryAnchor: {
          listContextParams: action.listContextParams,
          anchor: action.anchor,
        },
        pagingPhase: 'skipping',
      };
    default: {
      action;
      return state;
    }
  }
}
