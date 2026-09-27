// Shared by the calendar page (URL query params) and the preferences API
// (form fields) — both submit a repeated "tags" field of tag ids as strings.
export function parseTagIds(values: string[]): number[] {
  return values
    .map((value) => Number.parseInt(value, 10))
    .filter((id) => Number.isInteger(id) && id > 0);
}
