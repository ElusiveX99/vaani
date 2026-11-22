"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ProfileAvatar from "@/components/profile-avatar";
import InlineFeedback from "@/components/inline-feedback";

type Props = {
  userId: string;
  initialName: string;
  initialAvatarUrl: string | null;
  initialAvatarPath: string | null;
  email: string;
};

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

function getAvatarExtension(file: File) {
  return file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
}

function getSafeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission") || message.includes("policy") || message.includes("row-level")) {
      return "Vaani could not save this change because the account does not have permission. Please sign in again or contact the administrator.";
    }
    if (message.includes("network") || message.includes("fetch")) {
      return "A connection problem prevented this change. Check your connection and try again.";
    }
  }
  return fallback;
}

export default function ProfileEditor({
  userId,
  initialName,
  initialAvatarUrl,
  initialAvatarPath,
  email,
}: Props) {
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function getVerifiedClient() {
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || data.user?.id !== userId) {
      throw new Error("Your sign-in could not be verified.");
    }
    return supabase;
  }

  async function writeProfile(
    supabase: ReturnType<typeof createClient>,
    values: { display_name: string; avatar_url: string | null; avatar_path: string | null }
  ) {
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, ...values }, { onConflict: "id" });
    if (error) throw error;
  }


  function notifyProfileUpdated() {
    window.dispatchEvent(new CustomEvent("vaani:profile-updated"));
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || cleanName.length > 80) {
      setError("Enter a name between 1 and 80 characters.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const supabase = await getVerifiedClient();
      await writeProfile(supabase, {
        display_name: cleanName,
        avatar_url: avatarUrl,
        avatar_path: avatarPath,
      });
      setName(cleanName);
      setMessage("Your profile has been saved.");
      notifyProfileUpdated();
    } catch (err) {
      console.error("Vaani profile save failed:", err);
      setError(getSafeErrorMessage(err, "Your profile could not be saved. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(file?: File) {
    if (!file) return;
    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      setError("Choose a JPG, PNG, WebP, or AVIF image.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setError("Your image must be 5 MB or smaller.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    let uploadedPath: string | null = null;

    try {
      const supabase = await getVerifiedClient();
      const path = `${userId}/${crypto.randomUUID()}.${getAvatarExtension(file)}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(path, file, {
          upsert: false,
          contentType: file.type,
          cacheControl: "3600",
        });
      if (uploadError) throw uploadError;
      uploadedPath = path;

      const { data } = supabase.storage.from("profile-avatars").getPublicUrl(path);
      const nextUrl = data.publicUrl;
      const cleanName = name.trim() || "Vaani member";

      await writeProfile(supabase, {
        display_name: cleanName,
        avatar_url: nextUrl,
        avatar_path: path,
      });

      setAvatarUrl(nextUrl);
      setAvatarPath(path);
      setName(cleanName);

      if (avatarPath && avatarPath.startsWith(`${userId}/`) && avatarPath !== path) {
        const { error: cleanupError } = await supabase.storage
          .from("profile-avatars")
          .remove([avatarPath]);
        if (cleanupError) console.error("Old Vaani profile photo cleanup failed:", cleanupError);
      }

      uploadedPath = null;
      setMessage("Profile photo updated.");
      notifyProfileUpdated();
    } catch (err) {
      if (uploadedPath) {
        const supabase = createClient();
        const { error: cleanupError } = await supabase.storage
          .from("profile-avatars")
          .remove([uploadedPath]);
        if (cleanupError) console.error("Unused Vaani profile photo cleanup failed:", cleanupError);
      }
      console.error("Vaani profile photo upload failed:", err);
      setError(getSafeErrorMessage(err, "Your photo could not be updated. Please try again."));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeAvatar() {
    if (!avatarUrl && !avatarPath) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const supabase = await getVerifiedClient();
      await writeProfile(supabase, {
        display_name: name.trim() || "Vaani member",
        avatar_url: null,
        avatar_path: null,
      });
      setAvatarUrl(null);
      setAvatarPath(null);

      if (avatarPath && avatarPath.startsWith(`${userId}/`)) {
        const { error: cleanupError } = await supabase.storage
          .from("profile-avatars")
          .remove([avatarPath]);
        if (cleanupError) console.error("Removed Vaani profile photo could not be cleaned up:", cleanupError);
      }

      setMessage("Profile photo removed.");
      notifyProfileUpdated();
    } catch (err) {
      console.error("Vaani profile photo removal failed:", err);
      setError(getSafeErrorMessage(err, "Your photo could not be removed. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-card p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-5">
        <ProfileAvatar name={name} avatarUrl={avatarUrl} size="xl" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl text-[var(--ink)]">Your profile</h2>
          <p className="mt-1 truncate text-sm text-[var(--muted)]">{email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="button-primary !px-4 !py-2 text-xs"
            >
              {avatarUrl ? "Change photo" : "Add a photo"}
            </button>
            {(avatarUrl || avatarPath) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void removeAvatar()}
                className="button-secondary !px-4 !py-2 text-xs"
              >
                Remove
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              aria-label="Choose a profile photo"
              className="hidden"
              onChange={(event) => void uploadAvatar(event.target.files?.[0])}
            />
          </div>
        </div>
      </div>

      <form onSubmit={saveProfile} className="mt-8 space-y-5">
        <label className="field-label">
          Display name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            autoComplete="name"
            className="field-input mt-2"
            placeholder="How should other members see you?"
          />
        </label>
        {error && <InlineFeedback tone="error">{error}</InlineFeedback>}
        {message && <InlineFeedback tone="success">{message}</InlineFeedback>}
        <button type="submit" disabled={busy} className="button-primary">
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>
    </section>
  );
}
