"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@smarthire/ui";
import { Video, Mic, MicOff, Camera, CameraOff, Volume2, ShieldCheck, UserCheck, FileText, ArrowRight, Loader2, RefreshCw, Clock, Sparkles, AlertCircle } from "lucide-react";
import { logger } from "@smarthire/logger";
import { MeetingSessionData } from "@/services/interview/meeting-service";

export default function MeetingLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState<MeetingSessionData | null>(null);
  const [role, setRole] = React.useState<"recruiter" | "candidate" | "guest">("candidate");
  const [displayName, setDisplayName] = React.useState<string>("Participant");
  const [error, setError] = React.useState<string | null>(null);

  // Media state
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = React.useState(true);
  const [camEnabled, setCamEnabled] = React.useState(true);
  const [audioLevel, setAudioLevel] = React.useState<number>(0);

  // Device lists
  const [audioDevices, setAudioDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = React.useState<string>("");
  const [selectedVideoId, setSelectedVideoId] = React.useState<string>("");

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const animFrameRef = React.useRef<number | null>(null);

  // Fetch session metadata
  const fetchSessionData = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/interviews/meeting/${token}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Meeting session not found");
      }

      setSession(data.sessionData);
      setRole(data.role);
      setDisplayName(data.displayName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    fetchSessionData();
  }, [fetchSessionData]);

  // Request media devices & setup preview
  const initMedia = React.useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      const videoInputs = devices.filter((d) => d.kind === "videoinput");

      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);

      if (audioInputs.length > 0) setSelectedAudioId(audioInputs[0].deviceId);
      if (videoInputs.length > 0) setSelectedVideoId(videoInputs[0].deviceId);

      // Audio Level Analyzer (Throttled to avoid Maximum update depth exceeded)
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(mediaStream);
        source.connect(analyser);
        analyser.fftSize = 64;

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let lastTime = 0;
        const updateMeter = (now: number) => {
          if (!analyserRef.current) return;
          if (now - lastTime > 100) {
            lastTime = now;
            analyserRef.current.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a, b) => a + b, 0);
            const avg = sum / dataArray.length;
            const newLevel = Math.min(100, Math.round((avg / 128) * 100));
            setAudioLevel((prev) => (Math.abs(prev - newLevel) > 3 ? newLevel : prev));
          }
          animFrameRef.current = requestAnimationFrame(updateMeter);
        };
        animFrameRef.current = requestAnimationFrame(updateMeter);
      } catch {
        // Audio meter fallback
      }
    } catch (err) {
      logger.warn("[Lobby] Camera/mic permission error", err);
      setError("Camera or Microphone permission denied. Please enable device permissions in your browser settings to join.");
    }
  }, []);

  React.useEffect(() => {
    initMedia();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      stream?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
    };
  }, [initMedia]);

  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, camEnabled]);

  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micEnabled;
        setMicEnabled(!micEnabled);
      }
    }
  };

  const toggleCam = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !camEnabled;
        setCamEnabled(!camEnabled);
      }
    }
  };

  const handleJoinRoom = () => {
    // Stop lobby stream before entering room
    stream?.getTracks().forEach((t) => t.stop());
    router.push(`/interview/room/${token}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          <span className="text-xs font-bold text-zinc-400">Loading SmartHire Meeting Lobby...</span>
        </div>
      </div>
    );
  }

  if (session && (session.status === "completed" || session.status === "ended")) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 text-white font-sans">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto font-bold text-xl">
            ✓
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight">SmartHire Room Closed</h2>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              This live interview session for <strong className="text-white">{session.candidateName}</strong> ({session.jobTitle}) has ended and the lobby is officially closed.
            </p>
          </div>
          <Button
            onClick={() => router.push(role === "recruiter" ? "/recruiter/pipeline" : "/candidate/applications")}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs py-3 rounded-2xl shadow-md cursor-pointer"
          >
            {role === "recruiter" ? "Return to Full Pipeline Kanban" : "Return to My Applications"}
          </Button>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto font-bold text-lg">
            !
          </div>
          <h2 className="text-lg font-black">Unable to Access Meeting Lobby</h2>
          <p className="text-xs text-zinc-400 font-medium">{error || "Meeting record not found."}</p>
          <Button
            onClick={() => router.push(role === "recruiter" ? "/recruiter/interviews" : "/candidate/interviews")}
            className="w-full bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Lobby Header */}
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md">
            SH
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight flex items-center gap-2">
              SmartHire Final Interview
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Native Video
              </span>
            </h1>
            <p className="text-xs text-zinc-400 font-medium">
              {session.jobTitle} • {session.companyName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Encrypted Session</span>
        </div>
      </div>

      {/* Main Lobby Content */}
      <div className="max-w-6xl mx-auto w-full space-y-6 my-4">
        {/* Horizontal Precautions & Guidelines Rectangle Banner */}
        <div className="bg-zinc-900/90 border border-zinc-800 p-4 sm:p-5 rounded-3xl shadow-lg space-y-2.5 text-left">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-indigo-400" /> Pre-Interview Precautions & Guidelines
            </span>
            <span className="text-[10px] font-bold text-zinc-400 uppercase">
              {session.jobTitle} • {session.durationMinutes} Mins Scheduled
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-zinc-300">
            <div className="bg-zinc-950/70 border border-zinc-800/80 p-3 rounded-2xl flex items-start gap-2.5">
              <Video className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block text-[11px]">Camera & Mic Setup</span>
                <span className="text-[10px] text-zinc-400 leading-snug block">Test your video preview and mic input level before clicking Join.</span>
              </div>
            </div>

            <div className="bg-zinc-950/70 border border-zinc-800/80 p-3 rounded-2xl flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block text-[11px]">Live Meeting Room</span>
                <span className="text-[10px] text-zinc-400 leading-snug block">Scheduled duration is {session.durationMinutes} mins. Recruiter scorecard opens automatically.</span>
              </div>
            </div>

            <div className="bg-zinc-950/70 border border-zinc-800/80 p-3 rounded-2xl flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block text-[11px]">Secure Native Room</span>
                <span className="text-[10px] text-zinc-400 leading-snug block">Native WebRTC P2P media stream with encrypted signaling & live side drawers.</span>
              </div>
            </div>
          </div>

          {session.focusNotes && (
            <div className="mt-1 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold uppercase text-[10px] block">Focus Notes / Precautions</span>
                <span>{session.focusNotes}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left 7 Cols: Video Camera Preview */}
          <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-video bg-zinc-900 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl flex items-center justify-center group">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 ${camEnabled ? "block" : "hidden"}`}
            />

            {!camEnabled && (
              <div className="flex flex-col items-center gap-2 text-zinc-500">
                <CameraOff className="h-12 w-12" />
                <span className="text-xs font-bold">Camera is turned off</span>
              </div>
            )}

            {/* Audio Level Indicator overlay */}
            <div className="absolute bottom-4 left-4 bg-zinc-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-white/10 flex items-center gap-2">
              {micEnabled ? <Mic className="h-3.5 w-3.5 text-emerald-400" /> : <MicOff className="h-3.5 w-3.5 text-red-400" />}
              <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-75"
                  style={{ width: micEnabled ? `${audioLevel}%` : "0%" }}
                />
              </div>
            </div>

            {/* In-Preview Mic/Cam Controls */}
            <div className="absolute bottom-4 right-4 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMic}
                className={`p-3 rounded-2xl transition-all shadow-md ${
                  micEnabled ? "bg-zinc-800/90 text-white hover:bg-zinc-700" : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={toggleCam}
                className={`p-3 rounded-2xl transition-all shadow-md ${
                  camEnabled ? "bg-zinc-800/90 text-white hover:bg-zinc-700" : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                {camEnabled ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Device Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl space-y-1">
              <label className="text-[10px] font-extrabold uppercase text-zinc-400 block">Microphone</label>
              <select
                value={selectedAudioId}
                onChange={(e) => setSelectedAudioId(e.target.value)}
                className="w-full bg-zinc-950 text-zinc-200 border border-zinc-800 rounded-xl px-2.5 py-1.5 font-medium focus:outline-none focus:border-indigo-500"
              >
                {audioDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl space-y-1">
              <label className="text-[10px] font-extrabold uppercase text-zinc-400 block">Camera</label>
              <select
                value={selectedVideoId}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                className="w-full bg-zinc-950 text-zinc-200 border border-zinc-800 rounded-xl px-2.5 py-1.5 font-medium focus:outline-none focus:border-indigo-500"
              >
                {videoDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Meeting Details & Join Action */}
        <div className="lg:col-span-5 space-y-6 bg-zinc-900 border border-zinc-800 p-6 rounded-3xl shadow-xl text-left">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 block mb-1">
              {role === "recruiter" ? "Recruiter Room Entrance" : "Candidate Meeting Lobby"}
            </span>
            <h2 className="text-2xl font-black tracking-tight">
              {role === "recruiter" ? session.candidateName : session.jobTitle}
            </h2>
            <p className="text-xs text-zinc-400 font-medium">
              {session.jobTitle} • {session.durationMinutes} mins scheduled
            </p>
          </div>

          <div className="space-y-3 pt-3 border-t border-zinc-800 text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-zinc-400 font-medium">Scheduled Time:</span>
              <span className="font-bold text-white">
                {new Date(session.scheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-zinc-400 font-medium">
                {role === "recruiter" ? "Assigned Recruiter:" : "Interviewer:"}
              </span>
              <span className="font-bold text-indigo-300">{session.interviewerName}</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-zinc-400 font-medium">Candidate:</span>
              <span className="font-bold text-white">{session.candidateName}</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-zinc-400 font-medium">Lobby Status:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                {role === "recruiter" ? "Candidate ready for live interview" : "Ready to enter meeting room"}
              </span>
            </div>
          </div>

          {/* Recruiter Shortcuts */}
          {role === "recruiter" && (
            <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-2xl space-y-2 text-xs">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Recruiter Quick Context</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/recruiter/candidates/${session.candidateId}`)}
                  className="text-[11px] font-bold border-zinc-700 text-zinc-200 hover:bg-zinc-800 gap-1"
                >
                  <FileText className="h-3 w-3 text-indigo-400" /> Resume & Application
                </Button>
              </div>
            </div>
          )}

          {/* Join Button */}
          <Button
            onClick={handleJoinRoom}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm py-4 rounded-2xl gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            Join Interview Room <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>

      {/* Lobby Footer */}
      <div className="max-w-6xl mx-auto w-full text-center text-xs text-zinc-500 border-t border-zinc-900 pt-4">
        SmartHire Native Video Infrastructure • Real-time WebRTC Meeting Engine
      </div>
    </div>
  );
}
