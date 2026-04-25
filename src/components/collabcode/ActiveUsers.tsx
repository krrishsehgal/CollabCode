import { motion } from "framer-motion";
import { useParams } from "react-router-dom";
import { useActiveUsers } from "@/hooks/useActiveUsers";

const statusColors: Record<string, string> = {
  online: "bg-neon-green",
  idle: "bg-yellow-400",
  offline: "bg-muted-foreground",
};

const getInitials = (displayName: string) => {
  return displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const getColorForUser = (index: number) => {
  const colors = ["bg-neon-purple", "bg-neon-pink", "bg-neon-blue", "bg-neon-green", "bg-neon-yellow"];
  return colors[index % colors.length];
};

const ActiveUsers = () => {
  const { roomId } = useParams();
  const { users } = useActiveUsers(roomId || "unknown");

  return (
    <div className="p-3 border-b border-glass-border">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Users ({users.length})
      </span>
      <div className="mt-3 space-y-2">
        {users.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-2">No users yet</div>
        ) : (
          users.map((user, idx) => (
            <motion.div
              key={user.userId}
              whileHover={{ x: 2 }}
              className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <div className="relative">
                <div
                  className={`w-7 h-7 rounded-full ${getColorForUser(idx)} flex items-center justify-center text-xs font-semibold text-primary-foreground ring-2 ring-neon-green/30 animate-pulse-neon`}
                >
                  {getInitials(user.displayName)}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${statusColors.online} ring-2 ring-background`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-foreground truncate">{user.displayName}</div>
                <div className="text-[10px] text-muted-foreground capitalize">online</div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActiveUsers;
