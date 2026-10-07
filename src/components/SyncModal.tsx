import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  CheckCircle2,
  Copy,
  Laptop,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
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
  getLastSyncedTime,
  getStoredSyncKey,
  setStoredSyncKey,
  syncBidirectional,
} from '../utils/syncService';

interface Props {
  state: UserState;
  isOpen: boolean;
  onClose: () => void;
  onStateMerged: (mergedState: UserState) => void;
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

  if (!isOpen) return null;

  const handleStartNewSync = async () => {
    setErrorMsg(null);
    setSyncing(true);
    try {
      const newKey = generateSyncKey();
      const res = await syncBidirectional(newKey, state);
      setStoredSyncKey(newKey);
      setSyncKey(newKey);
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
      setLastSynced(new Date().toISOString());
      onStateMerged(res.mergedState);
      setSuccessMsg('All flashcards and progress synchronized!');
    } catch (err) {
      setErrorMsg(`Sync failed: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleUnlink = () => {
    if (window.confirm('Are you sure you want to unlink this device? Your local data will remain intact, but future reviews will no longer sync with other devices.')) {
      setStoredSyncKey(null);
      setSyncKey(null);
      setLastSynced(null);
      setSuccessMsg('Device unlinked from cloud sync.');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
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
                    title="Unlink device"
                    aria-label="Unlink device"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* QR Code Card */}
              <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-800/60 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-3">
                  <Smartphone className="h-4 w-4" /> Scan with Phone or Tablet
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
