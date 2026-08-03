export interface SuspensionState {
  readonly userPaused: boolean;
  readonly documentHidden: boolean;
  readonly viewportBlocked: boolean;
}

export function isSuspended(state: SuspensionState): boolean {
  return state.userPaused || state.documentHidden || state.viewportBlocked;
}
