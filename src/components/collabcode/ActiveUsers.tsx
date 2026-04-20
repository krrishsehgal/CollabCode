import { motion } from "framer-motion";

const ActiveUsers = ({
  users,
  currentUserId,
}: {
  users: Array<{ userId: string; displayName: string }>;
  currentUserId: string;
}) => {
  return (
    <div className="p-3 border-b border-glass-border">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Users ({users.length})
      </span>
      <div className="mt-3 space-y-2">
        {users.length === 0 ? (
          <div className="text-xs text-muted-foreground px-2 py-1">
            No users online
          </div>
        ) : (
          users.map(({ userId, displayName }) => {
            const isCurrentUser = userId === currentUserId;

            const safeName = displayName || userId.slice(0, 6) || "User";
            const resolvedName = isCurrentUser ? "You" : safeName;
            const avatar = resolvedName.charAt(0).toUpperCase();

            return (
              <motion.div
                key={userId}
                whileHover={{ x: 2 }}
                className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg transition-colors ${
                  isCurrentUser ? "bg-primary/15" : "hover:bg-secondary"
                }`}
              >
                <div className="relative">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-primary-foreground ${
                      isCurrentUser
                        ? "bg-neon-purple ring-2 ring-neon-purple/30"
                        : "bg-neon-blue"
                    }`}
                  >
                    {avatar}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-neon-green ring-2 ring-background" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">
                    {resolvedName}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    online
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActiveUsers;
