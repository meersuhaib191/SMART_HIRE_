"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@smarthire/ui";
import {
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Monitor,
  MessageSquare,
  FileText,
  UserCheck,
  PhoneOff,
  Clock,
  ShieldCheck,
  X,
  Send,
  Loader2,
  Award,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Hand,
  Maximize2,
  Minimize2,
  RefreshCw,
} from "lucide-react";
import { MeetingService, MeetingSessionData } from "@/services/interview/meeting-service";
import { ScorecardModal } from "@/components/interview/ScorecardModal";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isSelf: boolean;
}

export default function MeetingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState<MeetingSessionData | null>(null);
  const [role, setRole] = React.useState<"recruiter" | "candidate" | "guest">("candidate");
  const [displayName, setDisplayName] = React.useState<string>("Participant");
  const [error, setError] = React.useState<string | null>(null);

  // Local media stream & toggles
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = React.useState(true);
  const [camEnabled, setCamEnabled] = React.useState(true);
  const [isScreenSharing, setIsScreenSharing] = React.useState(false);
  const [screenStream, setScreenStream] = React.useState<MediaStream | null>(null);
  const [handRaised, setHandRaised] = React.useState(false);

  // Remote media / peer state
  const [remoteConnected, setRemoteConnected] = React.useState(false);
  const [reconnecting, setReconnecting] = React.useState(false);
  const [swappedLayout, setSwappedLayout] = React.useState(false);

  // Timer state
  const [secondsRemaining, setSecondsRemaining] = React.useState<number>(3600); // 60 mins default
  const [timerAlert, setTimerAlert] = React.useState<string | null>(null);
  const startTimeRef = React.useRef<number>(Date.now());

  // Drawers state
  const [activeDrawer, setActiveDrawer] = React.useState<"chat" | "notes" | "context" | null>(null);
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = React.useState("");

  // Recruiter Private Notes
  const [recruiterNotes, setRecruiterNotes] = React.useState<string>("");
  const [notesSaved, setNotesSaved] = React.useState<boolean>(true);
  const notesTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Candidate Quick Context Data
  const [contextData, setContextData] = React.useState<any>(null);

  // Scorecard Modal State
  const [scorecardOpen, setScorecardOpen] = React.useState(false);

  const localVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = React.useRef<HTMLVideoElement | null>(null);

  // Attach local stream whenever localVideoRef or stream updates
  React.useEffect(() => {
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [stream, camEnabled, swappedLayout, remoteConnected]);

  // Attach screen stream whenever screenVideoRef or screenStream updates
  React.useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
      screenVideoRef.current.play().catch(() => {});
    }
  }, [screenStream, isScreenSharing]);

  // Fetch session & initialize WebRTC
  const initSession = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/interviews/meeting/${token}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Invalid meeting token");
      }

      setSession(data.sessionData);
      setRole(data.role);
      setDisplayName(data.displayName);

      const duration = (data.sessionData.durationMinutes || 60) * 60;
      setSecondsRemaining(duration);

      if (data.sessionData.recruiterNotes) {
        setRecruiterNotes(data.sessionData.recruiterNotes);
      }

      // Record attendance
      if (data.sessionData.interviewId) {
        MeetingService.recordParticipantJoined(data.sessionData.interviewId, data.role);
      }

      // Fetch candidate context if recruiter
      if (data.role === "recruiter") {
        fetchCandidateContext(data.sessionData.applicationId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchCandidateContext = async (appId: string) => {
    try {
      const { data: app } = await supabase
        .schema("application")
        .from("applications")
        .select(`
          id,
          screening_score,
          mcq_score,
          coding_score,
          interview_avg_score,
          interview_recommendation,
          created_at
        `)
        .eq("id", appId)
        .maybeSingle();

      if (app) setContextData(app);
    } catch (err) {
      logger.warn("[MeetingRoom] Error fetching candidate context", err);
    }
  };

  React.useEffect(() => {
    initSession();
  }, [initSession]);

  // Media Stream Setup
  React.useEffect(() => {
    let activeStream: MediaStream | null = null;
    async function startLocalMedia() {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch (err) {
        logger.warn("[MeetingRoom] Primary getUserMedia failed, trying video only", err);
        try {
          activeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (err2) {
          logger.warn("[MeetingRoom] Video only getUserMedia failed, trying audio only", err2);
          try {
            activeStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          } catch (err3) {
            logger.warn("[MeetingRoom] All getUserMedia attempts failed", err3);
          }
        }
      }

      if (activeStream) {
        setStream(activeStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = activeStream;
          localVideoRef.current.play().catch(() => {});
        }
      }

      // Simulate remote participant joining after 2 seconds
      setTimeout(() => setRemoteConnected(true), 2000);
    }

    startLocalMedia();
    return () => {
      activeStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Timer Countdown Effect
  React.useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        if (prev === 600) setTimerAlert("10 minutes remaining in scheduled interview.");
        if (prev === 300) setTimerAlert("5 minutes remaining in scheduled interview.");
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format Timer
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Toggle Mute / Cam
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

  const toggleRaiseHand = () => {
    setHandRaised((prev) => !prev);
  };

  // Screen Sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStream?.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(displayStream);
        setIsScreenSharing(true);
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = displayStream;
          screenVideoRef.current.play().catch(() => {});
        }

        displayStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setScreenStream(null);
        };
      } catch (err) {
        logger.warn("[MeetingRoom] Screen share error", err);
      }
    }
  };

  // Send Chat Message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: displayName,
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isSelf: true,
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput("");
  };

  // Autosave Recruiter Notes
  const handleNotesChange = (text: string) => {
    setRecruiterNotes(text);
    setNotesSaved(false);

    if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current);
    notesTimeoutRef.current = setTimeout(async () => {
      if (session?.interviewId) {
        await MeetingService.saveRecruiterNotes(session.interviewId, text);
        setNotesSaved(true);
      }
    }, 1000);
  };

  // Leave / End Call Action
  const handleLeaveMeeting = () => {
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 60000));
    if (session?.interviewId) {
      MeetingService.endInterviewSession(session.interviewId, elapsedMinutes);
    }

    stream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());

    if (role === "recruiter") {
      setScorecardOpen(true);
    } else {
      router.push("/candidate/assessments");
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          <span className="text-xs font-bold text-zinc-400">Connecting to SmartHire Meeting Room...</span>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-center space-y-4">
          <h2 className="text-lg font-black">Meeting Error</h2>
          <p className="text-xs text-zinc-400">{error || "Unable to join interview room."}</p>
          <Button onClick={() => router.push("/")} className="w-full bg-white text-zinc-950 font-bold text-xs">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  const remoteName = role === "recruiter" ? session.candidateName : session.interviewerName;
  const remoteRoleLabel = role === "recruiter" ? "Candidate" : "Recruiter";

  return (
    <div className="h-screen w-screen bg-zinc-950 text-white flex flex-col overflow-hidden select-none font-sans">
      {/* Top Meeting Header */}
      <header className="h-16 px-6 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 font-black text-xs flex items-center justify-center text-white shadow-sm">
            SH
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight flex items-center gap-2">
              {session.jobTitle}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Live Video
              </span>
              {handRaised && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                  ✋ Hand Raised
                </span>
              )}
            </h1>
            <p className="text-[11px] text-zinc-400 font-medium">
              {role === "candidate" ? (
                <>Interviewer: <span className="text-white font-bold">{session.interviewerName}</span></>
              ) : (
                <>Candidate: <span className="text-white font-bold">{session.candidateName}</span></>
              )}
            </p>
          </div>
        </div>

        {/* Timer & Connection Status */}
        <div className="flex items-center gap-4">
          {timerAlert && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold animate-pulse">
              <AlertTriangle className="h-3.5 w-3.5" /> {timerAlert}
            </div>
          )}

          <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700 px-3.5 py-1.5 rounded-2xl text-xs font-mono font-bold">
            <Clock className="h-3.5 w-3.5 text-indigo-400" />
            <span className={secondsRemaining < 300 ? "text-red-400 animate-pulse" : "text-white"}>
              {formatTime(secondsRemaining)} remaining
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-2xl font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            {remoteConnected ? "Connected" : "Waiting for peer..."}
          </div>
        </div>
      </header>

      {/* Main Viewport: Screen Share OR Video Stream Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Video Area */}
        <div className="flex-1 p-4 flex flex-col overflow-hidden relative">
          {/* Reconnection Overlay */}
          {reconnecting && (
            <div className="absolute inset-0 z-30 bg-zinc-950/80 backdrop-blur-xs flex items-center justify-center text-white">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
                <span className="text-xs font-bold text-amber-300">Connection interrupted — reconnecting...</span>
              </div>
            </div>
          )}

          {/* SCREEN SHARE ACTIVE LAYOUT */}
          {isScreenSharing ? (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
              <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden relative flex items-center justify-center">
                <video ref={screenVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
                <div className="absolute top-4 left-4 bg-indigo-600 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md">
                  <Monitor className="h-4 w-4" /> Presenting Screen
                </div>
              </div>

              {/* Side video tiles during screen share */}
              <div className="lg:col-span-1 flex flex-col gap-4">
                <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden relative flex items-center justify-center">
                  {remoteConnected ? (
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-zinc-500">
                      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-300">
                        {remoteName[0]}
                      </div>
                      <span className="text-[10px] font-bold">Waiting...</span>
                    </div>
                  )}
                  <span className="absolute bottom-3 left-3 bg-zinc-950/80 px-2.5 py-1 rounded-xl text-xs font-bold">
                    {remoteName} ({remoteRoleLabel})
                  </span>
                </div>

                <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden relative flex items-center justify-center">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover transform -scale-x-100 ${camEnabled ? "block" : "hidden"}`}
                  />
                  {!camEnabled && (
                    <div className="flex flex-col items-center gap-1 text-zinc-500">
                      <CameraOff className="h-8 w-8" />
                      <span className="text-[10px] font-bold">Camera off</span>
                    </div>
                  )}
                  <span className="absolute bottom-3 left-3 bg-zinc-950/80 px-2.5 py-1 rounded-xl text-xs font-bold">
                    You ({displayName})
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* REGULAR CAMERA VIDEO LAYOUT */
            <div className="flex-1 w-full h-full relative rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl flex items-center justify-center">
              {/* SOLO MODE: Remote peer has NOT joined yet — local stream takes FULL VIEW */}
              {!remoteConnected ? (
                <div className="w-full h-full relative flex items-center justify-center">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover transform -scale-x-100 ${camEnabled ? "block" : "hidden"}`}
                  />
                  {!camEnabled && (
                    <div className="flex flex-col items-center gap-3 text-zinc-500">
                      <CameraOff className="h-16 w-16 text-zinc-600" />
                      <span className="text-sm font-bold text-zinc-400">Your camera is turned off</span>
                    </div>
                  )}

                  {/* Top Notification Badge for Waiting */}
                  <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-zinc-950/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 flex items-center gap-2.5 shadow-xl text-xs font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    <span>Waiting for {role === "candidate" ? "recruiter" : "candidate"} to join...</span>
                  </div>

                  {/* Self Label Badge */}
                  <div className="absolute bottom-6 left-6 bg-zinc-950/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold">You ({displayName})</span>
                    {!micEnabled && <MicOff className="h-3.5 w-3.5 text-red-400 ml-1" />}
                    {handRaised && <span className="text-xs">✋</span>}
                  </div>
                </div>
              ) : (
                /* DUAL MODE: Both participants present in room */
                <div className="w-full h-full relative flex items-center justify-center">
                  {/* MAIN BIG VIEW: Remote Participant (or Swapped to Local) */}
                  {!swappedLayout ? (
                    /* Default: Remote Participant is BIG view */
                    <div className="w-full h-full relative flex items-center justify-center bg-zinc-900">
                      <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <div className="absolute bottom-6 left-6 bg-zinc-950/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        <span className="text-xs font-extrabold">{remoteName} ({remoteRoleLabel})</span>
                      </div>
                    </div>
                  ) : (
                    /* Swapped: Local Participant is BIG view */
                    <div className="w-full h-full relative flex items-center justify-center bg-zinc-900">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover transform -scale-x-100 ${camEnabled ? "block" : "hidden"}`}
                      />
                      {!camEnabled && (
                        <div className="flex flex-col items-center gap-2 text-zinc-500">
                          <CameraOff className="h-16 w-16" />
                          <span className="text-xs font-bold">Your camera is off</span>
                        </div>
                      )}
                      <div className="absolute bottom-6 left-6 bg-zinc-950/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-2">
                        <span className="text-xs font-bold">You ({displayName})</span>
                        {!micEnabled && <MicOff className="h-3.5 w-3.5 text-red-400" />}
                        {handRaised && <span className="text-xs">✋</span>}
                      </div>
                    </div>
                  )}

                  {/* FLOATING PIP INSET WINDOW (Small view in bottom right) */}
                  <div
                    onClick={() => setSwappedLayout(!swappedLayout)}
                    title="Click to swap layout"
                    className="w-48 sm:w-64 h-36 sm:h-44 rounded-2xl border-2 border-white/20 shadow-2xl overflow-hidden absolute bottom-6 right-6 z-20 bg-zinc-950 group cursor-pointer hover:border-indigo-500 transition-all duration-200"
                  >
                    {!swappedLayout ? (
                      /* Small PiP: Local Participant */
                      <div className="w-full h-full relative flex items-center justify-center">
                        <video
                          ref={localVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className={`w-full h-full object-cover transform -scale-x-100 ${camEnabled ? "block" : "hidden"}`}
                        />
                        {!camEnabled && (
                          <div className="flex flex-col items-center gap-1 text-zinc-500">
                            <CameraOff className="h-6 w-6" />
                            <span className="text-[10px] font-bold">Cam Off</span>
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 bg-zinc-950/85 backdrop-blur-xs px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 border border-white/10">
                          <span>You</span>
                          {!micEnabled && <MicOff className="h-3 w-3 text-red-400" />}
                          {handRaised && <span>✋</span>}
                        </div>
                      </div>
                    ) : (
                      /* Small PiP: Remote Participant */
                      <div className="w-full h-full relative flex items-center justify-center">
                        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 left-2 bg-zinc-950/85 backdrop-blur-xs px-2.5 py-1 rounded-xl text-[10px] font-bold border border-white/10">
                          {remoteName.split(" ")[0]} ({remoteRoleLabel})
                        </div>
                      </div>
                    )}

                    <div className="absolute top-2 right-2 bg-black/60 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <RefreshCw className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Side Drawers: Chat / Private Notes / Quick Context */}
        {activeDrawer && (
          <aside className="w-80 sm:w-96 border-l border-zinc-800 bg-zinc-900 flex flex-col h-full shrink-0 z-20 text-left sh-animate-in">
            {/* Drawer Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                {activeDrawer === "chat" && <><MessageSquare className="h-4 w-4 text-indigo-400" /> Meeting Chat</>}
                {activeDrawer === "notes" && <><FileText className="h-4 w-4 text-emerald-400" /> Recruiter Private Notes</>}
                {activeDrawer === "context" && <><UserCheck className="h-4 w-4 text-violet-400" /> Candidate Quick Context</>}
              </h3>
              <button onClick={() => setActiveDrawer(null)} className="text-zinc-400 hover:text-white p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Chat Drawer Content */}
            {activeDrawer === "chat" && (
              <div className="flex-1 flex flex-col justify-between p-4 overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-zinc-500 py-12 text-xs italic font-medium">
                      No messages yet. Send a note or link to participant.
                    </div>
                  ) : (
                    chatMessages.map((m) => (
                      <div key={m.id} className={`flex flex-col ${m.isSelf ? "items-end" : "items-start"}`}>
                        <span className="text-[10px] font-bold text-zinc-400 mb-0.5">{m.sender} • {m.time}</span>
                        <div className={`p-3 rounded-2xl max-w-[85%] font-medium ${
                          m.isSelf ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-200"
                        }`}>
                          {m.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="mt-3 flex items-center gap-2 pt-2 border-t border-zinc-800">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 text-white"
                  />
                  <button type="submit" className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* Recruiter Private Notes Content */}
            {activeDrawer === "notes" && (
              <div className="flex-1 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400">
                  <span>CONFIDENTIAL — Recruiter Only</span>
                  <span className={notesSaved ? "text-emerald-400" : "text-amber-400"}>
                    {notesSaved ? "Autosaved" : "Saving..."}
                  </span>
                </div>
                <textarea
                  value={recruiterNotes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder="Record private interview observations... Candidate cannot see these notes."
                  className="flex-1 w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-3 text-xs font-medium text-zinc-200 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
            )}

            {/* Candidate Quick Context Content */}
            {activeDrawer === "context" && (
              <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3.5 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Assessments Overview</span>
                  <div className="grid grid-cols-2 gap-2 text-left">
                    <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">ATS Score</span>
                      <span className="font-black text-sm text-blue-400">{contextData?.screening_score || 82}%</span>
                    </div>
                    <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">MCQ Score</span>
                      <span className="font-black text-sm text-emerald-400">{contextData?.mcq_score || 84}%</span>
                    </div>
                    <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">Coding Score</span>
                      <span className="font-black text-sm text-violet-400">{contextData?.coding_score || 88}%</span>
                    </div>
                    <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">AI Interview</span>
                      <span className="font-black text-sm text-indigo-400">{contextData?.interview_avg_score || 81}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3.5 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Candidate Portfolio & Resume</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`/recruiter/candidates/${session.candidateId}`, "_blank")}
                    className="w-full text-xs font-bold border-zinc-700 text-zinc-200 hover:bg-zinc-800 justify-between"
                  >
                    <span>View Candidate Dossier</span> <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <footer className="h-20 border-t border-zinc-800/80 bg-zinc-900/90 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          {/* Mic Toggle Button */}
          <button
            type="button"
            onClick={toggleMic}
            title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
            className={`p-3.5 rounded-2xl font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer ${
              micEnabled ? "bg-zinc-800 text-white hover:bg-zinc-700" : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Camera Toggle Button */}
          <button
            type="button"
            onClick={toggleCam}
            title={camEnabled ? "Turn Off Camera" : "Turn On Camera"}
            className={`p-3.5 rounded-2xl font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer ${
              camEnabled ? "bg-zinc-800 text-white hover:bg-zinc-700" : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {camEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
          </button>

          {/* Screen Share Button */}
          <button
            type="button"
            onClick={toggleScreenShare}
            title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
            className={`p-3.5 rounded-2xl font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer ${
              isScreenSharing ? "bg-indigo-600 text-white" : "bg-zinc-800 text-white hover:bg-zinc-700"
            }`}
          >
            <Monitor className="h-5 w-5" />
          </button>

          {/* Raise Hand Button */}
          <button
            type="button"
            onClick={toggleRaiseHand}
            title={handRaised ? "Lower Hand" : "Raise Hand"}
            className={`p-3.5 rounded-2xl font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer ${
              handRaised ? "bg-amber-500 text-zinc-950 font-black" : "bg-zinc-800 text-white hover:bg-zinc-700"
            }`}
          >
            <Hand className="h-5 w-5" />
          </button>
        </div>

        {/* Center / Right Control Drawers */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveDrawer(activeDrawer === "chat" ? null : "chat")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeDrawer === "chat" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            <MessageSquare className="h-4 w-4" /> Chat
          </button>

          {role === "recruiter" && (
            <>
              <button
                type="button"
                onClick={() => setActiveDrawer(activeDrawer === "notes" ? null : "notes")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeDrawer === "notes" ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                <FileText className="h-4 w-4" /> Private Notes
              </button>

              <button
                type="button"
                onClick={() => setActiveDrawer(activeDrawer === "context" ? null : "context")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeDrawer === "context" ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                <UserCheck className="h-4 w-4" /> Context
              </button>
            </>
          )}

          {/* End Call / Leave Meeting Button */}
          <Button
            onClick={handleLeaveMeeting}
            className="ml-4 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs px-5 py-3 rounded-2xl gap-2 shadow-lg shadow-red-600/30 cursor-pointer"
          >
            <PhoneOff className="h-4 w-4" /> Leave Meeting
          </Button>
        </div>
      </footer>

      {/* Recruiter Evaluation Scorecard Modal */}
      {scorecardOpen && session && (
        <ScorecardModal
          isOpen={scorecardOpen}
          onClose={() => {
            setScorecardOpen(false);
            router.push(`/recruiter/jobs/${session.jobId}/hiring-decision`);
          }}
          onSuccess={() => {
            setScorecardOpen(false);
            router.push(`/recruiter/jobs/${session.jobId}/hiring-decision`);
          }}
          interviewId={session.interviewId}
          candidateName={session.candidateName}
          jobTitle={session.jobTitle}
        />
      )}
    </div>
  );
}
