"use client";

import { useState, useEffect } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { GraduationCap, AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      if (role === "admin") {
        router.push("/admin");
      } else {
        router.push("/submit");
      }
    }
  }, [user, role, loading, router]);

  const validateDomain = (userEmail: string | null) => {
    if (!userEmail?.endsWith("@bppimt.ac.in")) {
      setError("Please use your official @bppimt.ac.in email address.");
      return false;
    }
    return true;
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      // Optionally restrict Google prompt to let user pick only one account or ensure prompt
      provider.setCustomParameters({
        prompt: "select_account"
      });
      const result = await signInWithPopup(auth, provider);
      if (!validateDomain(result.user.email)) {
        await auth.signOut();
      }
    } catch (err: any) {
      // In case user closes the popup or other errors occur
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || "Failed to sign in with Google.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="mx-auto w-full max-w-md">
        <div className="flex justify-center">
          <img src="https://res.cloudinary.com/dujkjlu4p/image/upload/v1776448456/bppimt-slt-logo_jii1cf.webp" alt="BPPIMT College Logo" className="h-24 w-auto object-contain drop-shadow-sm" />
        </div>
        <h2 className="mt-8 text-center text-3xl font-extrabold tracking-tight text-gray-900">
          BPPIMT Achievements
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Student Achievement Submission Portal
        </p>
      </div>

      <div className="mt-8 mx-auto w-full max-w-md">
        <div className="bg-white py-12 px-6 shadow-xl shadow-gray-200/50 rounded-2xl sm:px-10 border border-gray-100 text-center flex flex-col items-center">
          {error && (
            <div className="mb-6 w-full bg-red-50 border border-red-200 p-4 rounded-lg flex items-start text-left">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <div className="w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-6">
              Sign in to continue
            </h3>

            <button
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full flex justify-center items-center py-3.5 px-4 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin mr-3" />
              ) : (
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                  <path fill="none" d="M1 1h22v22H1z" />
                </svg>
              )}
              {isSubmitting ? "Signing in..." : "Sign in with Google"}
            </button>
            <p className="mt-4 text-xs text-gray-500">
              Only @bppimt.ac.in emails are allowed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
