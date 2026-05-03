// Standard server-action return shape used throughout the app.
// Every server action resolves to one of these — never throws to the caller.
export type ActionResult<T = void> =
  | { error: null; data?: T }
  | { error: string; data?: undefined };

export const ok = <T = void>(data?: T): ActionResult<T> => ({
  error: null,
  data,
});

export const fail = (error: string): ActionResult<never> => ({
  error,
  data: undefined,
});
