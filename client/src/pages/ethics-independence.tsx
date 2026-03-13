import { useParams, Link } from "wouter";
import { useEngagement } from "@/lib/workspace-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Scale, AlertTriangle, CheckCircle2, FileText } from "lucide-react";

const checklistItems = [
  { id: "1", label: "Independence confirmation received from all team members", completed: false },
  { id: "2", label: "Client acceptance/continuance evaluation completed", completed: false },
  { id: "3", label: "AML/CFT risk assessment performed", completed: false },
  { id: "4", label: "Engagement letter signed and filed", completed: false },
  { id: "5", label: "Fee arrangement documented", completed: false },
  { id: "6", label: "Related party relationships identified", completed: false },
  { id: "7", label: "Potential conflicts of interest assessed", completed: false },
];

export default function EthicsIndependence() {
  const params = useParams<{ engagementId: string }>();
  const { 
    engagementId: contextEngagementId, 
    engagement, 
    client,
    refreshEngagement 
  } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;

  return (
    <div className="page-container">
      <div className="flex items-center gap-4">
        <Link href={`/workspace/${engagementId}/acceptance`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Acceptance
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Scale className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Ethics & Independence</h1>
            <p className="text-muted-foreground">
              {client?.name ? `${client.name} - ` : ""}ISA 200, IESBA Code of Ethics
              {engagement?.engagementCode && <span className="ml-2 text-xs opacity-70">({engagement.engagementCode})</span>}
            </p>
          </div>
        </div>
        <Badge variant="secondary">Not Started</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">0 / {checklistItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Independence & Ethics Checklist</CardTitle>
          <CardDescription>Complete all required items before proceeding</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {checklistItems.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <Checkbox id={item.id} checked={item.completed} />
                <label htmlFor={item.id} className="text-sm cursor-pointer">
                  {item.label}
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
