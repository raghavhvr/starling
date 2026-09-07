import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { nestleizeAll } from "@/lib/nestleize";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Megaphone,
  Plus,
  Calendar,
  DollarSign,
  Target,
  ArrowRight,
  Trash2,
} from "lucide-react";

const statusStyles: Record<string, string> = {
  active: "bg-primary/20 text-primary border-primary/30",
  draft: "bg-muted text-muted-foreground border-border",
  completed: "bg-accent/20 text-accent border-accent/30",
  paused: "bg-destructive/20 text-destructive border-destructive/30",
};

export default function Campaigns() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return nestleizeAll(data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign deleted");
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = campaigns.filter((c) => c.status === "active");
  const drafts = campaigns.filter((c) => c.status === "draft");
  const completed = campaigns.filter((c) => c.status === "completed");

  return (
    <div className="min-h-full p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} · {active.length} active
          </p>
        </div>
        <Button
          onClick={() => navigate("/campaign")}
          className="font-data text-[10px] tracking-wider"
        >
          <Plus className="w-3 h-3 mr-1" /> NEW CAMPAIGN
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "ACTIVE", value: active.length, color: "text-primary", hint: "Campaigns currently in flight" },
          { label: "PLANNED", value: drafts.length, color: "text-muted-foreground", hint: "Briefs saved and scheduled — not yet launched" },
          { label: "COMPLETED", value: completed.length, color: "text-accent", hint: "Finished flights with final results and learnings recorded" },
        ].map((s) => (
          <div key={s.label} title={s.hint} className="border border-border p-4 bg-card">
            <span className="font-data text-[10px] tracking-wider text-muted-foreground">{s.label}</span>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Campaign list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted/30 animate-pulse border border-border" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border">
          <Megaphone className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm">No campaigns yet</p>
          <Button
            variant="outline"
            className="mt-4 font-data text-[10px] tracking-wider"
            onClick={() => navigate("/campaign")}
          >
            CREATE YOUR FIRST CAMPAIGN
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const budget = Number(c.budget) || 0;
            const spent = Number(c.spent) || 0;
            const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;

            return (
              <div
                key={c.id}
                className="w-full text-left border border-border bg-card hover:bg-card/80 transition-colors p-5 group flex items-start gap-3"
              >
                <button
                  onClick={() => navigate(`/campaign?id=${c.id}`)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-foreground truncate">{c.name}</h3>
                    <Badge
                      variant="outline"
                      className={`font-data text-[9px] tracking-wider uppercase ${statusStyles[c.status || "draft"]}`}
                    >
                      {(c.status || "draft") === "draft" ? "planned" : c.status}
                    </Badge>
                    {c.status === "active" && c.start_date && (() => {
                      const daysToStart = differenceInDays(new Date(c.start_date), new Date());
                      if (daysToStart > 0) {
                        return (
                          <Badge variant="outline" className="font-data text-[9px] tracking-wider bg-accent/10 text-accent border-accent/20">
                            {daysToStart}d TO LAUNCH
                          </Badge>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div className="flex items-center gap-6 text-xs text-muted-foreground">
                    {c.brand && (
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" /> {c.brand}
                      </span>
                    )}
                    {c.start_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(c.start_date), "MMM d")}
                        {c.end_date && ` – ${format(new Date(c.end_date), "MMM d, yyyy")}`}
                      </span>
                    )}
                    {budget > 0 && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        ${budget.toLocaleString()}
                        {spent > 0 && (
                          <span className="text-primary ml-1">({pct}% spent)</span>
                        )}
                      </span>
                    )}
                    {c.cluster && (
                      <Badge variant="outline" className="font-data text-[9px]">
                        {c.cluster}
                      </Badge>
                    )}
                  </div>

                  {c.objective && (
                    <p className="text-xs text-muted-foreground mt-2 truncate max-w-xl">
                      {c.objective}
                    </p>
                  )}

                  {budget > 0 && (
                    <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  )}
                </button>

                <div className="flex items-center gap-2 shrink-0 mt-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ id: c.id, name: c.name });
                    }}
                    className="p-2 text-muted-foreground/40 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete campaign"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{deleteTarget?.name}"</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
