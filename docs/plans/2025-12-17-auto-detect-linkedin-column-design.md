# Auto-Detect LinkedIn Column Design

**Date:** 2025-12-17
**Problem:** Users must know that their CSV has a column named exactly "LinkedIn Profile" for the bot to work. This creates unnecessary friction.

**Solution:** Automatically detect which column contains LinkedIn URLs instead of requiring a specific column name.

## Approach

Auto-detect the LinkedIn column by scanning all columns and using the first one that contains LinkedIn URLs.

**Why this approach:**
- Zero user input needed - just upload and go
- Works with any column name ("Profile URL", "LinkedIn", "Link", etc.)
- Simple user experience
- Efficient - stops at first match

**Trade-off:** If multiple columns have LinkedIn URLs, only the first one is used. This is acceptable since CSVs typically have one LinkedIn column.

## Implementation

### Changes to `parseCSV` function

**Location:** `index.js:42-74`

**Current behavior:**
- Expects hardcoded column name "LinkedIn Profile"
- Throws error if column doesn't exist

**New behavior:**
1. Parse CSV into records (unchanged)
2. Get all column headers from first record
3. Loop through each column name
4. For each column, check if any row values contain "linkedin.com" (case-insensitive)
5. Use the first matching column name
6. Extract and deduplicate URLs from that column (existing logic)

### Detection Logic

**Pattern matching:**
- Simple string contains check for "linkedin.com"
- Case-insensitive to catch variations
- Covers all LinkedIn URL formats:
  - `https://www.linkedin.com/in/username`
  - `linkedin.com/company/companyname`
  - `http://linkedin.com/in/profile`

**Algorithm:**
```
for each column_name in headers:
  for each row in records:
    if row[column_name] contains "linkedin.com":
      return column_name
throw error if no column found
```

### Error Messages

**Current:**
- `'CSV must contain "LinkedIn Profile" column'`

**New:**
- `'No column containing LinkedIn URLs found. Please ensure your CSV has LinkedIn profile links.'` - when no column has LinkedIn URLs
- Keep existing: `'CSV file is empty'`
- Keep existing: `'No LinkedIn URLs found in CSV after dedup'`

### Logging

Add trace log when column is detected:
```javascript
console.log(`[TRACE] Auto-detected LinkedIn column: "${columnName}"`)
```

This helps debugging and provides transparency about which column was selected.

## Testing Considerations

- CSV with "LinkedIn Profile" column (current format) - should work unchanged
- CSV with "Profile URL" column - should auto-detect
- CSV with "Link" column containing LinkedIn URLs - should auto-detect
- CSV with no LinkedIn URLs - should throw clear error
- CSV with LinkedIn URLs in multiple columns - uses first match
- Empty CSV - existing error handling covers this

## Files Modified

- `index.js` - `parseCSV` function only
