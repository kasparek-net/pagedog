import { redirect } from "next/navigation";
import { getSessionEmail } from "@/lib/session";
import ImportForm from "./form";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const email = await getSessionEmail();
  if (!email) redirect("/sign-in");

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Import product links</h1>
      <p className="text-sm text-neutral-500 mb-6">
        One URL per line. Product pages are watched for availability (or price when that is all
        they publish) — nothing to pick. Anything that is not a product page is skipped, so add
        those one by one with a selector.
      </p>
      <ImportForm />
    </div>
  );
}
