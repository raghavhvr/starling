import { useState } from "react";
import { Upload, FileText, PenLine, ChevronRight, X, CheckCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { BriefMatchDialog, type BriefData } from "@/components/creator-hub/BriefMatchDialog";

const brands = ["Maggi", "NIDO", "S-26", "Nescafé", "Milo", "Nesquik", "KitKat", "Cerelac", "Nestlé Pure Life"];
const objectives = ["Brand Awareness", "Product Launch", "Engagement", "Conversions", "Content Creation", "Event Amplification"];
const markets = ["UAE", "Saudi Arabia", "Qatar", "Kuwait", "Bahrain", "Oman", "Egypt", "Jordan", "Lebanon", "Iraq", "Morocco", "Tunisia", "Algeria", "Libya", "Yemen", "India"];

type Mode = "choose" | "form" | "upload";

const CreateBrief = () => {
  const [mode, setMode] = useState<Mode>("choose");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Form state for matching
  const [campaignName, setCampaignName] = useState("");
  const [brand, setBrand] = useState("");
  const [objective, setObjective] = useState("");
  const [audienceNotes, setAudienceNotes] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [matchOpen, setMatchOpen] = useState(false);

  const toggleMarket = (market: string) => {
    setSelectedMarkets(prev =>
      prev.includes(market) ? prev.filter(m => m !== market) : [...prev, market]
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setUploadedFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
  };

  return (
    <div className="min-h-full">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border">
        {/* Warm backdrop — swap for Maggi/NIDO key visual when brand assets land */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 700px 400px at 90% 20%, hsl(48 95% 55% / 0.16), transparent)",
          }}
        />
        <div className="hero-glow-red absolute inset-0" />
        <div className="hero-glow-gold absolute inset-0" />
        <div className="relative px-8 pt-10 pb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-5 h-[2px] bg-primary" />
            <span className="font-data text-[10px] text-primary tracking-[0.25em] font-medium">
              NESTLÉ BRAND INTELLIGENCE
            </span>
          </div>
          <h1 className="text-5xl font-display font-semibold leading-[1.05] tracking-tight mb-3">
            Create a <em className="text-primary italic">Brief</em>
          </h1>
          <p className="font-ui text-sm text-muted-foreground leading-relaxed max-w-lg">
            Start your campaign by filling out the brief details manually or uploading an existing document.
          </p>
        </div>
      </div>

      {/* Mode Chooser */}
      {mode === "choose" && (
        <div className="px-8 py-12">
          <div className="grid grid-cols-2 gap-6 max-w-3xl">
            {/* Fill Out Form */}
            <button
              onClick={() => setMode("form")}
              className="group border border-border bg-card p-8 text-left space-y-4 hover:border-primary/40 transition-all duration-300"
            >
              <div className="w-12 h-12 bg-primary/10 flex items-center justify-center">
                <PenLine className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground">
                Fill out manually
              </h3>
              <p className="font-ui text-sm text-muted-foreground leading-relaxed">
                Complete a structured form with campaign objectives, target audience, budget, and deliverables.
              </p>
              <div className="flex items-center gap-2 text-primary font-ui text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Start <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            {/* Upload Document */}
            <button
              onClick={() => setMode("upload")}
              className="group border border-border bg-card p-8 text-left space-y-4 hover:border-accent/40 transition-all duration-300"
            >
              <div className="w-12 h-12 bg-accent/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-accent" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground">
                Upload a document
              </h3>
              <p className="font-ui text-sm text-muted-foreground leading-relaxed">
                Upload an existing brief as a PDF, DOCX, or other document format and we'll extract the details.
              </p>
              <div className="flex items-center gap-2 text-accent font-ui text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Upload <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Form Mode */}
      {mode === "form" && (
        <div className="px-8 py-8 max-w-3xl">
          <button
            onClick={() => setMode("choose")}
            className="font-ui text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 flex items-center gap-1"
          >
            ← Back
          </button>

          <div className="space-y-8">
            {/* Campaign Details */}
            <section className="space-y-5">
              <h2 className="font-display text-2xl font-semibold text-foreground">
                Campaign Details
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                    Campaign Name
                  </label>
                  <Input
                    placeholder="e.g., Ramadan Family Moments 2026"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="bg-card border-border font-ui"
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                    Brand
                  </label>
                  <Select value={brand} onValueChange={setBrand}>
                    <SelectTrigger className="bg-card border-border font-ui">
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                    Objective
                  </label>
                  <Select value={objective} onValueChange={setObjective}>
                    <SelectTrigger className="bg-card border-border font-ui">
                      <SelectValue placeholder="Select objective" />
                    </SelectTrigger>
                    <SelectContent>
                      {objectives.map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                    Market(s)
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex min-h-10 w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-left font-ui text-sm">
                        {selectedMarkets.length > 0 ? (
                          <span className="truncate">{selectedMarkets.join(", ")}</span>
                        ) : (
                          <span className="text-muted-foreground">Select markets</span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 max-h-60 overflow-y-auto p-2" align="start">
                      {markets.map(m => (
                        <label
                          key={m}
                          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted rounded-sm font-ui text-sm"
                        >
                          <Checkbox
                            checked={selectedMarkets.includes(m)}
                            onCheckedChange={() => toggleMarket(m)}
                          />
                          {m}
                        </label>
                      ))}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </section>

            {/* Budget & Timeline */}
            <section className="space-y-5">
              <h2 className="font-display text-2xl font-semibold text-foreground">
                Budget & Timeline
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                    Total Budget
                  </label>
                  <Input type="text" placeholder="$250,000" className="bg-card border-border font-ui" />
                </div>
                <div className="space-y-2">
                  <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                    Start Date
                  </label>
                  <Input type="date" className="bg-card border-border font-ui" />
                </div>
                <div className="space-y-2">
                  <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                    End Date
                  </label>
                  <Input type="date" className="bg-card border-border font-ui" />
                </div>
              </div>
            </section>

            {/* Target Audience */}
            <section className="space-y-5">
              <h2 className="font-display text-2xl font-semibold text-foreground">
                Target Audience
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                    Age Range
                  </label>
                  <Input placeholder="e.g., 18-35" className="bg-card border-border font-ui" />
                </div>
                <div className="space-y-2">
                  <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                    Demographics
                  </label>
                  <Input placeholder="e.g., Female, Urban" className="bg-card border-border font-ui" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                  Audience Notes
                </label>
                <Textarea
                  placeholder="Describe your ideal audience, interests, platforms..."
                  value={audienceNotes}
                  onChange={(e) => setAudienceNotes(e.target.value)}
                  className="bg-card border-border font-ui min-h-[100px]"
                />
              </div>
            </section>

            {/* Deliverables */}
            <section className="space-y-5">
              <h2 className="font-display text-2xl font-semibold text-foreground">
                Deliverables & Notes
              </h2>
              <div className="space-y-2">
                <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                  Key Deliverables
                </label>
                <Textarea
                  placeholder="e.g., 3x Instagram Reels, 2x TikTok posts, 1x YouTube integration..."
                  value={deliverables}
                  onChange={(e) => setDeliverables(e.target.value)}
                  className="bg-card border-border font-ui min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                  Additional Notes
                </label>
                <Textarea
                  placeholder="Any special requirements, creative direction, brand guidelines..."
                  value={extraNotes}
                  onChange={(e) => setExtraNotes(e.target.value)}
                  className="bg-card border-border font-ui min-h-[80px]"
                />
              </div>
            </section>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
              <Button className="font-ui">
                Submit Brief
              </Button>
              <Button variant="outline" className="font-ui">
                Save as Draft
              </Button>
              <Button
                variant="outline"
                className="font-ui gap-2 ml-auto border-primary/40 text-primary hover:bg-primary/5"
                onClick={() => setMatchOpen(true)}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Find Matching Creators
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Mode */}
      {mode === "upload" && (
        <div className="px-8 py-8 max-w-3xl">
          <button
            onClick={() => { setMode("choose"); setUploadedFile(null); }}
            className="font-ui text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 flex items-center gap-1"
          >
            ← Back
          </button>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed ${
              dragActive ? "border-primary bg-primary/5" : "border-border"
            } bg-card p-12 text-center transition-colors`}
          >
            {!uploadedFile ? (
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-surface-2 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-display text-xl font-semibold text-foreground mb-1">
                    Drop your brief here
                  </p>
                  <p className="font-ui text-sm text-muted-foreground">
                    PDF, DOCX, PPTX — up to 20MB
                  </p>
                </div>
                <label className="inline-block cursor-pointer">
                  <span className="font-ui text-sm text-primary hover:text-primary/80 underline underline-offset-4 transition-colors">
                    or browse files
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.pptx,.ppt,.txt"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-primary" />
                </div>
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-5 h-5 text-accent" />
                  <span className="font-ui text-sm text-foreground">{uploadedFile.name}</span>
                  <span className="font-data text-[10px] text-muted-foreground">
                    ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {uploadedFile && (
            <div className="flex gap-4 pt-6">
              <Button className="font-ui">
                Process Brief
              </Button>
              <Button variant="outline" className="font-ui" onClick={() => setUploadedFile(null)}>
                Remove & Re-upload
              </Button>
            </div>
          )}
        </div>
      )}

      <BriefMatchDialog
        open={matchOpen}
        onOpenChange={setMatchOpen}
        initialBrief={{
          brand,
          objective,
          markets: selectedMarkets,
          audience: audienceNotes,
          deliverables,
          notes: [campaignName && `Campaign: ${campaignName}`, extraNotes].filter(Boolean).join("\n"),
        }}
      />
    </div>
  );
};

export default CreateBrief;
