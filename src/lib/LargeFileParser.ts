/**
 * Large File Parser for ADOFAI - Memory Optimized Version
 *
 * Key optimization: Process the buffer in-place without creating copies.
 * The "trailing comma" handling is done on-the-fly during parsing.
 */

// BOM marker for UTF-8
const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);

/**
 * Find ALL properties at root object level
 * Returns a map of property name -> value start position
 */
function findAllPropertiesAtRoot(buffer: Uint8Array): Map<string, number> {
  const result = new Map<string, number>();
  
  // Track JSON state
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let lastQuoteEnd = -1;
  
  // Property name tracking
  let propertyNameStart = -1;
  let propertyName = '';
  
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    
    // Handle escape sequences
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (byte === 92) { // backslash
      escapeNext = true;
      continue;
    }
    
    // Track string boundaries
    if (byte === 34) { // quote
      if (inString) {
        // End of string
        inString = false;
        lastQuoteEnd = i;
        
        // If we're at depth 1 and this was a property name (next non-whitespace is colon)
        if (depth === 1 && propertyNameStart !== -1) {
          // Extract property name
          const nameBytes = buffer.slice(propertyNameStart, i);
          const decoder = new TextDecoder('utf-8');
          propertyName = decoder.decode(nameBytes);
        }
      } else {
        // Start of string
        inString = true;
        propertyNameStart = i + 1; // +1 to skip the quote
      }
      continue;
    }
    
    // Track object depth (not array depth for property finding)
    if (!inString) {
      if (byte === 123) { // {
        depth++;
      } else if (byte === 125) { // }
        depth--;
      } else if (byte === 58 && depth === 1 && propertyName) { // colon at root level
        // This is a property! Find value start
        let pos = i + 1;
        // Skip whitespace
        while (pos < buffer.length && (buffer[pos] === 32 || buffer[pos] === 9 || buffer[pos] === 10 || buffer[pos] === 13)) {
          pos++;
        }
        result.set(propertyName, pos);
        propertyName = '';
        propertyNameStart = -1;
      }
    }
  }
  
  return result;
}

/**
 * Find the end of a JSON value, handling trailing commas
 */
function findValueEnd(buffer: Uint8Array, startPos: number): number {
  if (startPos >= buffer.length) return -1;

  const firstChar = buffer[startPos];

  // String
  if (firstChar === 34) { // "
    let i = startPos + 1;
    let escapeNext = false;
    while (i < buffer.length) {
      if (escapeNext) {
        escapeNext = false;
        i++;
        continue;
      }
      if (buffer[i] === 92) {
        escapeNext = true;
        i++;
        continue;
      }
      if (buffer[i] === 34) {
        return i + 1;
      }
      i++;
    }
    return -1;
  }

  // Array or Object
  if (firstChar === 91 || firstChar === 123) { // [ or {
    const openChar = firstChar;
    const closeChar = firstChar === 91 ? 93 : 125; // ] or }
    let depth = 0;
    let i = startPos;
    let inString = false;
    let escapeNext = false;

    while (i < buffer.length) {
      if (escapeNext) {
        escapeNext = false;
        i++;
        continue;
      }
      if (buffer[i] === 92) {
        escapeNext = true;
        i++;
        continue;
      }
      if (buffer[i] === 34) {
        inString = !inString;
        i++;
        continue;
      }
      if (!inString) {
        if (buffer[i] === openChar) {
          depth++;
        } else if (buffer[i] === closeChar) {
          depth--;
          if (depth === 0) {
            return i + 1;
          }
        }
      }
      i++;
    }
    return -1;
  }

  // Primitive
  let i = startPos;
  while (i < buffer.length) {
    const byte = buffer[i];
    if (byte === 44 || byte === 125 || byte === 93 ||
        byte === 32 || byte === 9 || byte === 10 || byte === 13) {
      return i;
    }
    i++;
  }
  return i;
}

/**
 * Extract a JSON value as string
 */
function extractValueAsString(buffer: Uint8Array, startPos: number, endPos: number): string {
  const bytes = buffer.slice(startPos, endPos);
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(bytes);
}

/**
 * Parse a number array incrementally, handling trailing commas
 */
function parseNumberArrayIncremental(
  buffer: Uint8Array,
  startPos: number,
  onProgress?: (percent: number) => void
): { values: number[]; endPos: number } | null {
  if (startPos >= buffer.length || buffer[startPos] !== 91) return null;

  const values: number[] = [];
  let i = startPos + 1;
  let currentValue = '';
  let depth = 1;
  let inString = false;
  let escapeNext = false;
  let lastWasComma = false;
  const totalLength = buffer.length;

  while (i < buffer.length) {
    const byte = buffer[i];

    if (escapeNext) {
      escapeNext = false;
      i++;
      continue;
    }

    if (byte === 92) {
      escapeNext = true;
      i++;
      continue;
    }

    if (byte === 34) {
      inString = !inString;
      i++;
      continue;
    }

    if (!inString) {
      if (byte === 91) {
        depth++;
        i++;
        lastWasComma = false;
      } else if (byte === 93) {
        depth--;
        if (depth === 0) {
          if (currentValue.trim() && !lastWasComma) {
            const num = Number(currentValue.trim());
            if (!isNaN(num)) {
              values.push(num);
            }
          }
          return { values, endPos: i + 1 };
        }
        i++;
        lastWasComma = false;
      } else if (byte === 44) {
        if (currentValue.trim() && !lastWasComma) {
          const num = Number(currentValue.trim());
          if (!isNaN(num)) {
            values.push(num);
          }
        }
        currentValue = '';
        lastWasComma = true;
        i++;
      } else if ((byte >= 48 && byte <= 57) || byte === 45 || byte === 46) {
        currentValue += String.fromCharCode(byte);
        lastWasComma = false;
        i++;
      } else if (byte === 32 || byte === 9 || byte === 10 || byte === 13) {
        i++;
      } else {
        i++;
      }
    } else {
      i++;
    }

    if (onProgress && i % 5000000 === 0) {
      onProgress(Math.round((i / totalLength) * 100));
    }
  }

  return { values, endPos: i };
}

/**
 * Parse object array incrementally
 */
function parseObjectArrayIncremental(
  buffer: Uint8Array,
  startPos: number,
  onProgress?: (percent: number) => void,
  maxObjects?: number
): { values: any[]; endPos: number } | null {
  if (startPos >= buffer.length || buffer[startPos] !== 91) return null;

  const values: any[] = [];
  let i = startPos + 1;
  let depth = 1;
  let inString = false;
  let escapeNext = false;
  let objectStart = -1;
  const totalLength = buffer.length;
  let objectCount = 0;
  let lastWasComma = false;

  while (i < buffer.length && (buffer[i] === 32 || buffer[i] === 9 || buffer[i] === 10 || buffer[i] === 13)) {
    i++;
  }

  if (buffer[i] === 93) {
    return { values: [], endPos: i + 1 };
  }

  while (i < buffer.length) {
    const byte = buffer[i];

    if (escapeNext) {
      escapeNext = false;
      i++;
      continue;
    }

    if (byte === 92) {
      escapeNext = true;
      i++;
      continue;
    }

    if (byte === 34) {
      inString = !inString;
      i++;
      continue;
    }

    if (!inString) {
      if (byte === 123) {
        if (depth === 1 && objectStart === -1) {
          objectStart = i;
        }
        depth++;
        i++;
      } else if (byte === 125) {
        depth--;
        if (depth === 1 && objectStart !== -1) {
          const objStr = extractValueAsString(buffer, objectStart, i + 1);
          try {
            const obj = JSON.parse(objStr);
            values.push(obj);
            objectCount++;

            if (maxObjects && objectCount >= maxObjects) {
              let searchPos = i + 1;
              while (searchPos < buffer.length && buffer[searchPos] !== 93) {
                searchPos++;
              }
              return { values, endPos: searchPos + 1 };
            }
          } catch (e) {
            // Skip malformed objects
          }
          objectStart = -1;

          if (onProgress && objectCount % 50000 === 0) {
            onProgress(Math.round((i / totalLength) * 100));
          }
        }
        i++;
      } else if (byte === 91) {
        depth++;
        i++;
      } else if (byte === 93) {
        depth--;
        if (depth === 0) {
          return { values, endPos: i + 1 };
        }
        i++;
      } else if (byte === 44) {
        lastWasComma = true;
        i++;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return { values, endPos: i };
}

/**
 * Memory-optimized Large File Parser
 */
export class LargeFileParser {
  private onProgress?: (stage: string, percent: number) => void;
  private skipLargeActions: boolean = false;
  private maxActions: number = 0;

  constructor(
    onProgress?: (stage: string, percent: number) => void,
    options?: { skipLargeActions?: boolean; maxActions?: number }
  ) {
    this.onProgress = onProgress;
    if (options) {
      this.skipLargeActions = options.skipLargeActions ?? false;
      this.maxActions = options.maxActions ?? 0;
    }
  }

  /**
   * Parse ArrayBuffer - NO MEMORY COPYING
   */
  parse(input: ArrayBuffer): any {
    let view = new Uint8Array(input);

    // Strip BOM
    if (view.length >= 3 && view[0] === BOM[0] && view[1] === BOM[1] && view[2] === BOM[2]) {
      view = view.subarray(3);
    }

    if (this.onProgress) this.onProgress('scanning', 5);

    // Find ALL properties at root level in one pass
    const properties = findAllPropertiesAtRoot(view);
    
    // Found properties (silent)
    
    const angleDataPos = properties.get('angleData') ?? -1;
    const pathDataPos = properties.get('pathData') ?? -1;
    const settingsPos = properties.get('settings') ?? -1;
    const actionsPos = properties.get('actions') ?? -1;
    const decorationsPos = properties.get('decorations') ?? -1;

    const result: any = {};

    // Parse settings FIRST (contains hitsound info)
    if (settingsPos !== -1) {
      if (this.onProgress) this.onProgress('parsing_settings', 10);
      const settingsEnd = findValueEnd(view, settingsPos);
      if (settingsEnd !== -1) {
        const settingsStr = extractValueAsString(view, settingsPos, settingsEnd);
        try {
          result.settings = JSON.parse(settingsStr);
        } catch (e) {
          console.warn('[LargeFileParser] Failed to parse settings:', e);
          result.settings = {};
        }
      }
    }

    // Parse angleData
    if (angleDataPos !== -1) {
      if (this.onProgress) this.onProgress('parsing_angleData', 15);
      const angleResult = parseNumberArrayIncremental(view, angleDataPos, (p) => {
        if (this.onProgress) {
          this.onProgress('parsing_angleData', 15 + p * 0.25);
        }
      });
      if (angleResult) {
        result.angleData = angleResult.values;
        // AngleData parsed
      }
    }

    // Parse pathData
    if (pathDataPos !== -1) {
      const pathEnd = findValueEnd(view, pathDataPos);
      if (pathEnd !== -1) {
        const pathStr = extractValueAsString(view, pathDataPos, pathEnd);
        result.pathData = pathStr.slice(1, -1);
      }
    }

    // Parse actions
    if (actionsPos !== -1) {
      const actionsEnd = findValueEnd(view, actionsPos);
      const actionsSize = actionsEnd - actionsPos;

      if (this.onProgress) this.onProgress('parsing_actions', 50);

      if (actionsSize > 100 * 1024 * 1024 && this.skipLargeActions) {
        // Skipping large actions
        result.actions = [];
      } else if (actionsSize > 50 * 1024 * 1024) {
        // Parsing actions incrementally
        const actionsResult = parseObjectArrayIncremental(
          view,
          actionsPos,
          (p) => {
            if (this.onProgress) {
              this.onProgress('parsing_actions', 50 + p * 0.45);
            }
          },
          this.maxActions || undefined
        );
        if (actionsResult) {
          result.actions = actionsResult.values;
          // Actions parsed
        }
      } else {
        const actionsStr = extractValueAsString(view, actionsPos, actionsEnd);
        try {
          result.actions = JSON.parse(actionsStr);
        } catch (e) {
          console.warn('[LargeFileParser] Failed to parse actions:', e);
          result.actions = [];
        }
      }
    }

    // Parse decorations
    if (decorationsPos !== -1) {
      if (this.onProgress) this.onProgress('parsing_decorations', 95);
      const decorationsEnd = findValueEnd(view, decorationsPos);
      if (decorationsEnd !== -1) {
        const decorationsStr = extractValueAsString(view, decorationsPos, decorationsEnd);
        try {
          result.decorations = JSON.parse(decorationsStr);
        } catch (e) {
          console.warn('[LargeFileParser] Failed to parse decorations:', e);
          result.decorations = [];
        }
      }
    }

    if (this.onProgress) this.onProgress('complete', 100);

    return result;
  }

  stringify(obj: any): string {
    return JSON.stringify(obj);
  }
}

export default LargeFileParser;
