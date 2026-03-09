import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileSpreadsheet, Database, TrendingUp, ArrowRight, 
  ExternalLink, Calendar, Hash, DollarSign 
} from "lucide-react";

export interface GLSourceEntry {
  id: string;
  date: string;
  journalRef: string;
  description: string;
  debit: number;
  credit: number;
  accountCode: string;
  accountName: string;
}

export interface TBSourceEntry {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
  fsLine: string;
}

interface SourceDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceType: "gl-to-tb" | "tb-to-fs";
  title: string;
  subtitle?: string;
  glEntries?: GLSourceEntry[];
  tbEntries?: TBSourceEntry[];
  totalAmount?: number;
  isLoading?: boolean;
}

export function SourceDrilldownModal({
  isOpen,
  onClose,
  sourceType,
  title,
  subtitle,
  glEntries = [],
  tbEntries = [],
  totalAmount,
  isLoading = false
}: SourceDrilldownModalProps) {
  const [activeTab, setActiveTab] = useState<string>("entries");
  
  const hasEntries = sourceType === "gl-to-tb" ? glEntries.length > 0 : tbEntries.length > 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const totalDebits = sourceType === "gl-to-tb" 
    ? glEntries.reduce((sum, e) => sum + e.debit, 0)
    : tbEntries.reduce((sum, e) => sum + e.debit, 0);
    
  const totalCredits = sourceType === "gl-to-tb"
    ? glEntries.reduce((sum, e) => sum + e.credit, 0)
    : tbEntries.reduce((sum, e) => sum + e.credit, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {sourceType === "gl-to-tb" ? (
              <>
                <Database className="h-5 w-5 text-blue-600" />
                <span>GL Source Entries</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                <span className="text-muted-foreground">TB Line</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                <span>TB Source Lines</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <span className="text-muted-foreground">FS Caption</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {title}
            {subtitle && <span className="block text-xs mt-1">{subtitle}</span>}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="entries">
              {sourceType === "gl-to-tb" ? "GL Entries" : "TB Line Items"}
              <Badge variant="outline" className="ml-2">
                {sourceType === "gl-to-tb" ? glEntries.length : tbEntries.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="entries" className="mt-4">
            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading source entries...</p>
                  </div>
                </div>
              ) : !hasEntries ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="text-center">
                    <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">No Source Entries Found</p>
                    <p className="text-sm text-muted-foreground">
                      {sourceType === "gl-to-tb" 
                        ? "No General Ledger entries are available for this account. This may indicate the GL data has not been uploaded yet."
                        : "No Trial Balance accounts are mapped to this Financial Statement line item."}
                    </p>
                  </div>
                </div>
              ) : sourceType === "gl-to-tb" ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead className="w-[100px]">Journal Ref</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {glEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {entry.date}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <div className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {entry.journalRef}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{entry.description}</TableCell>
                        <TableCell className="text-right font-medium text-green-700">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-700">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={3} className="text-right">Total</TableCell>
                      <TableCell className="text-right text-green-700">{formatCurrency(totalDebits)}</TableCell>
                      <TableCell className="text-right text-red-700">{formatCurrency(totalCredits)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Account Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tbEntries.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs">{entry.accountCode}</TableCell>
                        <TableCell className="text-sm">{entry.accountName}</TableCell>
                        <TableCell className="text-right font-medium text-green-700">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-700">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(entry.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={2} className="text-right">Total</TableCell>
                      <TableCell className="text-right text-green-700">{formatCurrency(totalDebits)}</TableCell>
                      <TableCell className="text-right text-red-700">{formatCurrency(totalCredits)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(tbEntries.reduce((sum, e) => sum + e.balance, 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="summary" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Source Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Total Entries:</span>
                    <span className="font-medium">
                      {sourceType === "gl-to-tb" ? glEntries.length : tbEntries.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Total Debits:</span>
                    <span className="font-medium text-green-700">{formatCurrency(totalDebits)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Total Credits:</span>
                    <span className="font-medium text-red-700">{formatCurrency(totalCredits)}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Target Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Line Item:</span>
                    <span className="font-medium truncate max-w-[200px]">{title}</span>
                  </div>
                  {totalAmount !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-sm">Mapped Amount:</span>
                      <span className="font-semibold">{formatCurrency(totalAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm">Net Balance:</span>
                    <span className="font-semibold">{formatCurrency(totalDebits - totalCredits)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-800">
                <strong>ISA 230 Audit Trail:</strong> This drill-down provides complete traceability from 
                {sourceType === "gl-to-tb" 
                  ? " General Ledger entries to Trial Balance line items"
                  : " Trial Balance accounts to Financial Statement captions"
                }, supporting audit evidence requirements.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
