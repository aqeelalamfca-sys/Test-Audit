import * as React from "react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

interface FormLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  centered?: boolean;
}

const widthMap = {
  sm: "max-w-[600px]",
  md: "max-w-[768px]",
  lg: "max-w-[900px]",
  xl: "max-w-[1100px]",
  full: "max-w-full",
};

const FormLayout = React.forwardRef<HTMLDivElement, FormLayoutProps>(
  ({ className, maxWidth = "lg", centered = true, children, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="form-layout"
      className={cn(
        "w-full px-3 sm:px-3 py-2",
        widthMap[maxWidth],
        centered && "mx-auto",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
FormLayout.displayName = "FormLayout"

interface FormSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

const FormSection = React.forwardRef<HTMLDivElement, FormSectionProps>(
  ({ className, title, description, icon, children, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="form-section"
      className={cn("space-y-2.5", className)}
      {...props}
    >
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              {icon}
              {title}
            </h3>
          )}
          {description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  )
)
FormSection.displayName = "FormSection"

const FormDivider = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <Separator className={cn("my-2", className)} {...props} />
)
FormDivider.displayName = "FormDivider"

interface FormRowProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4;
}

const colsMap = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

const FormRow = React.forwardRef<HTMLDivElement, FormRowProps>(
  ({ className, cols = 2, children, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="form-row"
      className={cn(
        "grid gap-3",
        colsMap[cols],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
FormRow.displayName = "FormRow"

interface FormActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  sticky?: boolean;
}

const FormActions = React.forwardRef<HTMLDivElement, FormActionsProps>(
  ({ className, sticky = false, children, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="form-actions"
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2.5",
        sticky && "sticky bottom-0 bg-background pb-2.5 border-t border-border/50 -mx-3 sm:-mx-4 px-3 sm:px-3 z-10",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
FormActions.displayName = "FormActions"

export { FormLayout, FormSection, FormDivider, FormRow, FormActions }
