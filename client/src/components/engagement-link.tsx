import { useState } from "react";
import { useLocation } from "wouter";
import { useWorkspace } from "@/lib/workspace-context";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Loader2 } from "lucide-react";

interface EngagementLinkProps {
  engagementId: string;
  engagementCode: string;
  clientId?: string;
  className?: string;
}

export function EngagementLink({
  engagementId,
  engagementCode,
  clientId,
  className = "",
}: EngagementLinkProps) {
  const [, navigate] = useLocation();
  const { switchToClient, switchToEngagement } = useWorkspace();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/engagements/${engagementId}/resume`);

      if (response.ok) {
        const data = await response.json();
        
        if (data.clientId) {
          switchToClient(data.clientId);
        } else if (clientId) {
          switchToClient(clientId);
        }
        
        switchToEngagement(engagementId, false);
        
        navigate(`/workspace/${engagementId}/pre-planning`);
      } else if (response.status === 404) {
        const startResponse = await fetchWithAuth(`/api/engagements/${engagementId}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (startResponse.ok) {
          const startData = await startResponse.json();
          
          if (startData.clientId) {
            switchToClient(startData.clientId);
          } else if (clientId) {
            switchToClient(clientId);
          }
          
          switchToEngagement(engagementId, false);
          navigate(`/workspace/${engagementId}/pre-planning`);
        } else {
          throw new Error("Failed to start engagement");
        }
      } else if (response.status === 403) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this engagement.",
          variant: "destructive",
        });
      } else {
        throw new Error("Failed to open engagement");
      }
    } catch (error) {
      console.error("EngagementLink error:", error);
      if (clientId) switchToClient(clientId);
      switchToEngagement(engagementId, false);
      navigate(`/workspace/${engagementId}/pre-planning`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1 text-primary hover:underline hover:text-primary/80 font-medium cursor-pointer transition-colors disabled:opacity-50 ${className}`}
    >
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      {engagementCode}
    </button>
  );
}
