import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { useParams } from "wouter";
import { useEngagement } from "@/lib/workspace-context";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { getClientDocxLogoParagraph } from "@/lib/docx-logo";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ClipboardCheck,
  UserCheck,
  FileText,
  CheckCircle2,
  Save,
  X,
  Plus,
  Loader2,
  Upload,
  FileDown,
  ExternalLink,
  Paperclip,
} from "lucide-react";
import { SectionAttachments } from "./section-attachments";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import type { TeamDeclaration } from "./shared-types";

const IndependenceTab = forwardRef<{ save: () => Promise<void> }>((props, ref) => {
  const { toast } = useToast();
  const { engagementId } = useParams();
  const { engagement, client } = useEngagement();
  const { firm } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingForId, setUploadingForId] = useState<string | null>(null);

  const [teamDeclarations, setTeamDeclarations] = useState<TeamDeclaration[]>([
    { id: "td-1", memberName: "Muhammad Ali", role: "Engagement Partner", declarationDate: "", status: "Pending" },
    { id: "td-2", memberName: "Sarah Ahmed", role: "Engagement Manager", declarationDate: "", status: "Pending" },
    { id: "td-3", memberName: "Ahmed Khan", role: "Senior", declarationDate: "", status: "Pending" },
  ]);

  const generateDeclarationWord = async (declaration: TeamDeclaration) => {
    const clientName = client?.name || "Client";
    const engagementCode = engagement?.engagementCode || "ENG-001";
    const fiscalYear = engagement?.fiscalYearEnd || new Date().getFullYear().toString();

    const logoParagraph = await getClientDocxLogoParagraph(firm?.logoUrl);

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          ...(logoParagraph ? [logoParagraph] : []),
          new Paragraph({
            children: [
              new TextRun({
                text: "INDEPENDENCE DECLARATION",
                bold: true,
                size: 32,
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Engagement Details",
                bold: true,
                size: 24,
              }),
            ],
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Client Name: ", bold: true }),
              new TextRun({ text: clientName }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Engagement ID: ", bold: true }),
              new TextRun({ text: engagementCode }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Fiscal Year: ", bold: true }),
              new TextRun({ text: fiscalYear }),
            ],
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Team Member Information",
                bold: true,
                size: 24,
              }),
            ],
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Name: ", bold: true }),
              new TextRun({ text: declaration.memberName }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Role: ", bold: true }),
              new TextRun({ text: declaration.role }),
            ],
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Declaration",
                bold: true,
                size: 24,
              }),
            ],
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `I hereby confirm that I am independent of ${clientName} and have no financial, personal, or business relationships that would impair my objectivity in performing audit services.`,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Additional Declarations:", bold: true }),
            ],
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "• I have read and understand the firm's independence policies" }),
            ],
            bullet: { level: 0 },
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "• I have disclosed all potential conflicts of interest" }),
            ],
            bullet: { level: 0 },
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "• I will immediately report any changes to my independence status" }),
            ],
            bullet: { level: 0 },
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Signature",
                bold: true,
                size: 24,
              }),
            ],
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Date: ________________________" }),
            ],
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Signature: ________________________" }),
            ],
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Name: ${declaration.memberName}` }),
            ],
            spacing: { after: 100 },
          }),
        ],
      }],
    });

    try {
      const blob = await Packer.toBlob(doc);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const sanitizedName = declaration.memberName.replace(/[^a-zA-Z0-9]/g, "_");
      link.download = `Independence_Declaration_${sanitizedName}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({ title: "Download Started", description: `Declaration for ${declaration.memberName} is downloading.` });
    } catch (error) {
      console.error("Failed to generate Word document:", error);
      toast({ title: "Error", description: "Failed to generate declaration document", variant: "destructive" });
    }
  };

  const handleUploadSignedDeclaration = (id: string) => {
    setUploadingForId(id);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingForId) {
      setTeamDeclarations(declarations =>
        declarations.map(d =>
          d.id === uploadingForId
            ? {
                ...d,
                uploadedDocument: {
                  fileName: file.name,
                  uploadedAt: new Date().toISOString(),
                },
              }
            : d
        )
      );
      toast({
        title: "Document Uploaded",
        description: `Signed declaration "${file.name}" has been attached.`,
      });
      setUploadingForId(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetchWithAuth(`/api/workspace/${engagementId}/pre-planning`);
        if (response.ok) {
          const result = await response.json();
          if (result.data?.independence?.teamDeclarations) {
            setTeamDeclarations(result.data.independence.teamDeclarations);
          }
        }
      } catch (error) {
        console.error("Failed to load independence data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [engagementId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const loadResponse = await fetchWithAuth(`/api/workspace/${engagementId}/pre-planning`);
      const existingData = loadResponse.ok ? (await loadResponse.json()).data || {} : {};
      
      const dataToSave = {
        ...existingData,
        independence: {
          ...existingData.independence,
          teamDeclarations
        }
      };
      
      const response = await fetchWithAuth(`/api/workspace/${engagementId}/pre-planning`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      });
      
      if (response.ok) {
        toast({ title: "Saved", description: "Independence declarations saved successfully" });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save independence data", variant: "destructive" });
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({
    save: async () => {
      await handleSave();
    }
  }));

  const handleMarkReceived = (id: string) => {
    setTeamDeclarations(declarations => 
      declarations.map(d => 
        d.id === id 
          ? { ...d, status: "Received" as const, declarationDate: new Date().toISOString().split("T")[0] } 
          : d
      )
    );
    toast({ title: "Updated", description: "Declaration marked as received" });
  };

  const addTeamMember = () => {
    const newMember: TeamDeclaration = {
      id: `td-custom-${Date.now()}`,
      memberName: "",
      role: "",
      declarationDate: "",
      status: "Pending"
    };
    setTeamDeclarations(prev => [...prev, newMember]);
  };

  const updateTeamMember = (id: string, field: keyof TeamDeclaration, value: any) => {
    setTeamDeclarations(declarations => 
      declarations.map(d => d.id === id ? { ...d, [field]: value } : d)
    );
  };

  const removeTeamMember = (id: string) => {
    setTeamDeclarations(declarations => declarations.filter(d => d.id !== id));
  };

  const handleNavigateToChecklist = () => {
    const checklistTab = document.querySelector('[data-testid="tab-checklist"]') as HTMLButtonElement;
    if (checklistTab) checklistTab.click();
  };

  const receivedCount = teamDeclarations.filter(d => d.status === "Received").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Declaration of Independence
          </CardTitle>
          <CardDescription>
            Obtain formal written independence confirmations from the engagement team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Team Independence Declarations</h4>
            <Button variant="outline" size="sm" onClick={addTeamMember}>
              <Plus className="h-4 w-4 mr-1" />Add Team Member
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Declaration Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamDeclarations.map(declaration => (
                <TableRow key={declaration.id}>
                  <TableCell>
                    <Input 
                      value={declaration.memberName} 
                      onChange={(e) => updateTeamMember(declaration.id, "memberName", e.target.value)}
                      placeholder="Enter name"
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      value={declaration.role} 
                      onChange={(e) => updateTeamMember(declaration.id, "role", e.target.value)}
                      placeholder="Enter role"
                    />
                  </TableCell>
                  <TableCell>
                    {declaration.declarationDate || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={`${
                        declaration.status === "Received" ? "text-green-600" : 
                        declaration.status === "Overdue" ? "text-red-600" : 
                        "text-orange-600"
                      }`}
                    >
                      {declaration.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => generateDeclarationWord(declaration)}
                        data-testid={`button-download-declaration-${declaration.id}`}
                      >
                        <FileDown className="h-4 w-4 mr-1" />
                        Download Declaration
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleUploadSignedDeclaration(declaration.id)}
                        data-testid={`button-upload-signed-${declaration.id}`}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Upload Signed
                      </Button>
                      {declaration.uploadedDocument && (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          {declaration.uploadedDocument.fileName}
                        </Badge>
                      )}
                      {declaration.status === "Pending" && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleMarkReceived(declaration.id)}
                        >
                          Mark Received
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeTeamMember(declaration.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
            <CardContent className="py-4">
              <h4 className="font-semibold text-blue-800 dark:text-blue-400 mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Declaration Requirements
              </h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Name, role, date of confirmation, and signature of each team member</li>
                <li>• Confirmation of no prohibited financial/personal relationships</li>
                <li>• Acknowledgment of independence policies and consequences of breach</li>
              </ul>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <Card className="bg-muted/30">
              <CardContent className="py-3 text-center">
                <p className="text-2xl font-bold text-primary">{teamDeclarations.length}</p>
                <p className="text-xs text-muted-foreground">Team Members</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-950/20">
              <CardContent className="py-3 text-center">
                <p className="text-2xl font-bold text-green-600">{receivedCount}</p>
                <p className="text-xs text-muted-foreground">Received</p>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="py-3 text-center">
                <p className="text-2xl font-bold text-orange-600">{teamDeclarations.length - receivedCount}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Independence Confirmation Checklist</p>
                <p className="text-sm text-muted-foreground">Complete the detailed independence verification in the Checklist tab</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleNavigateToChecklist} data-testid="button-view-independence-checklist">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Full Checklist
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Independence Declarations
          </CardTitle>
          <CardDescription>Upload signed independence declarations, non-audit services disclosure, and related documentation</CardDescription>
        </CardHeader>
        <CardContent>
          <SectionAttachments
            sectionId="tab5-independence-docs"
            engagementId={engagementId || ""}
            maxFiles={20}
            suggestedDocuments={[
              { name: "Signed independence declaration" },
              { name: "Non-audit services disclosure" },
              { name: "Financial interests disclosure" },
              { name: "Partner rotation schedule" },
              { name: "Independence confirmation form" },
            ]}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? "Saving..." : "Save Progress"}
        </Button>
      </div>

      <input 
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFileChange}
      />
    </div>
  );
});

IndependenceTab.displayName = "IndependenceTab";

export default IndependenceTab;
