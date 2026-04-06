"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Loader2, Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import OtpInput from "@/components/shared/OtpInput";
import CountdownTimer from "@/components/shared/CountdownTimer";
import { cn } from "@/lib/utils";

type Step = "phone" | "otp";
type Role = "BUS_OWNER" | "ADMIN";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "";

  const initialRole =
    (searchParams.get("role") as Role | null) === "ADMIN" ? "ADMIN" : "BUS_OWNER";

  const [step, setStep] = useState<Step>("phone");
  const [role, setRole] = useState<Role>(initialRole);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [otpErrorMsg, setOtpErrorMsg] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    if (otp.length === 6 && step === "otp" && !verifying) {
      handleVerify(otp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const sendOtp = async (phoneNum: string, roleVal: Role) => {
    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phoneNum, role: roleVal }),
    });
    return res;
  };

  const handleSendOtp = async () => {
    setPhoneError(null);
    const trimmed = phone.trim();

    if (!/^94\d{9}$/.test(trimmed)) {
      setPhoneError("Phone must be in format: 94xxxxxxxxx (11 digits)");
      return;
    }

    setSendingOtp(true);
    try {
      const res = await sendOtp(trimmed, role);
      if (res.status === 429) {
        setPhoneError(
          "OTP already sent. Please check your SMS."
        );
        setStep("otp");
        setResendCountdown(60);
        return;
      }
      if (res.status === 404) {
        setPhoneError("No account found with this phone number.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setPhoneError(body.error ?? "Failed to send OTP. Please try again.");
        return;
      }
      setStep("otp");
      setResendCountdown(60);
    } catch {
      setPhoneError("Network error. Please try again.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerify = async (otpValue: string) => {
    setVerifying(true);
    setOtpError(false);
    setOtpErrorMsg(null);

    const result = await signIn("credentials", {
      phone: phone.trim(),
      otp: otpValue,
      role,
      redirect: false,
    });

    setVerifying(false);

    if (result?.ok) {
      const dest =
        callbackUrl ||
        (role === "ADMIN" ? "/admin" : "/portal");
      router.replace(dest);
    } else {
      setOtpError(true);
      setOtpErrorMsg("Invalid or expired code. Please try again.");
      setOtp("");
    }
  };

  const handleResend = async () => {
    setOtpError(false);
    setOtpErrorMsg(null);
    setOtp("");
    setSendingOtp(true);
    try {
      await sendOtp(phone.trim(), role);
      setResendCountdown(60);
    } catch {
      setOtpErrorMsg("Failed to resend OTP.");
    } finally {
      setSendingOtp(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Bus className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl">BusGo</span>
        </div>

        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
          {step === "phone" ? (
            <div className="p-8 space-y-5">
              <div>
                <h1 className="text-2xl font-bold mb-1">Sign in to your account</h1>
                <p className="text-sm text-muted-foreground">
                  Enter your phone number to receive a one-time code.
                </p>
              </div>

              {/* Role selector */}
              <div className="flex gap-2">
                {(["BUS_OWNER", "ADMIN"] as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                      role === r
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-input hover:bg-accent"
                    )}
                  >
                    {r === "BUS_OWNER" ? "Bus Owner" : "Admin"}
                  </button>
                ))}
              </div>

              {/* Phone input */}
              <div className="space-y-1.5">
                <Label>Phone number</Label>
                <Input
                  placeholder="94xxxxxxxxx"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setPhoneError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendOtp();
                  }}
                  className={cn(phoneError && "border-destructive focus-visible:ring-destructive")}
                />
                {phoneError && (
                  <p className="text-xs text-destructive">{phoneError}</p>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleSendOtp}
                disabled={sendingOtp}
              >
                {sendingOtp && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Send OTP
              </Button>
            </div>
          ) : (
            <div className="p-8 space-y-5">
              <div>
                <h1 className="text-2xl font-bold mb-1">Enter verification code</h1>
                <p className="text-sm text-muted-foreground">
                  We sent a 6-digit code to{" "}
                  <span className="font-mono font-medium text-foreground">
                    {phone}
                  </span>
                  .{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline text-sm"
                    onClick={() => {
                      setStep("phone");
                      setOtp("");
                      setOtpError(false);
                      setOtpErrorMsg(null);
                    }}
                  >
                    Change number
                  </button>
                </p>
              </div>

              {/* OTP boxes */}
              <OtpInput
                value={otp}
                onChange={setOtp}
                disabled={verifying}
                hasError={otpError}
              />

              {otpErrorMsg && (
                <p className="text-sm text-destructive text-center">
                  {otpErrorMsg}
                </p>
              )}

              <Button
                className="w-full"
                onClick={() => handleVerify(otp)}
                disabled={verifying || otp.length < 6}
              >
                {verifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Verify
              </Button>

              {/* Resend section */}
              <div className="text-center text-sm text-muted-foreground">
                {resendCountdown > 0 ? (
                  <span>
                    Resend code in{" "}
                    <CountdownTimer
                      seconds={resendCountdown}
                      onExpire={() => setResendCountdown(0)}
                      className="font-medium text-foreground"
                    />
                  </span>
                ) : (
                  <button
                    type="button"
                    className="text-primary hover:underline font-medium"
                    onClick={handleResend}
                    disabled={sendingOtp}
                  >
                    {sendingOtp ? "Sending…" : "Resend OTP"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don&apos;t have an account?{" "}
          <Link
            href="/onboard"
            className="font-medium text-primary hover:underline"
          >
            Register as a bus owner
          </Link>
        </p>
      </div>
    </div>
  );
}
