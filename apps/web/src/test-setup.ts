declare global {
  // React's act() requires this flag outside of a test renderer.
  // oxlint-disable-next-line no-var -- a global augmentation must use var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
