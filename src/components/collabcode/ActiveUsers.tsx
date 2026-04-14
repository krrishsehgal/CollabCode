import { motion } from "framer-motion";

interface User {
  name: string;
  color: string;
  status: "online" | "idle" | "offline";
  avatar: string;
}

const mockUsers: User[] = [
  { name: "You", color: "from-neon-purple to-neon-blue", status: "online", avatar: "Y" },
  { name: "Sarah K.", color: "from-neon-pink to-neon-purple", status: "online", avatar: "S" },
  { name: "Alex M.", color: "from-neon-blue to-accent", status: "online", avatar: "A" },
  { name: "Jordan L.", color: "from-neon-green to-neon-blue", status: "idle", avatar: "J" },
  { name: "Casey R.", color: "from-muted-foreground to-muted", status: "offline", avatar: "C" },
];

const statusColors: Record<string, string> = {
  online: "bg-neon-green",
  idle: "bg-yellow-400",
  offline: "bg-muted-foreground",
};

const ActiveUsers = () => {
  return (
    <div className="p-3 border-b border-glass-border">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Users ({mockUsers.filter((u) => u.status !== "offline").length})
      </span>
      <div className="mt-3 space-y-2">
        {mockUsers.map((user) => (
          <motion.div
            key={user.name}
            whileHover={{ x: 2 }}
            className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <div className="relative">
              <div
                className={`w-7 h-7 rounded-full bg-gradient-to-br ${user.color} flex items-center justify-center text-xs font-semibold text-primary-foreground ${
                  user.status === "online" ? "ring-2 ring-neon-green/30 animate-pulse-neon" : ""
                }`}
              >
                {user.avatar}
              </div>
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${statusColors[user.status]} ring-2 ring-background`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-foreground truncate">{user.name}</div>
              <div className="text-[10px] text-muted-foreground capitalize">{user.status}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ActiveUsers;
