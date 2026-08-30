"use server";

import { redirect } from "next/navigation";

import { beginGoogleOAuth, sendMagicLink } from "@/lib/auth/service";
import { runApp } from "@/lib/runtime";

export async function signInWithGoogle() {
  const url = await runApp(beginGoogleOAuth);
  redirect(url);
}

export async function requestMagicLink(formData: FormData) {
  const email = formData.get("email");
  if (typeof email !== "string" || email.trim().length === 0) {
    redirect("/?authError=Enter%20your%20email%20address.");
  }

  await runApp(sendMagicLink(email.trim()));
  redirect("/?checkEmail=1");
}
