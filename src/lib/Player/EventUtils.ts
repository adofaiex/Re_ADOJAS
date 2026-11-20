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
    // disabled 字段绝大多数是 boolean，但存档转换可能写字串（"Disabled"/
    // "true"）；统一交给 isEnabled，避免把 "Disabled" 当成启用。
    return !isEnabled(event?.disabled?.[fieldName], false);
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
    if (!event) return false;
    if (!isEnabled(event.active, true)) return false;
    if (isEnabled(event.disabled?.active, false)) return false;
    if (isEnabled(event.editorOnly, false)) return false;
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
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (v === 'enabled' || v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
        if (v === 'disabled' || v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
        return defaultValue;
    }
    return Boolean(value);
}
