"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle2, Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createOwner } from "@/lib/api/owner";

const schema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Must be a valid email address").optional().or(z.literal("")),
  phone: z
    .string()
    .regex(
      /^94\d{9}$/,
      "Phone must be in Sri Lanka format: 94xxxxxxxxx (11 digits)"
    ),
});

type FormValues = z.infer<typeof schema>;

export default function OnboardPage() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ phone: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setServerError(null);
    try {
      await createOwner({
        name: values.name,
        email: values.email || undefined,
        phone: values.phone,
      });
      setSuccess({ phone: values.phone });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      if (msg.includes("already registered") || msg.includes("already exists")) {
        setServerError(
          "An account with this phone number already exists. Please login instead."
        );
      } else {
        setServerError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-[480px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Bus className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl">BusGo</span>
        </div>

        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
          {success ? (
            /* Success state */
            <div className="p-8 text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="w-14 h-14 text-green-500" />
              </div>
              <h2 className="text-xl font-bold">Account created successfully!</h2>
              <p className="text-sm text-muted-foreground">
                You can now sign in to the owner portal.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
                <p className="text-sm font-medium text-blue-800 mb-1">
                  Your login phone number
                </p>
                <p className="font-mono text-blue-900 font-semibold text-base">
                  {success.phone}
                </p>
                <p className="text-xs text-blue-700 mt-2">
                  This is the number you will use to sign in with an OTP. Save it.
                </p>
              </div>
              <Button className="w-full" asChild>
                <Link href="/login?role=BUS_OWNER">Go to login</Link>
              </Button>
            </div>
          ) : (
            /* Registration form */
            <div className="p-8">
              <h1 className="text-2xl font-bold mb-1">Register as a bus owner</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Create your account. Your phone number will be your login — save it.
              </p>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Kamal Perera" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email address</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="94xxxxxxxxx"
                            inputMode="numeric"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {serverError && (
                    <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                      {serverError}
                    </p>
                  )}

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Create account
                  </Button>
                </form>
              </Form>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
