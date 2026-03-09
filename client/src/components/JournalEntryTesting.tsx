import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Plus, FileText, AlertTriangle, CheckCircle2, Clock, Brain, 
  RefreshCw, Target, Filter, Search, Upload, Download, Trash2
} from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { formatAccounting } from "@/lib/formatters";

interface JournalEntryTestItem {
  id: string;
  jeNumber: string;
  jeDate: string;
  entryType: string;
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  description: string;
  preparedBy: string;
  approvedBy: string;
  testingPerformed: string;
  evidenceObtained: string;
  isException: boolean;
  exceptionDescription: string;
  conclusion: string;
}

interface JournalEntryTest {
  id: string;
  workpaperRef: string;
  testingPeriod: string;
  populationSource: string;
  populationSize: number;
  populationValueTotal: number;
  selectionCriteria: any;
  samplingMethod: string;
  sampleSize: number;
  riskFactorsConsidered: string[];
  fraudIndicatorsUsed: string[];
  status: string;
  conclusion: string;
  exceptionsIdentified: number;
  performedById: string;
  performedAt: string;
  reviewedById: string;
  reviewedAt: string;
  testItems: JournalEntryTestItem[];
}

interface JournalEntryTestingProps {
  engagementId: string;
}

const ENTRY_TYPES = [
  { value: "STANDARD", label: "Standard Entry" },
  { value: "MANUAL", label: "Manual Entry" },
  { value: "PERIOD_END", label: "Period-End Entry" },
  { value: "POST_CLOSING", label: "Post-Closing Entry" },
  { value: "THIRTEENTH_MONTH", label: "13th Month Entry" },
  { value: "REVERSING", label: "Reversing Entry" },
  { value: "ADJUSTMENT", label: "Adjustment Entry" },
  { value: "OVERRIDE", label: "Override Entry" },
];

const FRAUD_INDICATORS = [
  "Unusual timing (after hours, weekends)",
  "Round numbers or just below thresholds",
  "Posted to unusual accounts",
  "Made by personnel outside normal duties",
  "Entries with little or no explanation",
  "Entries to seldom-used accounts",
  "Entries affecting related parties",
  "Entries reversing soon after period end",
];

const RISK_FACTORS = [
  "Revenue recognition risk",
  "Management override of controls",
  "High-value transactions",
  "Unusual account combinations",
  "Entries outside normal process",
  "Related party transactions",
  "Period-end adjustments",
];

export function JournalEntryTesting({ engagementId }: JournalEntryTestingProps) {
  const [tests, setTests] = useState<JournalEntryTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState<JournalEntryTest | null>(null);
  const [showNewTestDialog, setShowNewTestDialog] = useState(false);
  const [showNewItemDialog, setShowNewItemDialog] = useState(false);
  const [entryTypeFilter, setEntryTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [newTest, setNewTest] = useState({
    testingPeriod: "",
    populationSource: "",
    populationSize: 0,
    samplingMethod: "RANDOM",
    sampleSize: 0,
    riskFactorsConsidered: [] as string[],
    fraudIndicatorsUsed: [] as string[],
  });

  const [newItem, setNewItem] = useState({
    jeNumber: "",
    jeDate: "",
    entryType: "STANDARD",
    accountCode: "",
    accountName: "",
    debitAmount: 0,
    creditAmount: 0,
    description: "",
    preparedBy: "",
    approvedBy: "",
    testingPerformed: "",
    evidenceObtained: "",
    isException: false,
    exceptionDescription: "",
    conclusion: "",
  });

  useEffect(() => {
    fetchTests();
  }, [engagementId]);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`/api/qcr/journal-tests/${engagementId}`);
      if (res.ok) {
        const data = await res.json();
        setTests(data);
        if (data.length > 0 && !selectedTest) {
          setSelectedTest(data[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching journal tests:", error);
    } finally {
      setLoading(false);
    }
  };

  const createTest = async () => {
    try {
      const res = await fetchWithAuth(`/api/qcr/journal-tests/${engagementId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTest),
      });
      if (res.ok) {
        const created = await res.json();
        setTests([...tests, { ...created, testItems: [] }]);
        setSelectedTest({ ...created, testItems: [] });
        setShowNewTestDialog(false);
        setNewTest({
          testingPeriod: "",
          populationSource: "",
          populationSize: 0,
          samplingMethod: "RANDOM",
          sampleSize: 0,
          riskFactorsConsidered: [],
          fraudIndicatorsUsed: [],
        });
      }
    } catch (error) {
      console.error("Error creating journal test:", error);
    }
  };

  const createTestItem = async () => {
    if (!selectedTest) return;
    try {
      const res = await fetchWithAuth(`/api/qcr/journal-test-items/${selectedTest.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });
      if (res.ok) {
        const created = await res.json();
        const updatedTest = {
          ...selectedTest,
          testItems: [...selectedTest.testItems, created],
          exceptionsIdentified: newItem.isException 
            ? selectedTest.exceptionsIdentified + 1 
            : selectedTest.exceptionsIdentified,
        };
        setSelectedTest(updatedTest);
        setTests(tests.map(t => t.id === selectedTest.id ? updatedTest : t));
        setShowNewItemDialog(false);
        setNewItem({
          jeNumber: "",
          jeDate: "",
          entryType: "STANDARD",
          accountCode: "",
          accountName: "",
          debitAmount: 0,
          creditAmount: 0,
          description: "",
          preparedBy: "",
          approvedBy: "",
          testingPerformed: "",
          evidenceObtained: "",
          isException: false,
          exceptionDescription: "",
          conclusion: "",
        });
      }
    } catch (error) {
      console.error("Error creating test item:", error);
    }
  };

  const filteredItems = selectedTest?.testItems.filter(item => {
    const matchesType = entryTypeFilter === "all" || item.entryType === entryTypeFilter;
    const matchesSearch = searchTerm === "" || 
      item.jeNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  }) || [];

  const getTestSummary = () => {
    if (!selectedTest) return null;
    const items = selectedTest.testItems || [];
    return {
      totalTested: items.length,
      exceptions: items.filter(i => i.isException).length,
      standardEntries: items.filter(i => i.entryType === "STANDARD").length,
      manualEntries: items.filter(i => i.entryType === "MANUAL").length,
      periodEndEntries: items.filter(i => i.entryType === "PERIOD_END").length,
      thirteenthMonthEntries: items.filter(i => i.entryType === "THIRTEENTH_MONTH").length,
      totalDebits: items.reduce((sum, i) => sum + (Number(i.debitAmount) || 0), 0),
      totalCredits: items.reduce((sum, i) => sum + (Number(i.creditAmount) || 0), 0),
    };
  };

  const summary = getTestSummary();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading journal entry tests...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Journal Entry Testing
          </h2>
          <p className="text-sm text-muted-foreground">
            ISA 240 / ISA 330 - Test journal entries for fraud risk indicators
          </p>
        </div>
        <Dialog open={showNewTestDialog} onOpenChange={setShowNewTestDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Test
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Journal Entry Test</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Testing Period</Label>
                <Input 
                  placeholder="e.g., FY 2024"
                  value={newTest.testingPeriod}
                  onChange={(e) => setNewTest({...newTest, testingPeriod: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Population Source</Label>
                <Input 
                  placeholder="e.g., General Ledger"
                  value={newTest.populationSource}
                  onChange={(e) => setNewTest({...newTest, populationSource: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Population Size</Label>
                <Input 
                  type="number"
                  value={newTest.populationSize}
                  onChange={(e) => setNewTest({...newTest, populationSize: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>Sample Size</Label>
                <Input 
                  type="number"
                  value={newTest.sampleSize}
                  onChange={(e) => setNewTest({...newTest, sampleSize: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>Sampling Method</Label>
                <Select value={newTest.samplingMethod} onValueChange={(v) => setNewTest({...newTest, samplingMethod: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RANDOM">Random</SelectItem>
                    <SelectItem value="SYSTEMATIC">Systematic</SelectItem>
                    <SelectItem value="HAPHAZARD">Haphazard</SelectItem>
                    <SelectItem value="JUDGMENTAL">Judgmental</SelectItem>
                    <SelectItem value="MONETARY_UNIT">Monetary Unit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="mb-2 block">Risk Factors Considered</Label>
                <div className="grid grid-cols-2 gap-2">
                  {RISK_FACTORS.map(factor => (
                    <div key={factor} className="flex items-center space-x-2">
                      <Checkbox
                        id={factor}
                        checked={newTest.riskFactorsConsidered.includes(factor)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewTest({...newTest, riskFactorsConsidered: [...newTest.riskFactorsConsidered, factor]});
                          } else {
                            setNewTest({...newTest, riskFactorsConsidered: newTest.riskFactorsConsidered.filter(f => f !== factor)});
                          }
                        }}
                      />
                      <label htmlFor={factor} className="text-sm">{factor}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <Label className="mb-2 block">Fraud Indicators Used</Label>
                <div className="grid grid-cols-2 gap-2">
                  {FRAUD_INDICATORS.map(indicator => (
                    <div key={indicator} className="flex items-center space-x-2">
                      <Checkbox
                        id={indicator}
                        checked={newTest.fraudIndicatorsUsed.includes(indicator)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewTest({...newTest, fraudIndicatorsUsed: [...newTest.fraudIndicatorsUsed, indicator]});
                          } else {
                            setNewTest({...newTest, fraudIndicatorsUsed: newTest.fraudIndicatorsUsed.filter(f => f !== indicator)});
                          }
                        }}
                      />
                      <label htmlFor={indicator} className="text-sm">{indicator}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={createTest}>Create Test</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {tests.length === 0 ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Journal Entry Tests</AlertTitle>
          <AlertDescription>
            Create a new journal entry test to begin testing per ISA 240 requirements.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-1 space-y-2">
            <Label>Select Test</Label>
            {tests.map(test => (
              <Card 
                key={test.id}
                className={`cursor-pointer transition-all ${selectedTest?.id === test.id ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/50"}`}
                onClick={() => setSelectedTest(test)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{test.workpaperRef}</span>
                    <Badge variant={test.status === "APPROVED" ? "default" : test.status === "REVIEWED" ? "secondary" : "outline"}>
                      {test.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{test.testingPeriod}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <span>Items: {test.testItems?.length || 0}</span>
                    {test.exceptionsIdentified > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {test.exceptionsIdentified} exceptions
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="col-span-3 space-y-4">
            {selectedTest && (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Sample Size</p>
                          <p className="text-lg font-bold">{summary?.totalTested || 0} / {selectedTest.sampleSize}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={summary?.exceptions && summary.exceptions > 0 ? "border-red-200 bg-red-50" : ""}>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Exceptions</p>
                          <p className="text-lg font-bold text-red-600">{summary?.exceptions || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Total Debits</p>
                          <p className="text-lg font-bold">{formatAccounting(summary?.totalDebits || 0)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Total Credits</p>
                          <p className="text-lg font-bold">{formatAccounting(summary?.totalCredits || 0)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Test Items</CardTitle>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search..."
                            className="pl-8 w-48"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        <Select value={entryTypeFilter} onValueChange={setEntryTypeFilter}>
                          <SelectTrigger className="w-40">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {ENTRY_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Dialog open={showNewItemDialog} onOpenChange={setShowNewItemDialog}>
                          <DialogTrigger asChild>
                            <Button size="sm" className="gap-1">
                              <Plus className="h-4 w-4" />
                              Add Entry
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Add Journal Entry Test Item</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label>JE Number</Label>
                                <Input 
                                  value={newItem.jeNumber}
                                  onChange={(e) => setNewItem({...newItem, jeNumber: e.target.value})}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>JE Date</Label>
                                <Input 
                                  type="date"
                                  value={newItem.jeDate}
                                  onChange={(e) => setNewItem({...newItem, jeDate: e.target.value})}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Entry Type</Label>
                                <Select value={newItem.entryType} onValueChange={(v) => setNewItem({...newItem, entryType: v})}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ENTRY_TYPES.map(type => (
                                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Account Code</Label>
                                <Input 
                                  value={newItem.accountCode}
                                  onChange={(e) => setNewItem({...newItem, accountCode: e.target.value})}
                                />
                              </div>
                              <div className="space-y-2 col-span-2">
                                <Label>Account Name</Label>
                                <Input 
                                  value={newItem.accountName}
                                  onChange={(e) => setNewItem({...newItem, accountName: e.target.value})}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Debit Amount</Label>
                                <Input 
                                  type="number"
                                  value={newItem.debitAmount}
                                  onChange={(e) => setNewItem({...newItem, debitAmount: parseFloat(e.target.value) || 0})}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Credit Amount</Label>
                                <Input 
                                  type="number"
                                  value={newItem.creditAmount}
                                  onChange={(e) => setNewItem({...newItem, creditAmount: parseFloat(e.target.value) || 0})}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Prepared By</Label>
                                <Input 
                                  value={newItem.preparedBy}
                                  onChange={(e) => setNewItem({...newItem, preparedBy: e.target.value})}
                                />
                              </div>
                              <div className="space-y-2 col-span-3">
                                <Label>Description</Label>
                                <Input 
                                  value={newItem.description}
                                  onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                                />
                              </div>
                              <div className="space-y-2 col-span-3">
                                <Label>Testing Performed</Label>
                                <Textarea 
                                  rows={2}
                                  value={newItem.testingPerformed}
                                  onChange={(e) => setNewItem({...newItem, testingPerformed: e.target.value})}
                                  placeholder="Describe the testing procedures performed..."
                                />
                              </div>
                              <div className="space-y-2 col-span-3">
                                <Label>Evidence Obtained</Label>
                                <Textarea 
                                  rows={2}
                                  value={newItem.evidenceObtained}
                                  onChange={(e) => setNewItem({...newItem, evidenceObtained: e.target.value})}
                                  placeholder="Describe the audit evidence obtained..."
                                />
                              </div>
                              <div className="col-span-3 flex items-center space-x-2">
                                <Checkbox
                                  id="isException"
                                  checked={newItem.isException}
                                  onCheckedChange={(checked) => setNewItem({...newItem, isException: !!checked})}
                                />
                                <label htmlFor="isException" className="text-sm font-medium text-red-600">
                                  Mark as Exception
                                </label>
                              </div>
                              {newItem.isException && (
                                <div className="space-y-2 col-span-3">
                                  <Label className="text-red-600">Exception Description</Label>
                                  <Textarea 
                                    rows={2}
                                    value={newItem.exceptionDescription}
                                    onChange={(e) => setNewItem({...newItem, exceptionDescription: e.target.value})}
                                    placeholder="Describe the exception identified..."
                                    className="border-red-200"
                                  />
                                </div>
                              )}
                              <div className="space-y-2 col-span-3">
                                <Label>Conclusion</Label>
                                <Textarea 
                                  rows={2}
                                  value={newItem.conclusion}
                                  onChange={(e) => setNewItem({...newItem, conclusion: e.target.value})}
                                  placeholder="State the conclusion for this test item..."
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                              </DialogClose>
                              <Button onClick={createTestItem}>Add Entry</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredItems.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No journal entries tested yet</p>
                        <p className="text-sm">Click "Add Entry" to start testing</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-24">JE #</TableHead>
                              <TableHead className="w-24">Date</TableHead>
                              <TableHead className="w-32">Type</TableHead>
                              <TableHead>Account</TableHead>
                              <TableHead className="text-right w-28">Debit</TableHead>
                              <TableHead className="text-right w-28">Credit</TableHead>
                              <TableHead className="w-24">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredItems.map((item) => (
                              <TableRow key={item.id} className={item.isException ? "bg-red-50" : ""}>
                                <TableCell className="font-mono text-sm">{item.jeNumber}</TableCell>
                                <TableCell className="text-sm">
                                  {item.jeDate ? new Date(item.jeDate).toLocaleDateString() : "-"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {ENTRY_TYPES.find(t => t.value === item.entryType)?.label || item.entryType}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <span className="font-mono text-xs text-muted-foreground">{item.accountCode}</span>
                                    <p className="text-sm">{item.accountName}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {item.debitAmount ? item.debitAmount.toLocaleString() : "-"}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {item.creditAmount ? item.creditAmount.toLocaleString() : "-"}
                                </TableCell>
                                <TableCell>
                                  {item.isException ? (
                                    <Badge variant="destructive" className="gap-1">
                                      <AlertTriangle className="h-3 w-3" />
                                      Exception
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      OK
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-4 gap-4 text-sm">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-muted-foreground">Standard</p>
                      <p className="text-xl font-bold">{summary?.standardEntries || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-muted-foreground">Manual</p>
                      <p className="text-xl font-bold">{summary?.manualEntries || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-muted-foreground">Period-End</p>
                      <p className="text-xl font-bold">{summary?.periodEndEntries || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-muted-foreground">13th Month</p>
                      <p className="text-xl font-bold">{summary?.thirteenthMonthEntries || 0}</p>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default JournalEntryTesting;
