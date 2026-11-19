"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ProfileAvatar from "@/components/profile-avatar";

type Props = {
  userId: string;
  initialName: string;
  initialAvatarUrl: string | null;
  initialAvatarPath: string | null;
  email: string;
};

export default function ProfileEditor({ userId, initialName, initialAvatarUrl, initialAvatarPath, email }: Props) {
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
      const supabase = createClient();
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        display_name: cleanName,
        avatar_url: avatarUrl,
        avatar_path: avatarPath,
      }, { onConflict: "id" });
      if (profileError) throw profileError;

      const { error: metadataError } = await supabase.auth.updateUser({
        data: { display_name: cleanName, avatar_url: avatarUrl },
      });
      if (metadataError) throw metadataError;

      setMessage("Your profile has been saved.");
      window.dispatchEvent(new CustomEvent("vaani:profile-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your profile.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setError("Choose a JPG, PNG, WebP, or AVIF image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Your image must be 5 MB or smaller.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
      const path = `${userId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("profile-avatars").getPublicUrl(path);
      const nextUrl = data.publicUrl;
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        display_name: name.trim() || "Vaani member",
        avatar_url: nextUrl,
        avatar_path: path,
      }, { onConflict: "id" });
      if (profileError) throw profileError;

      const { error: metadataError } = await supabase.auth.updateUser({
        data: { avatar_url: nextUrl },
      });
      if (metadataError) throw metadataError;

      setAvatarUrl(nextUrl);
      setAvatarPath(path);
      setMessage("Profile photo updated.");
      window.dispatchEvent(new CustomEvent("vaani:profile-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload your photo.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeAvatar() {
    if (!avatarUrl) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const { error: profileError } = await supabase.from("profiles").update({ avatar_url: null, avatar_path: null }).eq("id", userId);
      if (profileError) throw profileError;
      const { error: metadataError } = await supabase.auth.updateUser({ data: { avatar_url: null } });
      if (metadataError) throw metadataError;
      setAvatarUrl(null);
      setAvatarPath(null);
      setMessage("Profile photo removed.");
      window.dispatchEvent(new CustomEvent("vaani:profile-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove your photo.");
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
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="button-primary !px-4 !py-2 text-xs">
              {avatarUrl ? "Change photo" : "Add a photo"}
            </button>
            {avatarUrl && <button type="button" disabled={busy} onClick={() => void removeAvatar()} className="button-secondary !px-4 !py-2 text-xs">Remove</button>}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(event) => void uploadAvatar(event.target.files?.[0])} />
          </div>
        </div>
      </div>

      <form onSubmit={saveProfile} className="mt-8 space-y-5">
        <label className="field-label">
          Display name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required className="field-input mt-2" placeholder="How should Sakhis see you?" />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="text-sm text-[var(--forest)]">{message}</p>}
        <button type="submit" disabled={busy} className="button-primary">{busy ? "Saving…" : "Save changes"}</button>
      </form>
    </section>
  );
}
