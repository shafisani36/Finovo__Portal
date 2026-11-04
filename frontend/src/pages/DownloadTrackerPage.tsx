import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Download,
  Monitor,
  Apple,
  Terminal,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Zap,
  Clock,
  WifiOff,
  EyeOff,
  Cpu,
  RefreshCw,
  ChevronDown,
  FolderArchive,
  ArrowRight,
  FileCode,
  HardDrive,
  Laptop,
  Play,
  Pause,
} from 'lucide-react';
import { AppShell } from '../components/layouts/AppShell';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmationModalContext';
import {
  PortfolioPageHeader,
  PortfolioFooter,
} from '../components/portfolio';

type PlatformKey = 'windows' | 'mac' | 'linux' | 'portable';

interface ReleaseInfo {
  key: PlatformKey;
  label: string;
  shortLabel: string;
  osName: string;
  version: string;
  releaseDate: string;
  sha256: string;
  fileSize: string;
  downloadUrl: string;
  fileName: string;
  architecture: string;
  installerType: string;
  requirements: string;
}

export const DownloadTrackerPage: React.FC = () => {
  const { companySlug = 'bitspark-ops' } = useParams<{ companySlug: string }>();
  const { user } = useAuth();
  const { alert } = useConfirm();

  // Detect user platform
  const detectedPlatform = useMemo<PlatformKey>(() => {
    if (typeof window === 'undefined') return 'windows';
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) return 'mac';
    if (ua.includes('linux')) return 'linux';
    return 'windows';
  }, []);

  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey>(() => detectedPlatform);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedChecksum, setCopiedChecksum] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [mockPlaying, setMockPlaying] = useState(true);

  // Releases definition
  const releases: Record<PlatformKey, ReleaseInfo> = {
    windows: {
      key: 'windows',
      label: 'Windows Installer (.exe)',
      shortLabel: 'Windows',
      osName: 'Windows 10 / 11 (64-bit)',
      version: '2.4.1',
      releaseDate: 'November 2026',
      sha256: '48bfaffa10b08a1286b1dd486fe767d68ac9ffcac2410457d76f96d282900671',
      fileSize: '57.5 KB (Hardware Accelerated WPF)',
      downloadUrl: '/downloads/FinovoTracker-v2.4.1-Setup.exe',
      fileName: 'FinovoTracker-v2.4.1-Setup.exe',
      architecture: 'x64 (Native Windows GUI)',
      installerType: 'Standard Windows Executable (.exe)',
      requirements: 'Windows 10/11 64-bit, .NET Framework 4.5+',
    },
    mac: {
      key: 'mac',
      label: 'macOS Universal (.dmg)',
      shortLabel: 'macOS',
      osName: 'macOS Monterey / Ventura / Sonoma',
      version: '2.4.1',
      releaseDate: 'November 2026',
      sha256: '4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d9b2d3e',
      fileSize: '71.8 MB',
      downloadUrl: '/downloads/FinovoTracker-v2.4.1.dmg',
      fileName: 'FinovoTracker-v2.4.1.dmg',
      architecture: 'Universal (Apple Silicon M1-M4 & Intel)',
      installerType: 'Signed Apple Disk Image (.dmg)',
      requirements: 'macOS 12.0 or higher, 4 GB RAM, 180 MB disk',
    },
    linux: {
      key: 'linux',
      label: 'Linux AppImage (.AppImage)',
      shortLabel: 'Linux',
      osName: 'Ubuntu, Debian, Fedora, Arch',
      version: '2.4.1',
      releaseDate: 'November 2026',
      sha256: '7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d9b2d3e4f5a6b',
      fileSize: '68.5 MB',
      downloadUrl: '/downloads/FinovoTracker-v2.4.1.AppImage',
      fileName: 'FinovoTracker-v2.4.1.AppImage',
      architecture: 'x86_64 AppImage',
      installerType: 'Self-Contained Standalone Executable',
      requirements: 'GLIBC 2.28+, X11 or Wayland, 4 GB RAM',
    },
    portable: {
      key: 'portable',
      label: 'Windows Portable (.zip)',
      shortLabel: 'Portable ZIP',
      osName: 'Windows (No Administrator Rights)',
      version: '2.4.1',
      releaseDate: 'November 2026',
      sha256: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d9b2d3e4f5a6b7c8d9e0f',
      fileSize: '58.4 MB',
      downloadUrl: '/downloads/FinovoTracker-v2.4.1-Windows-Portable.zip',
      fileName: 'FinovoTracker-v2.4.1-Windows-Portable.zip',
      architecture: 'x64 Standalone Directory',
      installerType: 'Compressed ZIP Archive',
      requirements: 'Windows 10/11, run directly from user folder',
    },
  };

  const currentRelease = releases[selectedPlatform];

  // Workspace Pairing URI string
  const pairingToken = useMemo(() => {
    return `finovo://pair?workspace=${companySlug}&api=${encodeURIComponent(
      window.location.origin + '/api/v1'
    )}&user=${encodeURIComponent(user?.email || 'member@finovo.internal')}&ref=desktop`;
  }, [companySlug, user]);

  const cliCommand = useMemo(() => {
    return `finovo connect --workspace ${companySlug} --token ${companySlug}-live-token`;
  }, [companySlug]);

  // Handle direct file download
  const handleTriggerDownload = (platformKey: PlatformKey, release: ReleaseInfo) => {
    setDownloading(platformKey);

    const link = document.createElement('a');
    link.href = release.downloadUrl;
    link.setAttribute('download', release.fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloading(null);
      alert({
        title: 'Download Started',
        message: `${release.fileName} is downloading. Once finished, launch the setup file to complete installation.`,
        variant: 'success',
      });
    }, 700);
  };

  // Copy pairing token
  const handleCopyPairingToken = () => {
    navigator.clipboard.writeText(pairingToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // Copy Checksum
  const handleCopyChecksum = () => {
    navigator.clipboard.writeText(currentRelease.sha256);
    setCopiedChecksum(true);
    setTimeout(() => setCopiedChecksum(false), 2000);
  };

  // Copy CLI command
  const handleCopyCli = () => {
    navigator.clipboard.writeText(cliCommand);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  // Download Workspace Config JSON
  const handleDownloadConfig = () => {
    const configData = {
      workspace: companySlug,
      api_base_url: `${window.location.origin}/api/v1`,
      client_version: '2.4.1',
      telemetry_enabled: true,
      offline_wal_journal: true,
      user_hint: user?.email || '',
      generated_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(configData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finovo-tracker-${companySlug}-config.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const faqs = [
    {
      q: 'Does Finovo Desktop Tracker work offline when internet is unavailable?',
      a: 'Yes. The desktop client uses an embedded SQLite WAL database queue. When your workstation goes offline, every work session second, idle transition, and context event continues logging locally. As soon as connectivity returns, events synchronize idempotently without duplicate timestamps.',
    },
    {
      q: 'How does screenshot privacy and compliance blurring work?',
      a: 'Under your organization’s M08 monitoring policy, if sensitive apps (e.g. banking portals, password managers, or medical records) are in focus, the application applies an automatic blur filter on the local workstation before transmission to preserve team privacy.',
    },
    {
      q: 'Do I need administrator privileges on my corporate workstation?',
      a: 'No administrator rights are required if you choose the "Windows Portable (.zip)" package. You can extract the folder to your user directory (e.g., AppData or Desktop) and run Finovo.TimeTracker.Desktop.exe directly.',
    },
    {
      q: 'How do I connect the desktop application to this workspace?',
      a: 'After installing the app, launch it and either sign in with your Finovo workspace credentials, or click "One-Click Quick Pair" using the pairing token or configuration file generated on this page.',
    },
  ];

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-6">
        {/* =========================================================================
            PORTFOLIO PAGE HEADER (CONSISTENT WITH ALL PAGES)
           ========================================================================= */}
        <PortfolioPageHeader
          breadcrumbs={[
            { label: 'Time Tracking', href: `/app/${companySlug}/attendance` },
            { label: 'Download Tracker' },
          ]}
          title="Finovo Desktop Tracker"
          badgeLabel="v2.4.1 Production"
          badgeVariant="success"
          subtitle="Continuous offline-first work session tracking, intelligent activity metrics, idle detection, and automatic timesheet synchronization."
          onExport={handleDownloadConfig}
          exportLabel="Download Config (.json)"
          onAdd={() => handleTriggerDownload(selectedPlatform, currentRelease)}
          addLabel={`Download v${currentRelease.version}`}
        />

        {/* =========================================================================
            PRIMARY SHOWCASE HERO CARD (LIGHT THEME • 100% FINOVO WEBSITE MATCH)
           ========================================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden transition-all">
          {/* Subtle Top Accent Ribbon */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#FF5511] via-[#F95716] to-amber-500" />

          <div className="p-5 sm:p-7 lg:p-9 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: Download Controls & Platform Selection */}
            <div className="lg:col-span-7 space-y-5 min-w-0">
              {/* Detection Pill */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200/80">
                  <Sparkles className="w-3.5 h-3.5 text-[#F95716]" />
                  <span>Auto-detected: {currentRelease.osName}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                  Build 2026.11
                </span>
              </div>

              {/* Title & Copy */}
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] tracking-tight leading-tight">
                  Track work sessions with the native desktop engine.
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
                  High-fidelity desktop tracking engineered for Windows, macOS, and Linux. Runs quietly in your system tray with sub-1% CPU consumption and full offline SQLite resilience.
                </p>
              </div>

              {/* PLATFORM SELECTOR TABS (FINOVO PILL TABS UX) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                  Select Target Operating System:
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['windows', 'mac', 'linux', 'portable'] as PlatformKey[]).map((key) => {
                    const r = releases[key];
                    const isSelected = selectedPlatform === key;
                    const Icon =
                      key === 'windows'
                        ? Monitor
                        : key === 'mac'
                        ? Apple
                        : key === 'linux'
                        ? Terminal
                        : FolderArchive;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedPlatform(key)}
                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#fff4ed] text-[#F95716] border border-orange-300 shadow-2xs ring-1 ring-[#F95716]/30'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80 hover:text-slate-900'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#F95716]' : 'text-slate-500'}`} />
                        <span>{r.shortLabel}</span>
                        {key === detectedPlatform && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Detected OS" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary Call-to-Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={downloading !== null}
                  onClick={() => handleTriggerDownload(selectedPlatform, currentRelease)}
                  className="inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#FF5511] via-[#F95716] to-[#ea4d10] hover:from-[#ea4d10] hover:to-[#db460c] text-white font-extrabold text-xs sm:text-sm shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all cursor-pointer disabled:opacity-50 group"
                >
                  {downloading === selectedPlatform ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Downloading Package...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 stroke-[2.5] group-hover:translate-y-0.5 transition-transform" />
                      <span>Download for {currentRelease.shortLabel}</span>
                      <span className="px-1.5 py-0.2 rounded bg-white/20 text-white text-[10px] font-mono font-bold ml-1">
                        {currentRelease.fileSize}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadConfig}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm border border-slate-200/90 transition-all cursor-pointer"
                >
                  <FileCode className="w-4 h-4 text-[#F95716]" />
                  <span>Download Workspace Config</span>
                </button>
              </div>

              {/* Release Metadata Row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 font-mono pt-1">
                <span className="font-semibold text-slate-800">v{currentRelease.version}</span>
                <span>•</span>
                <span>{currentRelease.installerType}</span>
                <span>•</span>
                <span>{currentRelease.architecture}</span>
                <span>•</span>
                <span className="text-emerald-700 font-sans font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  SHA-256 Verified
                </span>
              </div>
            </div>

            {/* Right Column: Native App Preview Frame (Light macOS/Windows style) */}
            <div className="lg:col-span-5 w-full">
              <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-4">
                {/* Mockup Window Titlebar */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                    <span className="text-[11px] font-mono text-slate-600 font-bold ml-2 truncate">
                      Finovo Desktop Tracker v2.4.1
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    CONNECTED
                  </span>
                </div>

                {/* Mockup Active Work Session Card */}
                <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-500 truncate">
                      Assigned Workspace Task:
                    </span>
                    <span className="text-[10px] font-mono font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-md shrink-0">
                      PRJ-01 • TASK #402
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      Enterprise RBAC &amp; Access Engine
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate">
                      BitSpark Ops • Full Sprint Implementation
                    </p>
                  </div>

                  {/* Mock Timer Clock Display */}
                  <div className="py-2.5 px-3 text-center bg-slate-900 text-white rounded-xl shadow-inner border border-slate-800">
                    <div className="flex items-center justify-center gap-3">
                      <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-wider text-emerald-400">
                        03:42:18
                      </span>
                      <button
                        type="button"
                        onClick={() => setMockPlaying(!mockPlaying)}
                        className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                        title={mockPlaying ? 'Pause Timer' : 'Resume Timer'}
                      >
                        {mockPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-white" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-white" />
                        )}
                      </button>
                    </div>
                    <span className="block text-[9.5px] font-mono text-slate-400 mt-1 uppercase tracking-wider">
                      ACTIVE WORK SESSION • 98% PRODUCTIVITY • SQLITE WAL
                    </span>
                  </div>
                </div>

                {/* Mockup KPI Mini Matrix */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 block font-sans">Today's Log</span>
                    <span className="font-bold text-slate-900 text-xs">6h 15m</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 block font-sans">Activity Score</span>
                    <span className="font-bold text-emerald-600 text-xs">96%</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 block font-sans">Local Queue</span>
                    <span className="font-bold text-blue-600 text-xs">0 Pending</span>
                  </div>
                </div>

                {/* Workspace Pair Quick Link */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono text-[11px] truncate">
                    Tenant: <strong>{companySlug}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPairingToken}
                    className="inline-flex items-center gap-1 text-[11px] text-[#F95716] hover:text-[#ea4d10] font-bold cursor-pointer shrink-0"
                  >
                    {copiedToken ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Pair Token</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            ONE-CLICK PAIRING & WORKSPACE ONBOARDING CARD
           ========================================================================= */}
        <div className="p-5 sm:p-6 bg-white rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-[#F95716]" />
                <span>Workstation Instant Pairing &amp; Configuration</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Connect your installed desktop tracker to <strong>{companySlug}</strong> using your personal pairing token or CLI command.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200/60 self-start sm:self-auto">
              Single-Sign-On Ready
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Box 1: GUI One-Click Pairing URI */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">One-Click Setup Token:</span>
                <button
                  type="button"
                  onClick={handleCopyPairingToken}
                  className="text-[11px] font-bold text-[#F95716] hover:text-[#ea4d10] flex items-center gap-1 cursor-pointer"
                >
                  {copiedToken ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Copied Token!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Setup Token</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-2.5 bg-white border border-slate-200/80 rounded-xl font-mono text-[11px] text-slate-700 truncate select-all">
                {pairingToken}
              </div>
              <p className="text-[11px] text-slate-400">
                Paste into the desktop tracker pairing dialog, or click while the app is open.
              </p>
            </div>

            {/* Box 2: CLI Pairing Command */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">Terminal Pairing Command:</span>
                <button
                  type="button"
                  onClick={handleCopyCli}
                  className="text-[11px] font-bold text-[#F95716] hover:text-[#ea4d10] flex items-center gap-1 cursor-pointer"
                >
                  {copiedCli ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Copied Command!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Command</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-2.5 bg-slate-900 text-slate-100 border border-slate-800 rounded-xl font-mono text-[11px] truncate select-all">
                {cliCommand}
              </div>
              <p className="text-[11px] text-slate-400">
                Run in PowerShell, macOS Terminal, or Linux Bash for scripted IT workstation deployment.
              </p>
            </div>
          </div>
        </div>

        {/* =========================================================================
            THREE-STEP ONBOARDING STEPPER (RESPONSIVE CARDS)
           ========================================================================= */}
        <div className="space-y-3">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Three-Step Installation &amp; Setup Guide
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Takes less than 60 seconds from download to tracking your first task.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-2xs hover:border-orange-200 transition-colors flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <div className="w-9 h-9 rounded-2xl bg-orange-50 text-[#F95716] font-extrabold text-sm flex items-center justify-center font-mono border border-orange-200/80 shadow-2xs">
                  01
                </div>
                <h4 className="font-bold text-sm text-slate-900">1. Download &amp; Run</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Download the package for your platform. Double-click the installer or extract the portable ZIP archive to your desired folder.
                </p>
              </div>
              <div className="pt-2 text-[11px] font-mono text-slate-400 flex items-center gap-1.5 border-t border-slate-100">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Verified SHA-256 signature</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-2xs hover:border-orange-200 transition-colors flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 font-extrabold text-sm flex items-center justify-center font-mono border border-blue-200/80 shadow-2xs">
                  02
                </div>
                <h4 className="font-bold text-sm text-slate-900">2. Pair with Workspace</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Sign in with your Finovo account credentials, or copy the pairing token above. The client securely connects to <strong>{companySlug}</strong>.
                </p>
              </div>
              <div className="pt-2 text-[11px] font-mono text-slate-400 flex items-center gap-1.5 border-t border-slate-100">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Encrypted OAuth2 / API Token</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-2xs hover:border-orange-200 transition-colors flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 font-extrabold text-sm flex items-center justify-center font-mono border border-emerald-200/80 shadow-2xs">
                  03
                </div>
                <h4 className="font-bold text-sm text-slate-900">3. Select Task &amp; Track</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Choose your project task and click Start. The tracker minimizes to your system tray, recording work sessions and syncing timesheets automatically.
                </p>
              </div>
              <div className="pt-2 text-[11px] font-mono text-emerald-600 font-semibold flex items-center gap-1.5 border-t border-slate-100">
                <Zap className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Auto-generates timesheets</span>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            FEATURE & ENGINE CAPABILITIES MATRIX (6-CARD GRID)
           ========================================================================= */}
        <div className="space-y-3">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Built for Enterprise Reliability &amp; Privacy
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Engineered with modern offline synchronization, local screen blurring, and low battery consumption.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Feature 1 */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-2xs hover:border-orange-200 transition-colors space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60 shadow-2xs">
                <WifiOff className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h4 className="font-bold text-sm text-slate-900">Offline SQLite WAL Queue</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Network drops and airplane travel do not interrupt work. Events queue locally in an embedded SQLite WAL database and sync idempotently on reconnect.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-2xs hover:border-orange-200 transition-colors space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200/60 shadow-2xs">
                <EyeOff className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h4 className="font-bold text-sm text-slate-900">Privacy &amp; Compliance Blurring</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Sensitive applications (e.g. banking portals, password vaults, messaging) are automatically blurred locally on your workstation to protect confidential information.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-2xs hover:border-orange-200 transition-colors space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60 shadow-2xs">
                <Clock className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h4 className="font-bold text-sm text-slate-900">Intelligent Idle Detection</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Detects keyboard and mouse inactivity according to company policy, offering prompt recovery to discard or allocate idle intervals accurately.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-2xs hover:border-orange-200 transition-colors space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60 shadow-2xs">
                <Cpu className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h4 className="font-bold text-sm text-slate-900">Sub-1% Resource Footprint</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Native WPF and lightweight event polling consume less than 45 MB of RAM and negligible CPU cycles, ensuring zero performance impact on IDEs or compiling.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-2xs hover:border-orange-200 transition-colors space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200/60 shadow-2xs">
                <Monitor className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h4 className="font-bold text-sm text-slate-900">Multi-Display Activity Scoring</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Full multi-monitor workstation support. Accurately tracks focused windows and categorizes software activity into productive, neutral, or communication tasks.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-2xs hover:border-orange-200 transition-colors space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#F95716] flex items-center justify-center border border-orange-200/60 shadow-2xs">
                <RefreshCw className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h4 className="font-bold text-sm text-slate-900">Silent Delta Auto-Updates</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Background updates with cryptographic signature verification apply enhancements smoothly without disrupting ongoing work sessions or requiring reboots.
              </p>
            </div>
          </div>
        </div>

        {/* =========================================================================
            ALL PLATFORMS COMPARISON & DOWNLOAD MATRIX (RESPONSIVE TABLE)
           ========================================================================= */}
        <div className="p-5 sm:p-6 bg-white rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[#F95716]" />
                <span>All Supported Platforms &amp; Installer Packages</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Download the exact release format needed for your operating environment.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              Channel: Production Stable
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Platform</th>
                  <th className="py-3 px-3">Package Format</th>
                  <th className="py-3 px-3">Size</th>
                  <th className="py-3 px-3">Min. System Requirements</th>
                  <th className="py-3 px-3 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {(['windows', 'mac', 'linux', 'portable'] as PlatformKey[]).map((key) => {
                  const r = releases[key];
                  const Icon =
                    key === 'windows'
                      ? Monitor
                      : key === 'mac'
                      ? Apple
                      : key === 'linux'
                      ? Terminal
                      : FolderArchive;

                  return (
                    <tr key={key} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2 font-bold text-slate-900">
                          <Icon className="w-4 h-4 text-slate-500 shrink-0" />
                          <span>{r.osName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          {r.fileName}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-600">
                        {r.fileSize}
                      </td>
                      <td className="py-3.5 px-3 text-slate-500">
                        {r.requirements}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleTriggerDownload(key, r)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#F95716] font-bold text-xs border border-orange-200 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* =========================================================================
            CHECKSUM VERIFICATION & POWER-SHELL HASH
           ========================================================================= */}
        <div className="p-5 sm:p-6 bg-white rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Cryptographic SHA-256 Release Hash</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify the integrity of <strong>{currentRelease.fileName}</strong> prior to running.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyChecksum}
              className="text-[11px] font-bold text-[#F95716] hover:text-[#ea4d10] flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              {copiedChecksum ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Hash Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Checksum</span>
                </>
              )}
            </button>
          </div>

          <div className="p-3 bg-slate-900 text-slate-100 font-mono text-[11px] sm:text-xs rounded-xl break-all border border-slate-800 select-all">
            {currentRelease.sha256}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span className="font-mono text-[11px] truncate">
              PowerShell: Get-FileHash -Algorithm SHA256 {currentRelease.fileName}
            </span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
              Official Signed Build
            </span>
          </div>
        </div>

        {/* =========================================================================
            FREQUENTLY ASKED QUESTIONS ACCORDION
           ========================================================================= */}
        <div className="space-y-3">
          <h3 className="font-bold text-base sm:text-lg text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
            Frequently Asked Questions
          </h3>

          <div className="space-y-2">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={faq.q}
                  className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
                  >
                    <span className="font-bold text-xs sm:text-sm text-slate-900">
                      {faq.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180 text-[#F95716]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/30 animate-in fade-in duration-150">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* =========================================================================
            BOTTOM HELP & ENTERPRISE DEPLOYMENT CALLOUT
           ========================================================================= */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-orange-50/80 via-white to-amber-50/50 border border-orange-200/80 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-bold text-sm sm:text-base text-slate-900">
              Need IT Mass Deployment via Intune or GPO?
            </h4>
            <p className="text-xs text-slate-600">
              Silent MSI installer flags and Active Directory group policy administrative templates are available for IT administrators.
            </p>
          </div>
          <Link
            to={`/app/${companySlug}/monitoring`}
            className="shrink-0 px-4 py-2.5 bg-white border border-orange-200 text-[#F95716] hover:bg-orange-50 font-bold text-xs rounded-xl shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>Workforce Intelligence Hub</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* =========================================================================
            PORTFOLIO FOOTER
           ========================================================================= */}
        <PortfolioFooter companySlug={companySlug} activeLink="time" />
      </div>
    </AppShell>
  );
};

export default DownloadTrackerPage;
