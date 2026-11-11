/** Local service credentials. Configuration errors never enable authentication. */
export function validServiceSecret(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && value.length >= 32 &&
    value.trim() === value &&
    !/(change[-_ ]?me|example|placeholder|replace[-_ ]?me|local-dev-only|test[-_ ]|unit[-_ ]?test)/i
      .test(value);
}

export function serviceAuthorized(
  configured: string | null | undefined,
  supplied: string | null | undefined,
): boolean {
  return validServiceSecret(configured) && !!supplied &&
    configured === supplied;
}

export function requireServiceSecret(
  name: string,
  value: string | undefined,
): string {
  if (!validServiceSecret(value)) {
    throw new Error(
      `${name} requires an explicit non-placeholder secret of at least 32 characters`,
    );
  }
  return value;
}
