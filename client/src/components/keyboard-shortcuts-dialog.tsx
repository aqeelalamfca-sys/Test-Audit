import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Keyboard } from "lucide-react";
import { SHORTCUT_DEFINITIONS, getModKey, formatShortcut } from "@/hooks/use-keyboard-shortcuts";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function KbdKey({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded border border-border bg-muted text-[11px] font-mono font-medium text-muted-foreground shadow-sm">
      {children}
    </kbd>
  );
}

function ShortcutRow({ shortcut }: { shortcut: typeof SHORTCUT_DEFINITIONS[number] }) {
  const formatted = formatShortcut(shortcut);
  const parts = formatted.split(" + ");

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-foreground">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {parts.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-[10px] text-muted-foreground">+</span>}
            <KbdKey>{part}</KbdKey>
          </span>
        ))}
      </div>
    </div>
  );
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const categories = [...new Set(SHORTCUT_DEFINITIONS.map((s) => s.category))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-keyboard-shortcuts">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate faster. Press <KbdKey>{getModKey()}</KbdKey> <span className="text-[10px] text-muted-foreground">+</span> <KbdKey>Shift</KbdKey> <span className="text-[10px] text-muted-foreground">+</span> <KbdKey>?</KbdKey> anytime to open this panel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {categories.map((cat) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wide">
                  {cat}
                </Badge>
              </div>
              <div className="space-y-0 divide-y divide-border/50">
                {SHORTCUT_DEFINITIONS.filter((s) => s.category === cat).map((s, i) => (
                  <ShortcutRow key={i} shortcut={s} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground text-center pt-2 border-t">
          Workspace shortcuts (Alt + 1-8) are only active when you are inside an engagement.
        </p>
      </DialogContent>
    </Dialog>
  );
}
