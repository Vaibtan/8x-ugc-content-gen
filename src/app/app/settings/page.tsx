import { AppPlaceholder } from "@/components/app-placeholder";

export default function SettingsPage() {
  return (
    <AppPlaceholder
      activePath="/app/settings"
      eyebrow="Your brand"
      title="A visual identity that travels."
      description="Brand-kit controls and the usage meter will live here. Your data stays isolated by Supabase RLS."
    />
  );
}
