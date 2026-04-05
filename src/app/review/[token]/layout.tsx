import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getReviewAccess } from "@/lib/review-access";
import { ReviewAccessShell } from "@/components/review-access-shell";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ReviewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const access = await getReviewAccess(token, { logAccess: true });
  if (!access) {
    notFound();
  }
  return <ReviewAccessShell homeHref={`/review/${token}`}>{children}</ReviewAccessShell>;
}
