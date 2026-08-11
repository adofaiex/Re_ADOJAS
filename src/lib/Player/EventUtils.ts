/**
 * Check if an event field is enabled (not disabled via the `disabled` dictionary).
 *
 * ADOFAI convention:
 * - Each event may have a `disabled` dictionary: { "fieldName": boolean }
 * - `true`  = field is disabled (do NOT apply its value)
 * - `false` = field is enabled (apply normally)
 * - missing = field defaults to enabled
 */
export function isFieldEnabled(event: any, fieldName: string): boolean {
    return event.disabled?.[fieldName] !== true;
}

/**
 * Check if an event should be processed (active).
 *
 * ADOFAI convention:
 * - `event.active`: `true`, `false`, or the string `"Disabled"`
 * - Default is `true` (active) when `undefined`
 * - Also respects `event.disabled?.active` (editor filter system)
 * - `event.editorOnly` events are always skipped
 */
export function isEventActive(event: any): boolean {
    if (event.active === false || event.active === 'Disabled') return false;
    if (event.disabled?.active === true) return false;
    if (event.editorOnly === true) return false;
    return true;
}

/**
 * Check if a setting/field value is enabled, matching ADOFAI-JS `isEventEnabled`:
 * - `undefined`/`null` → returns `defaultValue`
 * - `boolean` → as-is
 * - `"Enabled"` / `"true"` (string) → true
 * Anything else → false
 *
 * Used for fields like `separateCountdownTime` which may be `true` or `"Enabled"`.
 */
export function isEnabled(value: any, defaultValue: boolean = false): boolean {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'boolean') return value;
    return value === 'Enabled' || value === 'true';
}
