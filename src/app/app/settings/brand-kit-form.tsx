"use client";

import { LoaderCircle, Upload } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import {
  BRAND_ASSET_MAX_BYTES,
  type BrandAssetKind,
  type BrandKit,
  type BrandKitInput,
} from "@/lib/brand-kit/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveBrandKitAction } from "@/app/app/settings/actions";

type AssetUrls = Readonly<{
  headshot: string | null;
  logo: string | null;
}>;

type BrandKitFormProps = Readonly<{
  initialBrandKit: BrandKit | null;
  initialAssetUrls: AssetUrls;
}>;

type FormState = BrandKitInput;

const defaults: FormState = {
  display_name: "",
  handle: "",
  headshot_path: null,
  logo_path: null,
  primary_color: "#173f34",
  secondary_color: "#d9613f",
  font: "Inter",
};

const copyFromBrandKit = (brandKit: BrandKit | null): FormState =>
  brandKit === null
    ? defaults
    : {
        display_name: brandKit.display_name,
        handle: brandKit.handle,
        headshot_path: brandKit.headshot_path,
        logo_path: brandKit.logo_path,
        primary_color: brandKit.primary_color,
        secondary_color: brandKit.secondary_color,
        font: brandKit.font,
      };

type UploadedBrandAsset = Readonly<{ path: string }>;

const isUploadedBrandAsset = (value: unknown): value is UploadedBrandAsset =>
  typeof value === "object" &&
  value !== null &&
  "path" in value &&
  typeof value.path === "string";

export function BrandKitForm({
  initialBrandKit,
  initialAssetUrls,
}: BrandKitFormProps) {
  const [form, setForm] = useState<FormState>(() =>
    copyFromBrandKit(initialBrandKit),
  );
  const [assetUrls, setAssetUrls] = useState<AssetUrls>(initialAssetUrls);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [uploading, setUploading] = useState<BrandAssetKind | null>(null);
  const usagePreview = useMemo(
    () => ({
      primary: form.primary_color,
      fontFamily: form.font,
    }),
    [form.font, form.primary_color],
  );

  const update = <Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const uploadAsset = async (kind: BrandAssetKind, file: File | undefined) => {
    if (!file) {
      return;
    }
    if (file.size > BRAND_ASSET_MAX_BYTES) {
      setMessage("Choose an image smaller than 5 MB.");
      return;
    }

    setUploading(kind);
    setMessage(null);
    try {
      const body = new FormData();
      body.set("kind", kind);
      body.set("file", file);
      const response = await fetch("/api/brand-assets", {
        method: "POST",
        body,
      });
      const uploadedAsset: unknown = await response.json();
      if (!response.ok || !isUploadedBrandAsset(uploadedAsset)) {
        setMessage("The image upload failed. Please choose it again and retry.");
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      update(
        kind === "headshot" ? "headshot_path" : "logo_path",
        uploadedAsset.path,
      );
      setAssetUrls((current) => ({ ...current, [kind]: previewUrl }));
      setMessage(
        `${kind === "headshot" ? "Headshot" : "Logo"} uploaded. Save to use it.`,
      );
    } catch {
      setMessage("The image upload could not start. Please try again.");
    } finally {
      setUploading(null);
    }
  };

  const save = () => {
    startSaving(async () => {
      setMessage(null);
      const result = await saveBrandKitAction(form);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setForm(copyFromBrandKit(result.value));
      setMessage("Brand kit saved. It will follow every new asset.");
    });
  };

  return (
    <form
      className="mt-7 space-y-6 pb-5"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Identity</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
              The name and handle shown on your carousels and capture pages.
            </p>
          </div>
          <div
            aria-label="Brand preview"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-black text-white"
            style={{
              backgroundColor: usagePreview.primary,
              fontFamily: usagePreview.fontFamily,
            }}
          >
            {form.display_name.slice(0, 1).toUpperCase() || "F"}
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">
            Name
            <Input
              autoComplete="name"
              maxLength={80}
              onChange={(event) => update("display_name", event.target.value)}
              required
              value={form.display_name}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Handle{" "}
            <span className="font-normal text-[var(--muted-foreground)]">
              (optional)
            </span>
            <Input
              autoComplete="nickname"
              maxLength={80}
              onChange={(event) => update("handle", event.target.value)}
              placeholder="@averybuilds"
              value={form.handle}
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
        <h2 className="font-bold">Images</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
          Upload a JPG, PNG, or WebP from your phone. Files stay private and are
          served with an expiring link.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <AssetUpload
            accept="image/jpeg,image/png,image/webp"
            imageUrl={assetUrls.headshot}
            label="Headshot"
            onFile={(file) => void uploadAsset("headshot", file)}
            uploading={uploading === "headshot"}
          />
          <AssetUpload
            accept="image/jpeg,image/png,image/webp"
            imageUrl={assetUrls.logo}
            label="Logo"
            onFile={(file) => void uploadAsset("logo", file)}
            uploading={uploading === "logo"}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
        <h2 className="font-bold">Visual system</h2>
        <div className="mt-5 grid gap-4">
          <ColorField
            label="Primary colour"
            onChange={(value) => update("primary_color", value)}
            value={form.primary_color}
          />
          <ColorField
            label="Accent colour"
            onChange={(value) => update("secondary_color", value)}
            value={form.secondary_color}
          />
          <label className="grid gap-2 text-sm font-semibold">
            Font
            <select
              className="h-12 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-base outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[color:var(--ring)]/20"
              onChange={(event) =>
                update("font", event.target.value as FormState["font"])
              }
              value={form.font}
            >
              <option value="Inter">Inter</option>
              <option value="Manrope">Manrope</option>
              <option value="Newsreader">Newsreader</option>
              <option value="Space Grotesk">Space Grotesk</option>
            </select>
          </label>
        </div>
      </section>

      {message ? (
        <p
          aria-live="polite"
          className="rounded-2xl bg-[var(--muted)] px-4 py-3 text-sm text-[var(--muted-foreground)]"
        >
          {message}
        </p>
      ) : null}
      <Button
        className="w-full"
        disabled={isSaving || uploading !== null}
        type="submit"
      >
        {isSaving ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
        ) : null}
        {isSaving ? "Saving brand kit…" : "Save brand kit"}
      </Button>
    </form>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <span className="flex h-12 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <input
          aria-label={`${label} picker`}
          className="h-full w-14 cursor-pointer border-0 bg-transparent p-1"
          onChange={(event) => onChange(event.target.value)}
          type="color"
          value={value}
        />
        <Input
          aria-label={`${label} hexadecimal value`}
          className="h-full rounded-none border-0 focus:ring-0"
          maxLength={7}
          onChange={(event) => onChange(event.target.value)}
          pattern="#[0-9A-Fa-f]{6}"
          value={value}
        />
      </span>
    </label>
  );
}

function AssetUpload({
  accept,
  imageUrl,
  label,
  onFile,
  uploading,
}: Readonly<{
  accept: string;
  imageUrl: string | null;
  label: string;
  onFile: (file: File | undefined) => void;
  uploading: boolean;
}>) {
  return (
    <label className="grid min-h-36 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted)] p-3 text-center transition hover:border-[var(--ring)]">
      <input
        accept={accept}
        className="sr-only"
        disabled={uploading}
        onChange={(event) => onFile(event.target.files?.[0])}
        type="file"
      />
      {imageUrl ? (
        <img
          alt={`${label} preview`}
          className="h-24 w-full rounded-xl object-cover"
          src={imageUrl}
        />
      ) : (
        <span className="grid place-items-center gap-2 text-sm font-semibold text-[var(--muted-foreground)]">
          {uploading ? (
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin"
              size={20}
            />
          ) : (
            <Upload aria-hidden="true" size={20} />
          )}
          {uploading ? "Uploading…" : label}
        </span>
      )}
    </label>
  );
}
