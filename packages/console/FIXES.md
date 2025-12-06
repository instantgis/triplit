# Triplit Console - Build Fixes

## Overview
This document describes the fixes applied to clean up build warnings and errors in the Triplit console.

---

## Issues Fixed

### 1. TypeScript Config Parsing Errors (Dev Server)

**Problem:**
```
Failed to parse tsconfig at templates/svelte/tsconfig.json
Failed to parse tsconfig at templates/vue/tsconfig.node.json
```

**Root Cause:**
- The `vite-tsconfig-paths` plugin was scanning the entire monorepo for tsconfig files
- Template directories contain intentionally incomplete configs that extend non-existent files:
  - `templates/svelte/tsconfig.json` extends `./.svelte-kit/tsconfig.json` (only exists after running SvelteKit)
  - `templates/vue/tsconfig.node.json` extends `@tsconfig/node20/tsconfig.json` (not in console's node_modules)

**Fix:**
Limited the plugin to only scan the console's own tsconfig:

```typescript
// packages/console/vite.config.ts
tsconfigPaths({
  projects: ['./tsconfig.json'],
})
```

**Result:** ✅ Clean dev server startup with no parsing errors

---

### 2. Sourcemap Warnings (Production Build)

**Problem:**
```
../ui/src/components/ui/label.tsx (1:0) Error when using sourcemap for reporting an error: 
Can't resolve original location of error.
```
(Repeated for 16 different UI components)

**Root Cause:**
- The `@triplit/ui` package exports raw TypeScript source files (no build step)
- It imports Radix UI components that have sourcemaps pointing to original source files
- Those source files don't exist in the monorepo, causing resolution errors during build

**Fix:**
Suppressed sourcemap errors from dependencies:

```typescript
// packages/console/vite.config.ts
build: {
  sourcemap: false,
  rollupOptions: {
    onwarn(warning, warn) {
      if (warning.code === 'SOURCEMAP_ERROR') return;
      warn(warning);
    },
  },
}
```

**Result:** ✅ Clean production build with no sourcemap warnings

---

### 3. Outdated Browserslist Database

**Problem:**
```
Browserslist: caniuse-lite is outdated. Please run:
  npx update-browserslist-db@latest
```

**Root Cause:**
- The `caniuse-lite` package (browser compatibility database) was outdated
- Browserslist nags you to update it

**Fix:**
```bash
npx update-browserslist-db@latest
```

**Result:** ✅ Updated to version 1.0.30001757, no more warnings

---

## Files Modified

### `packages/console/vite.config.ts`
- Added `projects: ['./tsconfig.json']` to `tsconfigPaths()` plugin
- Added `build.sourcemap: false`
- Added `build.rollupOptions.onwarn()` to suppress `SOURCEMAP_ERROR`

### `packages/console/vite.config.components.ts`
- Added `projects: ['./tsconfig.json']` to `tsconfigPaths()` plugin

### Root `package.json` (via package manager)
- Updated `caniuse-lite` to latest version

---

## Build Output Comparison

### Before:
```
Failed to parse tsconfig at templates/svelte/tsconfig.json
Failed to parse tsconfig at templates/vue/tsconfig.node.json
vite v5.1.5 building for production...
../ui/src/components/ui/label.tsx (1:0) Error when using sourcemap...
../ui/src/components/ui/combobox.tsx (1:0) Error when using sourcemap...
[... 14 more sourcemap errors ...]
✓ built in 15.23s
Browserslist: caniuse-lite is outdated...
```

### After:
```
VITE v5.1.5  ready in 495 ms
➜  Local:   http://localhost:5173/

vite v5.1.5 building for production...
✓ 7415 modules transformed.
✓ built in 10.98s
```

---

## Why These Issues Existed

1. **Cargo-cult programming** - The `vite-tsconfig-paths` plugin was likely copy-pasted from a template without understanding its behavior
2. **Warning fatigue** - Developers ignored non-fatal warnings because "it works"
3. **No CI enforcement** - No build step that treats warnings as errors
4. **Monorepo complexity** - Template projects with broken configs got scanned unintentionally

---

## Remaining Warnings (Expected)

```
(!) Some chunks are larger than 500 kB after minification.
```

This is expected for an admin panel with heavy UI dependencies (Radix UI, React Router, etc.). 
The 856KB bundle is acceptable for a self-hosted admin interface.

To fix this, you'd need to implement code-splitting with dynamic imports, but it's not necessary for this use case.

---

## Deployment Notes

The console is now ready for deployment with:
- ✅ Clean dev server output
- ✅ Clean production builds
- ✅ No runtime errors
- ✅ Netlify config already exists (`netlify.toml`)

See `netlify.toml` for deployment configuration.

