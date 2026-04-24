// The actual home page is in app/(public)/page.tsx.
// This stub exists only to satisfy any direct navigations; remove if build fails.
import { redirect } from "next/navigation";

export default function RootStubPage() {
  // This should never render since (public)/page.tsx handles "/"
  redirect("/");
}
