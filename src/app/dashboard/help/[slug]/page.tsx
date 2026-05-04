import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { GuideRenderer } from "@/components/help/guide-renderer";
import { PrintButton } from "@/components/reports/print-button";
import { findGuide, MODULE_GUIDES } from "@/lib/help-content";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Surface every guide slug to Next.js so build-time route generation works
// even though the layout itself is dynamic.
export function generateStaticParams() {
  return MODULE_GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function HelpGuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4 print:max-w-none">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/dashboard/help"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowLeft className="size-4" />
          All guides
        </Link>
        <PrintButton>
          <Printer className="size-4" />
          Print this guide
        </PrintButton>
      </div>

      <GuideRenderer guide={guide} />
    </div>
  );
}
