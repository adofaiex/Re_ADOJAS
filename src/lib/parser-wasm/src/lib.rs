// ADOFAI Wasm JSON Tokenizer
//
// Replaces LargeFileParser.ts's JavaScript state machine with a Rust Wasm implementation.
// For files > 100MB: scans root-level JSON properties, parses angleData number arrays,
// and returns byte offsets so JS can JSON.parse each section.

use std::alloc::{alloc as std_alloc, dealloc as std_dealloc, Layout};
use std::ptr;
use std::slice;

// ── Memory management ──────────────────────────────────────────────

/// Allocate a buffer accessible from both Wasm and JS.
#[no_mangle]
pub extern "C" fn wasm_alloc(size: i32) -> *mut u8 {
    if size <= 0 {
        return ptr::null_mut();
    }
    let layout = Layout::from_size_align(size as usize, 8).unwrap();
    unsafe { std_alloc(layout) }
}

/// Free a buffer previously allocated by wasm_alloc.
#[no_mangle]
pub extern "C" fn wasm_dealloc(ptr: *mut u8, size: i32) {
    if ptr.is_null() {
        return;
    }
    let layout = Layout::from_size_align(size as usize, 8).unwrap();
    unsafe { std_dealloc(ptr, layout) }
}

// ── Constants ──────────────────────────────────────────────────────

// Property index layout in the output struct (11 × i32 = 44 bytes)
// [0]:  settings_offset (0 = not found)
// [1]:  settings_end
// [2]:  actions_offset
// [3]:  actions_end
// [4]:  angleData_offset
// [5]:  angleData_end
// [6]:  pathData_offset
// [7]:  pathData_end
// [8]:  decorations_offset
// [9]:  decorations_end
// [10]: angle_data_count (number of f64 values written to angle buffer)

const PROP_SETTINGS: usize = 0;
const PROP_ACTIONS: usize = 2;
const PROP_ANGLEDATA: usize = 4;
const PROP_PATH_DATA: usize = 6;
const PROP_DECORATIONS: usize = 8;
const PROP_ANGLE_COUNT: usize = 10;

// ── Main entry point ───────────────────────────────────────────────

/// Parse an ADOFAI level JSON file, returning byte offsets for each
/// root-level property and pre-parsed angleData values.
///
/// # Arguments
/// - `input_ptr`: pointer to raw UTF-8 JSON bytes
/// - `input_len`: length of input in bytes
/// - `output_ptr`: pointer to 44-byte output struct (11 × i32)
/// - `angle_ptr`: pointer to f64 buffer for parsed angle data
/// - `angle_cap`: maximum number of f64 values
///
/// # Returns
/// - `0` on success
/// - `-1` on error
#[no_mangle]
pub extern "C" fn parse_adofai(
    input_ptr: *mut u8,
    input_len: i32,
    output_ptr: *mut u8,
    angle_ptr: *mut f64,
    angle_cap: i32,
) -> i32 {
    if input_ptr.is_null() || input_len <= 0 {
        return -1;
    }
    if output_ptr.is_null() {
        return -1;
    }

    let bytes = unsafe { slice::from_raw_parts(input_ptr, input_len as usize) };
    let out = unsafe { slice::from_raw_parts_mut(output_ptr, 44) };
    let angle_out = if angle_ptr.is_null() || angle_cap <= 0 {
        &mut []
    } else {
        unsafe { slice::from_raw_parts_mut(angle_ptr, angle_cap as usize) }
    };

    // Zero out all 11 output integers
    for chunk in out.chunks_exact_mut(4) {
        chunk.copy_from_slice(&[0u8; 4]);
    }

    // Skip BOM (EF BB BF)
    let mut pos = 0;
    if bytes.len() >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF {
        pos = 3;
    }

    // Find opening `{`
    skip_whitespace(bytes, &mut pos);
    if pos >= bytes.len() || bytes[pos] != b'{' {
        return -1;
    }
    pos += 1; // skip `{`

    // Main scan loop
    let mut depth: i32 = 1;
    let mut in_string = false;
    let mut escape_next = false;
    let mut property_name_start = 0usize;
    let mut property_name_len = 0usize;
    let mut expecting_property_name = true;
    let mut expecting_colon = false;
    let mut expecting_value = false;

    while pos < bytes.len() {
        let byte = bytes[pos];

        if escape_next {
            escape_next = false;
            pos += 1;
            continue;
        }

        if byte == b'\\' {
            escape_next = true;
            pos += 1;
            continue;
        }

        if byte == b'"' {
            if in_string {
                // End of string
                in_string = false;
                if expecting_property_name && depth == 1 {
                    // We just finished a property name string
                    property_name_len = pos - property_name_start;
                    expecting_property_name = false;
                    expecting_colon = true;
                }
            } else {
                // Start of string
                in_string = true;
                if expecting_property_name && depth == 1 {
                    property_name_start = pos + 1;
                }
            }
            pos += 1;
            continue;
        }

        if in_string {
            pos += 1;
            continue;
        }

        // Not in string
        match byte {
            b'{' => {
                depth += 1;
                if expecting_value && depth == 1 {
                    // Oops, this shouldn't happen at root level
                }
                pos += 1;
            }
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    // End of root object
                    break;
                }
                pos += 1;
            }
            b'[' => {
                depth += 1;
                pos += 1;
            }
            b']' => {
                depth -= 1;
                pos += 1;
            }
            b':' => {
                if expecting_colon && depth == 1 {
                    expecting_colon = false;
                    expecting_value = true;
                }
                pos += 1;
            }
            b',' => {
                if depth == 1 {
                    expecting_property_name = true;
                    expecting_colon = false;
                    expecting_value = false;
                }
                pos += 1;
            }
            // whitespace
            0x20 | 0x09 | 0x0A | 0x0D => {
                pos += 1;
            }
            _ => {
                // We're at the start of a value (number, bool, null)
                if expecting_value && depth == 1 && property_name_len > 0 {
                    let key = &bytes[property_name_start..property_name_start + property_name_len];

                    // Mark value start position
                    let value_start = pos;

                    // Find value end
                    let value_end = find_value_end(bytes, value_start);

                    if value_end > value_start {
                        // Store property offset
                        store_property(out, key, value_start, value_end);

                        // If this is angleData, parse the number array
                        if key == b"angleData" && !angle_out.is_empty() {
                            let count = parse_angle_data(bytes, value_start, value_end, angle_out);
                            // Store count
                            let count_ptr = unsafe {
                                &mut *(out[PROP_ANGLE_COUNT * 4..][..4].as_mut_ptr() as *mut i32)
                            };
                            *count_ptr = count;
                        }

                        pos = value_end;
                    } else {
                        pos += 1;
                    }

                    expecting_property_name = false;
                    expecting_colon = false;
                    expecting_value = false;
                    property_name_len = 0;
                } else {
                    pos += 1;
                }
            }
        }
    }

    0
}

// ── Property store ─────────────────────────────────────────────────

fn store_property(out: &mut [u8], key: &[u8], value_start: usize, value_end: usize) {
    let idx: Option<usize> = match key {
        b"settings" => Some(PROP_SETTINGS),
        b"actions" => Some(PROP_ACTIONS),
        b"angleData" => Some(PROP_ANGLEDATA),
        b"pathData" => Some(PROP_PATH_DATA),
        b"decorations" => Some(PROP_DECORATIONS),
        _ => None,
    };

    if let Some(i) = idx {
        let start_bytes = (value_start as i32).to_le_bytes();
        let end_bytes = (value_end as i32).to_le_bytes();

        let start_offset = i * 4;
        let end_offset = (i + 1) * 4;

        out[start_offset..start_offset + 4].copy_from_slice(&start_bytes);
        out[end_offset..end_offset + 4].copy_from_slice(&end_bytes);
    }
}

// ── Value end finding ──────────────────────────────────────────────

fn find_value_end(bytes: &[u8], start: usize) -> usize {
    if start >= bytes.len() {
        return start;
    }

    match bytes[start] {
        b'"' => find_string_end(bytes, start),
        b'[' => find_bracket_end(bytes, start, b'[', b']'),
        b'{' => find_bracket_end(bytes, start, b'{', b'}'),
        _ => find_primitive_end(bytes, start),
    }
}

fn find_string_end(bytes: &[u8], start: usize) -> usize {
    let mut i = start + 1;
    while i < bytes.len() {
        match bytes[i] {
            b'\\' => i += 2, // skip escaped char
            b'"' => return i + 1,
            _ => i += 1,
        }
    }
    bytes.len()
}

fn find_bracket_end(bytes: &[u8], start: usize, open: u8, close: u8) -> usize {
    let mut depth: i32 = 0;
    let mut i = start;
    let mut in_string = false;
    let mut escape_next = false;

    while i < bytes.len() {
        if escape_next {
            escape_next = false;
            i += 1;
            continue;
        }

        if bytes[i] == b'\\' {
            escape_next = true;
            i += 1;
            continue;
        }

        if bytes[i] == b'"' {
            in_string = !in_string;
            i += 1;
            continue;
        }

        if !in_string {
            if bytes[i] == open {
                depth += 1;
            } else if bytes[i] == close {
                depth -= 1;
                if depth == 0 {
                    return i + 1;
                }
            }
        }
        i += 1;
    }

    bytes.len()
}

fn find_primitive_end(bytes: &[u8], start: usize) -> usize {
    let mut i = start;
    while i < bytes.len() {
        match bytes[i] {
            b',' | b'}' | b']' | 0x20 | 0x09 | 0x0A | 0x0D => return i,
            _ => i += 1,
        }
    }
    i
}

// ── Angle data parser ──────────────────────────────────────────────

/// Parse a JSON number array incrementally into an f64 buffer.
/// Returns the number of f64 values written.
fn parse_angle_data(bytes: &[u8], start: usize, end: usize, output: &mut [f64]) -> i32 {
    if start >= bytes.len() || bytes[start] != b'[' {
        return 0;
    }

    let mut i = start + 1;
    let mut count: i32 = 0;
    let max_out = output.len() as i32;

    // Skip initial whitespace
    skip_whitespace(bytes, &mut i);

    // Empty array
    if i < bytes.len() && bytes[i] == b']' {
        return 0;
    }

    while i < end as usize && i < bytes.len() {
        skip_whitespace(bytes, &mut i);

        if i >= bytes.len() || bytes[i] == b']' {
            break;
        }

        // Parse a number
        let num_start = i;
        let mut has_dot = false;
        let mut has_digit = false;

        if bytes[i] == b'-' || bytes[i] == b'+' {
            i += 1;
        }

        while i < bytes.len() {
            match bytes[i] {
                b'0'..=b'9' => {
                    has_digit = true;
                    i += 1;
                }
                b'.' => {
                    has_dot = true;
                    i += 1;
                }
                b'e' | b'E' => {
                    i += 1;
                    if i < bytes.len() && (bytes[i] == b'+' || bytes[i] == b'-') {
                        i += 1;
                    }
                }
                _ => break,
            }
        }

        if has_digit && count < max_out {
            let num_str = &bytes[num_start..i];
            if let Some(val) = fast_parse_f64(num_str) {
                output[count as usize] = val;
                count += 1;
            }
        }

        // Skip whitespace and comma
        skip_whitespace(bytes, &mut i);
        if i < bytes.len() && bytes[i] == b',' {
            i += 1;
        }
    }

    count
}

// ── Helpers ────────────────────────────────────────────────────────

fn skip_whitespace(bytes: &[u8], pos: &mut usize) {
    while *pos < bytes.len() && matches!(bytes[*pos], 0x20 | 0x09 | 0x0A | 0x0D) {
        *pos += 1;
    }
}

/// Fast f64 parser from ASCII bytes (avoids str::parse overhead).
fn fast_parse_f64(bytes: &[u8]) -> Option<f64> {
    if bytes.is_empty() {
        return None;
    }
    // Use std's parse - it's well-optimized already
    let s = unsafe { std::str::from_utf8_unchecked(bytes) };
    s.parse::<f64>().ok()
}

// ── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_properties() {
        let json = br#"{"settings":{"a":1},"actions":[1,2],"angleData":[1.5,2.5,3.5],"pathData":"abc","decorations":[{}]}"#;
        let mut out = [0u8; 44];
        let mut angles = [0.0f64; 100];

        let result = parse_adofai(
            json.as_ptr() as *mut u8,
            json.len() as i32,
            out.as_mut_ptr(),
            angles.as_mut_ptr(),
            100,
        );
        assert_eq!(result, 0);

        // Check settings
        let settings_off = i32::from_le_bytes(out[0..4].try_into().unwrap()) as usize;
        let settings_end = i32::from_le_bytes(out[4..8].try_into().unwrap()) as usize;
        assert!(settings_off > 0);
        assert!(settings_end > settings_off);
        let settings_str = std::str::from_utf8(&json[settings_off..settings_end]).unwrap();
        assert_eq!(settings_str, "{\"a\":1}");

        // Check angle data
        let count = i32::from_le_bytes(out[40..44].try_into().unwrap());
        assert_eq!(count, 3);
        assert!((angles[0] - 1.5).abs() < 1e-10);
        assert!((angles[1] - 2.5).abs() < 1e-10);
        assert!((angles[2] - 3.5).abs() < 1e-10);
    }

    #[test]
    fn test_empty_angle_data() {
        let json = br#"{"settings":{},"angleData":[]}"#;
        let mut out = [0u8; 44];
        let mut angles = [0.0f64; 100];

        let result = parse_adofai(
            json.as_ptr() as *mut u8,
            json.len() as i32,
            out.as_mut_ptr(),
            angles.as_mut_ptr(),
            100,
        );
        assert_eq!(result, 0);

        let count = i32::from_le_bytes(out[40..44].try_into().unwrap());
        assert_eq!(count, 0);
    }

    #[test]
    fn test_large_angle_data() {
        let mut json = br#"{"settings":{},"angleData":["#.to_vec();
        for i in 0..1000 {
            if i > 0 {
                json.push(b',');
            }
            json.extend_from_slice(format!("{}", i as f64 * 0.5).as_bytes());
        }
        json.extend_from_slice(b"]}");
        let mut out = [0u8; 44];
        let mut angles = [0.0f64; 2000];

        let result = parse_adofai(
            json.as_mut_ptr(),
            json.len() as i32,
            out.as_mut_ptr(),
            angles.as_mut_ptr(),
            2000,
        );
        assert_eq!(result, 0);

        let count = i32::from_le_bytes(out[40..44].try_into().unwrap());
        assert_eq!(count, 1000);

        for i in 0..1000 {
            assert!((angles[i] - i as f64 * 0.5).abs() < 1e-10);
        }
    }
}
