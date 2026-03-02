import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PhaseView() {
  const params = useParams();
  const phase = params.phase;

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight capitalize">{phase} Phase</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Engagements in {phase} Phase</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            View and manage all engagements currently in the {phase} phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
