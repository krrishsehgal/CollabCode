import { useState } from "react";
import { motion } from "framer-motion";
import { Code2, Hash, ArrowRight, Plus, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const RoomPage = () => {
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    setLoading(true);
    // Simulate a brief delay then navigate
    setTimeout(() => {
      navigate(`/editor/${roomCode.trim()}`);
    }, 500);
  };

  const handleCreateRoom = () => {
    const code = Math.random().toString(36).substring(2, 6) + "-" + Math.random().toString(36).substring(2, 6);
    navigate(`/editor/${code}`);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 right-1/3 w-96 h-96 bg-neon-purple/8 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/3 left-1/3 w-80 h-80 bg-neon-blue/8 rounded-full blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md mx-4 relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.4 }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-neon-purple to-neon-blue flex items-center justify-center neon-glow-purple mx-auto mb-4"
          >
            <Code2 className="w-7 h-7 text-primary-foreground" />
          </motion.div>
          <h1 className="text-3xl font-bold gradient-text">Join a Room</h1>
          <p className="text-muted-foreground text-sm mt-2">Enter a room code or create a new session</p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 space-y-6">
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Room Code</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="e.g. ab7x-k92m"
                  className="w-full h-12 bg-secondary rounded-xl pl-10 pr-4 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition-all tracking-wider"
                />
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading || !roomCode.trim()}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-neon-purple to-neon-blue text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 neon-glow-purple disabled:opacity-50 transition-all"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Join Room
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-glass-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-glass-border" />
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleCreateRoom}
            className="w-full h-11 rounded-xl border border-glass-border text-foreground font-medium text-sm flex items-center justify-center gap-2 hover:bg-secondary transition-all"
          >
            <Plus className="w-4 h-4 text-neon-green" />
            Create New Room
          </motion.button>
        </div>

        <div className="text-center mt-6">
          <button
            onClick={signOut}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default RoomPage;
