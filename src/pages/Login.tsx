import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import nestleLogo from "@/assets/nestle-logo.png";
import wppLogo from "@/assets/wpp-logo.svg";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({
          title: "Account created",
          description: "Check your email to confirm your account.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate("/");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Background glows */}
      <div className="hero-glow-red fixed inset-0" />
      <div className="hero-glow-gold fixed inset-0" />

      <div className="relative w-full max-w-sm border border-border bg-card p-8 space-y-8">
        {/* Branding */}
        <div className="text-center space-y-4">
          <img src={nestleLogo} alt="Nestlé" className="h-16 w-auto object-contain mx-auto" />
          <div>
            <h1 className="font-ui text-xs tracking-[0.25em] text-foreground font-semibold">
              STARLING
            </h1>
            <p className="font-data text-[9px] text-muted-foreground tracking-wider mt-0.5">
              INFLUENCER INTELLIGENCE BY NESTLÉ
            </p>
          </div>
          <div className="w-8 h-[1px] bg-border mx-auto" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@nestle.com"
              className="bg-background border-border font-ui"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-background border-border font-ui"
              required
              minLength={6}
            />
          </div>

          <Button type="submit" className="w-full font-ui" disabled={loading}>
            {loading ? "..." : isSignUp ? "Create Account" : "Sign In"}
          </Button>
        </form>

        <div className="text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="font-ui text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
          </button>
        </div>

        {/* Demo credentials */}
        <div className="border border-dashed border-border p-3 text-center space-y-1">
          <p className="font-data text-[9px] text-muted-foreground tracking-[0.2em] uppercase">
            Demo Admin
          </p>
          <button
            type="button"
            onClick={() => {
              setEmail("admin@starling.demo");
              setPassword("Maggi2026!");
              setIsSignUp(false);
            }}
            className="font-data text-[10px] text-primary hover:underline"
          >
            admin@starling.demo · Maggi2026!
          </button>
        </div>

        {/* Powered by WPP */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <span className="font-data text-[8px] text-muted-foreground tracking-[0.2em]">
            POWERED BY
          </span>
          <img src={wppLogo} alt="WPP" className="h-4 w-auto object-contain" />
        </div>
      </div>
    </div>
  );
};

export default Login;
