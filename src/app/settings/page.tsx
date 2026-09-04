import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionEmail } from "@/lib/session";
import SettingsForm from "./form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const email = await getSessionEmail();
  if (!email) redirect("/sign-in");
  const settings = await db.userSettings.findUnique({ where: { email } });

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Settings</h1>
      <p className="text-sm text-neutral-500 mb-6">{email}</p>
      <SettingsForm ntfyTopic={settings?.ntfyTopic ?? ""} />
    </div>
  );
}
