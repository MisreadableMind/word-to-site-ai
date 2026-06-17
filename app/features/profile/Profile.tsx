import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { DateTime } from "luxon";
import { apiSend, ApiError } from "~/lib/api";
import { useMe, meKey, type User } from "~/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog } from "~/components/Dialog";
import { PasswordInput } from "~/components/PasswordInput";
import { AccountSubnav } from "~/components/AccountSubnav";
import "~/styles/account.css";

interface ProfileResponse {
  success: boolean;
  user: User & { status: string; createdAt: string };
}

type Msg = { kind: "success" | "error"; text: string } | null;

export function Profile() {
  const { data: user } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [profileMsg, setProfileMsg] = useState<Msg>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<Msg>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteMsg, setDeleteMsg] = useState<Msg>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveProfile() {
    setProfileMsg(null);
    setSavingProfile(true);
    try {
      const data = await apiSend<ProfileResponse>("/api/auth/profile", "PUT", { displayName });
      if (data.user.createdAt) setMemberSince(data.user.createdAt);
      qc.setQueryData(meKey, {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        planTier: data.user.planTier,
      });
      setProfileMsg({ kind: "success", text: "Profile updated" });
    } catch (err) {
      setProfileMsg({ kind: "error", text: err instanceof ApiError ? err.message : "Failed" });
    }
    setSavingProfile(false);
  }

  async function changePassword() {
    setPasswordMsg(null);
    if (newPassword !== confirmNewPassword) {
      setPasswordMsg({ kind: "error", text: "Passwords do not match" });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ kind: "error", text: "Password must be at least 8 characters" });
      return;
    }
    setSavingPassword(true);
    try {
      await apiSend("/api/auth/password", "PUT", { currentPassword, newPassword });
      setPasswordMsg({ kind: "success", text: "Password updated" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      setPasswordMsg({ kind: "error", text: err instanceof ApiError ? err.message : "Failed" });
    }
    setSavingPassword(false);
  }

  function requestDelete() {
    setDeleteMsg(null);
    if (!deletePassword) {
      setDeleteMsg({ kind: "error", text: "Enter your password to confirm" });
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await apiSend("/api/auth/account", "DELETE", { password: deletePassword });
      qc.clear();
      navigate({ to: "/login" });
    } catch (err) {
      setConfirmOpen(false);
      setDeleteMsg({ kind: "error", text: err instanceof ApiError ? err.message : "Failed" });
      setDeleting(false);
    }
  }

  const crumbName = user?.displayName || user?.email?.split("@")[0] || "Account";

  return (
    <>
      <div className="wts-top">
        <div className="wts-crumbs">
          <span>{crumbName}</span>
          <span className="sep">/</span>
          <span>Account</span>
          <span className="sep">/</span>
          <b>Settings</b>
        </div>
      </div>

      <div className="wts-content">
        <AccountSubnav />

        <div style={{ padding: "32px 36px 60px", maxWidth: 1080 }}>
          <h1 className="wts-page-title">Settings</h1>
          <p className="wts-page-lede">Your account, voice preferences and security.</p>

          <section className="account-section">
            <h2 className="account-section-head">Profile</h2>
            {profileMsg ? (
              <div className={`account-msg ${profileMsg.kind}`}>{profileMsg.text}</div>
            ) : null}

            <div className="account-row">
              <div>
                <div className="account-row-label">Email</div>
                <div className="account-row-hint">Used for sign-in and billing receipts.</div>
              </div>
              <div>
                <input
                  className="wts-input"
                  type="email"
                  value={user?.email || ""}
                  readOnly
                  style={{ maxWidth: 360, background: "var(--bg-2)", color: "var(--muted)" }}
                />
              </div>
            </div>

            <div className="account-row">
              <div>
                <div className="account-row-label">Display name</div>
                <div className="account-row-hint">Used in invoices and on shared sites.</div>
              </div>
              <div>
                <input
                  className="wts-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  style={{ maxWidth: 360 }}
                />
              </div>
            </div>

            <div className="account-row">
              <div>
                <div className="account-row-label">Plan</div>
                <div className="account-row-hint">Your current subscription tier.</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="wts-badge accent">
                  <span className="dot" />
                  {user?.planTier || "free"}
                </span>
                <Link
                  to="/billing"
                  className="wts-btn"
                  style={{ height: 28, padding: "0 12px", fontSize: 12.5 }}
                >
                  Manage
                </Link>
              </div>
            </div>

            <div className="account-row">
              <div>
                <div className="account-row-label">Member since</div>
              </div>
              <div style={{ fontSize: 13.5 }}>
                {memberSince
                  ? DateTime.fromISO(memberSince).toLocaleString({
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <button className="wts-btn primary" onClick={saveProfile} disabled={savingProfile}>
                Save changes
              </button>
            </div>
          </section>

          <section className="account-section" style={{ marginTop: 40 }}>
            <h2 className="account-section-head">Password</h2>
            {passwordMsg ? (
              <div className={`account-msg ${passwordMsg.kind}`}>{passwordMsg.text}</div>
            ) : null}

            <div className="account-row">
              <div>
                <div className="account-row-label">Change password</div>
                <div className="account-row-hint">
                  At least 8 characters. Use a unique password.
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
                <PasswordInput
                  id="currentPassword"
                  name="currentPassword"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  placeholder="Current password"
                  autoComplete="current-password"
                />
                <PasswordInput
                  id="newPassword"
                  name="newPassword"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="New password (8+ characters)"
                  autoComplete="new-password"
                  minLength={8}
                />
                <PasswordInput
                  id="confirmNewPassword"
                  name="confirmNewPassword"
                  value={confirmNewPassword}
                  onChange={setConfirmNewPassword}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
                <button
                  className="wts-btn primary"
                  onClick={changePassword}
                  disabled={savingPassword}
                  style={{ alignSelf: "flex-start", marginTop: 4 }}
                >
                  Update password
                </button>
              </div>
            </div>
          </section>

          <section className="account-section" style={{ marginTop: 40 }}>
            <h2 className="account-section-head danger">Danger zone</h2>
            {deleteMsg ? (
              <div className={`account-msg ${deleteMsg.kind}`}>{deleteMsg.text}</div>
            ) : null}

            <div className="account-row">
              <div>
                <div className="account-row-label">Delete account</div>
                <div className="account-row-hint">
                  Permanently delete your account and all associated data. This action cannot be
                  undone.
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
                <PasswordInput
                  id="deletePassword"
                  name="deletePassword"
                  value={deletePassword}
                  onChange={setDeletePassword}
                  placeholder="Confirm with your password"
                  autoComplete="current-password"
                />
                <button
                  className="wts-btn danger"
                  onClick={requestDelete}
                  style={{ alignSelf: "flex-start" }}
                >
                  Delete my account
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} ariaLabelledBy="del-acct-title">
        <h3 id="del-acct-title" className="wts-page-sub" style={{ fontSize: 16, marginBottom: 8 }}>
          Delete account?
        </h3>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 20 }}>
          This permanently deletes your account and all data. This action cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="wts-btn" onClick={() => setConfirmOpen(false)} disabled={deleting}>
            Cancel
          </button>
          <button className="wts-btn danger" onClick={confirmDelete} disabled={deleting}>
            Delete my account
          </button>
        </div>
      </Dialog>
    </>
  );
}
