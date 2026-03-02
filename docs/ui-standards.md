# AuditWise UI Standards

This document defines the UI/UX standards for the AuditWise application to ensure consistency across all pages and components.

## Design System Foundation

### Design Tokens

Located at `client/src/lib/design-tokens.ts`, these define the single source of truth for:

- **Spacing**: xs (4px) → 3xl (48px)
- **Typography**: fontSize, fontWeight, lineHeight scales
- **Border Radius**: sm (4px) for most elements, md (6px) for cards
- **Shadows**: xs → lg for elevation
- **Z-Index**: base → toast (0 → 1080)
- **Status Colors**: pass/warn/fail/info/neutral

## Page Structure

### PageShell Component

Every page must use the `PageShell` component from `@/components/page-shell`:

```tsx
import { PageShell, PageSection } from "@/components/page-shell";

function MyPage() {
  return (
    <PageShell
      title="Page Title"
      subtitle="Optional description"
      icon={<FileText className="h-5 w-5 text-primary" />}
      metadata={[
        { label: "Client", value: "ABC Corp" },
        { label: "Status", value: "In Progress", status: "info" },
      ]}
      backHref="/previous-page"
      nextHref="/next-page"
      dashboardHref="/dashboard"
      saveFn={async () => {
        // Save logic
        return { ok: true };
      }}
      hasUnsavedChanges={isDirty}
      isSaving={isSaving}
    >
      <PageSection title="Section Title" actions={<Button>Action</Button>}>
        {/* Content */}
      </PageSection>
    </PageShell>
  );
}
```

### PageActionBar

The `PageActionBar` provides consistent navigation buttons:
- **Back**: Navigate to previous page (with unsaved changes confirmation)
- **Save Progress**: Save without navigation
- **Save & Next**: Save and navigate to next step
- **Save & Close**: Save and return to dashboard

Located at top AND bottom of every page.

## Status Indicators

### StatusBadge Component

Use `StatusBadge` from `@/components/ui/status-badge` for all status displays:

```tsx
import { StatusBadge, getAuditStatus } from "@/components/ui/status-badge";

// Direct usage
<StatusBadge status="pass">Balanced</StatusBadge>
<StatusBadge status="warn" count={5}>Exceptions</StatusBadge>
<StatusBadge status="fail" amount="$10,000">Variance</StatusBadge>

// Automatic status detection
<StatusBadge status={getAuditStatus("approved")}>Approved</StatusBadge>
```

### Status Types

| Status | Color | Use Case |
|--------|-------|----------|
| `pass` | Green | Balanced, Matched, Approved, Complete, Low Risk |
| `warn` | Amber | Partial, Pending, Medium Risk, Needs Review |
| `fail` | Red | Unbalanced, Mismatched, Rejected, High Risk |
| `info` | Blue | In Progress, Active, Information |
| `neutral` | Gray | Not Started, N/A |
| `pending` | Slate | Awaiting Action |

## Tables

### StandardTable Component

Use `StandardTable` from `@/components/ui/standard-table` for all data tables:

```tsx
import { StandardTable, Column, formatTableNumber } from "@/components/ui/standard-table";

const columns: Column<DataType>[] = [
  { key: "code", header: "Account Code", sortable: true },
  { key: "name", header: "Account Name" },
  { 
    key: "balance", 
    header: "Balance", 
    align: "right",
    accessor: (row) => formatTableNumber(row.balance, { currency: "PKR" })
  },
];

<StandardTable
  columns={columns}
  data={data}
  keyField="id"
  searchable
  searchFields={["code", "name"]}
  pagination
  pageSize={20}
  stickyHeader
  showTotals
  totalsRow={{ balance: formatTableNumber(totalBalance, { currency: "PKR" }) }}
  rowActions={[
    { label: "View", onClick: (row) => viewRow(row) },
    { label: "Delete", onClick: (row) => deleteRow(row), variant: "destructive" },
  ]}
  emptyTitle="No accounts found"
  emptyAction={<Button>Upload Data</Button>}
/>
```

### Table Features

- **Sorting**: Click column headers to sort
- **Search**: Built-in search with field filtering
- **Pagination**: Consistent pagination footer
- **Totals Row**: Formatted totals at bottom
- **Row Actions**: Kebab menu (⋮) for row operations
- **Loading**: Skeleton loading state
- **Empty State**: Consistent empty message with CTA

### Number Formatting

Always use `formatTableNumber()` for consistent number display:

```tsx
formatTableNumber(12345.67);                    // "12,345.67"
formatTableNumber(-12345.67);                   // "(12,345.67)"
formatTableNumber(12345.67, { currency: "PKR" }); // "PKR 12,345.67"
```

## Button Standards

### Button Naming

| Button | Usage |
|--------|-------|
| Save Progress | Save without navigation |
| Save & Next | Save and proceed to next step |
| Save & Close | Save and return to dashboard |
| Back | Navigate to previous page |
| Generate | Create outputs/reports |
| Export | Download as CSV/PDF/Word |

### Button Placement

- **Page-level actions**: Only in PageActionBar (top and bottom)
- **Section-level actions**: In Card/Section header (right side)
- **Row-level actions**: In kebab menu (⋮)

### Button Variants

```tsx
<Button variant="default">Primary Action</Button>
<Button variant="secondary">Secondary Action</Button>
<Button variant="outline">Tertiary Action</Button>
<Button variant="ghost">Subtle Action</Button>
<Button variant="destructive">Dangerous Action</Button>
```

## Forms

### Form Structure

```tsx
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

<FormField
  control={form.control}
  name="fieldName"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Field Label *</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Form Validation

- Required fields marked with asterisk (*)
- Errors displayed below fields
- Summary banner at top on submit failure
- Save blocked until validation passes

### Dirty State Tracking

All forms must track `hasUnsavedChanges`:
- Confirm dialog on Back/route change if dirty
- Auto-save indicator in header

## Layout Standards

### Sidebar

- Fixed width: 16rem (256px)
- Collapsible to 4rem (64px)
- Consistent icon set and grouping

### Header

- Height: 3.5rem (56px)
- Contains: Engagement identity, FY, status chip, autosave indicator

### Tabs

- Consistent position below header
- Same active indicator style
- Standard tab order for audit workflow:
  1. Information Requisition
  2. Pre-Planning
  3. Planning
  4. Execution
  5. FS Heads
  6. Evidence
  7. Finalization
  8. Deliverables
  9. QCR/Inspection

### Page Container

- Max width: 1400px
- Horizontal padding: 1.5rem (24px)
- Consistent vertical spacing between sections

## Empty States

Use `EmptyState` component for empty sections:

```tsx
import { EmptyState } from "@/components/page-shell";

<EmptyState
  icon={<FileText className="h-8 w-8 text-muted-foreground" />}
  title="No documents uploaded"
  description="Upload your first document to get started."
  action={<Button>Upload Document</Button>}
/>
```

## Loading States

Use `Skeleton` for loading states:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

<Skeleton className="h-4 w-[250px]" />
<Skeleton className="h-10 w-full" />
```

## Testing

All interactive elements must have `data-testid` attributes:

```tsx
<Button data-testid="btn-save">Save</Button>
<Input data-testid="input-email" />
<StatusBadge data-testid="status-badge-pass">Passed</StatusBadge>
```

Pattern: `{type}-{description}` or `{type}-{description}-{id}` for dynamic elements.

## Checklist for New Pages

- [ ] Uses PageShell with title, subtitle, metadata
- [ ] Has PageActionBar at top AND bottom
- [ ] All tables use StandardTable
- [ ] All status indicators use StatusBadge
- [ ] Forms track dirty state
- [ ] All interactive elements have data-testid
- [ ] Empty states have helpful messages and CTAs
- [ ] Loading states use Skeleton
- [ ] Numbers formatted consistently
- [ ] Button placement follows rules
