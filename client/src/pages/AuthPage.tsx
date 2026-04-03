import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";

type View = "login" | "register" | "forgot" | "reset";

export default function AuthPage() {
  const { login, register, requestPasswordReset, resetPassword } = useAuth();
  const [view, setView] = useState<View>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Check URL for reset token on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token && window.location.pathname === "/reset-password") {
      setResetToken(token);
      setView("reset");
    }
  }, []);

  const clearForm = () => {
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setSuccessMessage("");
  };

  const switchView = (newView: View) => {
    clearForm();
    setView(newView);
  };

  const handleLoginRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (view === "register" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (view === "register" && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      if (view === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!username.trim()) {
      setError("Please enter your email");
      return;
    }

    setLoading(true);
    try {
      const message = await requestPasswordReset(username.trim());
      setSuccessMessage(message);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!password) {
      setError("Please enter a new password");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const message = await resetPassword(resetToken, password);
      setSuccessMessage(message);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    if (view === "forgot") {
      return (
        <>
          <h2 className="text-lg font-semibold text-center mb-2">Forgot your password?</h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            Enter your email and we'll send you a link to reset your password.
          </p>

          {successMessage ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 text-center">
                {successMessage}
              </p>
              <button
                type="button"
                className="text-sm text-primary hover:underline mt-2"
                onClick={() => switchView("login")}
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <Label htmlFor="username">Email</Label>
                <Input
                  id="username"
                  type="email"
                  placeholder="you@example.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  onClick={() => switchView("login")}
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to Sign In
                </button>
              </div>
            </form>
          )}
        </>
      );
    }

    if (view === "reset") {
      return (
        <>
          <h2 className="text-lg font-semibold text-center mb-2">Reset your password</h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            Enter your new password below.
          </p>

          {successMessage ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 text-center">
                {successMessage}
              </p>
              <button
                type="button"
                className="text-sm text-primary hover:underline mt-2"
                onClick={() => {
                  // Clean up URL
                  window.history.replaceState({}, "", "/");
                  switchView("login");
                }}
              >
                Sign In with new password
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </form>
          )}
        </>
      );
    }

    // Login / Register
    return (
      <>
        <h2 className="text-lg font-semibold text-center mb-6">
          {view === "login" ? "Welcome back" : "Create account"}
        </h2>

        <form onSubmit={handleLoginRegister} className="space-y-4">
          <div>
            <Label htmlFor="username">Email</Label>
            <Input
              id="username"
              type="email"
              placeholder="you@example.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete={view === "login" ? "username" : "new-username"}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {view === "login" && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => switchView("forgot")}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={view === "login" ? "current-password" : "new-password"}
            />
          </div>

          {view === "register" && (
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {view === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => switchView(view === "login" ? "register" : "login")}
          >
            {view === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 px-4 pt-[59px] md:pt-0">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">RunFlex</h1>
          <p className="text-sm text-gray-500 mt-1">Discover your perfect running route</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {renderForm()}
        </div>
      </div>
    </div>
  );
}
