import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  CheckCircle2,
  Copy,
  Edit2,
  KeyRound,
  Laptop,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import type { UserState } from '../types';
import {
  generateSyncKey,
  normalizeSyncKey,
} from '../utils/syncCrypto';
import {
  fetchVaultDevices,
  getCachedDevices,
  getDeviceName,
  getLastSyncedTime,
  getOrCreateDeviceId,
  getStoredSyncKey,
  pushVault,
  revokeDevice,
  setDeviceName,
  setStoredSyncKey,
  syncBidirectional,
  unlinkAllOtherDevices,
  type SyncDevice,
} from '../utils/syncService';

interface Props {
  state: UserState;
  isOpen: boolean;
  onClose: () => void;
  onStateMerged: (mergedState: UserState) => void;
}

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return 'Active now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(isoString).toLocaleDateString();
  } catch {
    return 'Recently';
  }
}

export function SyncModal({ state, isOpen, onClose, onStateMerged }: Props) {
  const [syncKey, setSyncKey] = useState<string | null>(getStoredSyncKey);
  const [lastSynced, setLastSynced] = useState<string | null>(getLastSyncedTime);
  const [inputCode, setInputCode] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Device management state
  const myDeviceId = getOrCreateDeviceId();
  const [devices, setDevices] = useState<Record<string, SyncDevice>>(getCachedDevices);
  const [myDeviceName, setMyDeviceName] = useState<string>(getDeviceName);
  const [editingDeviceName, setEditingDeviceName] = useState(false);
  const [deviceNameInput, setDeviceNameInput] = useState(getDeviceName);
  const [unlinkingDeviceId, setUnlinkingDeviceId] = useState<string | null>(null);
  const [rotatingKey, setRotatingKey] = useState(false);

  // Sync link for QR and direct sharing
  const syncLink = syncKey
    ? `${window.location.origin}${window.location.pathname}#/sync-pair?key=${encodeURIComponent(syncKey)}`
    : '';

  // Generate QR Code when syncKey is active
  useEffect(() => {
    if (!syncKey) {
      setQrDataUrl(null);
      return;
    }

    QRCode.toDataURL(syncLink, {
      width: 260,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [syncKey, syncLink]);

  // Fetch updated device list when modal opens
  useEffect(() => {
    if (isOpen && syncKey) {
      fetchVaultDevices(syncKey)
        .then((devs) => setDevices(devs))
        .catch(() => {});
    }
  }, [isOpen, syncKey]);

  if (!isOpen) return null;

  const handleStartNewSync = async () => {
    setErrorMsg(null);
    setSyncing(true);
    try {
      const newKey = generateSyncKey();
      const res = await syncBidirectional(newKey, state);
      setStoredSyncKey(newKey);
      setSyncKey(newKey);
      setDevices(res.devices);
      setLastSynced(new Date().toISOString());
      onStateMerged(res.mergedState);
      setSuccessMsg('Sync initialized! Scan the QR code or share the link on your other device.');
    } catch (err) {
      setErrorMsg(`Failed to initialize sync: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectWithCode = async () => {
    const clean = normalizeSyncKey(inputCode);
    if (!clean || clean.length < 10) {
      setErrorMsg('Please enter a valid pairing code (e.g. AD-8B4K-9M2P-4W1Q).');
      return;
    }
    setErrorMsg(null);
    setSyncing(true);
    try {
      const formattedKey = inputCode.trim().toUpperCase();
      const res = await syncBidirectional(formattedKey, state);
      setStoredSyncKey(formattedKey);
      setSyncKey(formattedKey);
      setDevices(res.devices);
      setLastSynced(new Date().toISOString());
      onStateMerged(res.mergedState);
      setInputCode('');
      setSuccessMsg('Device connected and synchronized successfully!');
    } catch (err) {
      setErrorMsg(`Failed to link device: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleManualSyncNow = async () => {
    if (!syncKey) return;
    setErrorMsg(null);
    setSyncing(true);
    try {
      const res = await syncBidirectional(syncKey, state);
      setDevices(res.devices);
      setLastSynced(new Date().toISOString());
      onStateMerged(res.mergedState);
      setSuccessMsg('All flashcards and progress synchronized!');
    } catch (err) {
      setErrorMsg(`Sync failed: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveDeviceName = () => {
    const trimmed = deviceNameInput.trim();
    if (!trimmed) return;
    setDeviceName(trimmed);
    setMyDeviceName(trimmed);
    setEditingDeviceName(false);
    setDevices((prev) => ({
      ...prev,
      [myDeviceId]: {
        ...prev[myDeviceId],
        name: trimmed,
      },
    }));
    if (syncKey) {
      pushVault(syncKey, state).catch(() => {});
    }
  };

  const handleRevokeRemote = async (targetId: string, targetName: string) => {
    if (!syncKey) return;
    if (!window.confirm(`Unlink "${targetName}"?\n\nThis device will lose sync access immediately upon its next sync.`)) {
      return;
    }
    setUnlinkingDeviceId(targetId);
    setErrorMsg(null);
    try {
      const updatedDevices = await revokeDevice(syncKey, targetId, state);
      setDevices(updatedDevices);
      setSuccessMsg(`"${targetName}" has been unlinked.`);
    } catch (err) {
      setErrorMsg(`Failed to unlink device: ${(err as Error).message}`);
    } finally {
      setUnlinkingDeviceId(null);
    }
  };

  const handleRotateAndUnlinkOthers = async () => {
    if (!syncKey) return;
    if (
      !window.confirm(
        'Are you sure you want to unlink all other devices?\n\nThis will generate a brand new sync key for this device. Any other phones or computers will be disconnected immediately and must re-scan your new QR code to sync.'
      )
    ) {
      return;
    }
    setRotatingKey(true);
    setErrorMsg(null);
    try {
      const { newKey, devices: freshDevices } = await unlinkAllOtherDevices(syncKey, state);
      setSyncKey(newKey);
      setDevices(freshDevices);
      setLastSynced(new Date().toISOString());
      setSuccessMsg('All other devices disconnected! A new pairing key has been generated.');
    } catch (err) {
      setErrorMsg(`Failed to unlink other devices: ${(err as Error).message}`);
    } finally {
      setRotatingKey(false);
    }
  };

  const handleUnlink = () => {
    if (
      window.confirm(
        'Are you sure you want to disconnect this device?\n\nYour local flashcards and review history will remain intact, but future reviews will no longer sync with other devices.'
      )
    ) {
      if (syncKey) {
        revokeDevice(syncKey, myDeviceId, state).catch(() => {});
      }
      setStoredSyncKey(null);
      setSyncKey(null);
      setLastSynced(null);
      setSuccessMsg('This device was disconnected from cloud sync.');
    }
  };

  const copyToClipboard = (text: string, isLink: boolean) => {
    navigator.clipboard.writeText(text).then(() => {
      if (isLink) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    });
  };

  const activeDeviceList = Object.values(devices).filter((d) => !d.revoked);

  const getDeviceIcon = (type: SyncDevice['type']) => {
    if (type === 'mobile') return <Smartphone className="h-4 w-4" />;
    if (type === 'tablet') return <Tablet className="h-4 w-4" />;
    return <Laptop className="h-4 w-4" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <Zap className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Multi-Device Cloud Sync</h2>
                {syncKey && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                End-to-end encrypted · No account or passwords required
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {syncKey ? (
            /* ACTIVE SYNC VIEW */
            <div className="space-y-6">
              {/* Sync Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Last Synchronized</div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {lastSynced ? new Date(lastSynced).toLocaleString() : 'Just now'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManualSyncNow}
                    disabled={syncing}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                  >
                    {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Sync Now
                  </button>
                  <button
                    onClick={handleUnlink}
                    className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:border-slate-700 dark:hover:bg-red-950/40"
                    title="Disconnect this device"
                    aria-label="Disconnect this device"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Linked Devices Management Section */}
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Laptop className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Linked Devices ({activeDeviceList.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400">Manage paired devices</span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border-t border-slate-100 dark:border-slate-800/70">
                  {activeDeviceList.map((dev) => {
                    const isCurrent = dev.id === myDeviceId;
                    const isUnlinking = unlinkingDeviceId === dev.id;

                    return (
                      <div key={dev.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                            isCurrent
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {getDeviceIcon(dev.type)}
                          </span>

                          <div className="space-y-0.5">
                            {isCurrent && editingDeviceName ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={deviceNameInput}
                                  onChange={(e) => setDeviceNameInput(e.target.value)}
                                  className="rounded-lg border border-slate-300 px-2 py-0.5 text-xs text-slate-800 focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveDeviceName();
                                    if (e.key === 'Escape') setEditingDeviceName(false);
                                  }}
                                />
                                <button
                                  onClick={handleSaveDeviceName}
                                  className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                  title="Save name"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingDeviceName(false)}
                                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  title="Cancel"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                                  {isCurrent ? myDeviceName : dev.name}
                                </span>
                                {isCurrent && (
                                  <>
                                    <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                                      This device
                                    </span>
                                    <button
                                      onClick={() => {
                                        setDeviceNameInput(myDeviceName);
                                        setEditingDeviceName(true);
                                      }}
                                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                      title="Rename this device"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}

                            <div className="text-[11px] text-slate-400">
                              {isCurrent ? 'Active now' : `Last active: ${formatRelativeTime(dev.lastActiveAt)}`}
                            </div>
                          </div>
                        </div>

                        {!isCurrent && (
                          <button
                            onClick={() => handleRevokeRemote(dev.id, dev.name)}
                            disabled={isUnlinking}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            title="Unlink this device"
                          >
                            {isUnlinking ? (
                              <Loader2 className="h-3 w-3 animate-spin text-red-500" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            <span>Unlink</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* QR Code Card */}
              <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-800/60 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-3">
                  <Smartphone className="h-4 w-4" /> Scan to Link Another Device
                </div>

                {qrDataUrl ? (
                  <div className="overflow-hidden rounded-2xl border-4 border-white bg-white p-2 shadow-md">
                    <img src={qrDataUrl} alt="Pairing QR Code" className="h-48 w-48" />
                  </div>
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                )}

                <p className="mt-3 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                  Open your camera on your phone to instantly link Adilingo. No login or app store download required.
                </p>

                {/* 1-Click Link Copy */}
                <div className="mt-4 flex w-full max-w-md items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                  <span className="truncate font-mono text-slate-600 dark:text-slate-300 text-[11px]">
                    {syncLink}
                  </span>
                  <button
                    onClick={() => copyToClipboard(syncLink, true)}
                    className="ml-2 inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-sm hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedLink ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Pairing Code Card */}
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Pairing Code</div>
                    <div className="font-mono text-base font-bold tracking-wider text-slate-900 dark:text-white">
                      {syncKey}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(syncKey, false)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedCode ? 'Copied' : 'Copy Code'}
                  </button>
                </div>
              </div>

              {/* Danger / Key Rotation Card */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                      <span>Security & Unlink All</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Lost a phone or want to disconnect all other devices? This generates a brand new sync key and cuts off access for all other devices immediately.
                    </p>
                  </div>
                  <button
                    onClick={handleRotateAndUnlinkOthers}
                    disabled={rotatingKey}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    {rotatingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                    Unlink All Others
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* NOT SYNCED YET VIEW */
            <div className="space-y-6">
              {/* Feature highlight */}
              <div className="rounded-2xl border border-rose-200/60 bg-rose-50/50 p-4 dark:border-rose-950 dark:bg-rose-950/20">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-slate-900 dark:text-white">Zero-Knowledge Private Sync</div>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      Your vocabulary progress is encrypted with <strong>AES-256</strong> on your device before leaving your browser. You can seamlessly switch between phone, laptop, and tablet.
                    </p>
                  </div>
                </div>
              </div>

              {/* Option 1: Start New Sync */}
              <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Laptop className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Start New Device Sync</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Generates a private QR code and pairing key for your devices.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleStartNewSync}
                  disabled={syncing}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                >
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                  Generate Sync QR Code
                </button>
              </div>

              {/* Option 2: Connect Existing Code */}
              <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Link with an Existing Code</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Already have a code from your PC or other device?
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="e.g. AD-8B4K-9M2P-4W1Q"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono uppercase tracking-wider text-slate-900 placeholder-slate-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    onClick={handleConnectWithCode}
                    disabled={syncing || !inputCode.trim()}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                  >
                    {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Connect'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

