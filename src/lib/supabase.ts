import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

let authListeners: Function[] = [];

const validUsers = [
  { email: "krrishsehgal.ks@gmail.com", password: "Krrishsehga@l9", displayName: "Krish Sehgal" },
  { email: "mannanbajaj@gmail.com", password: "12345678", displayName: "Mannan Bajaj" },
];

const mockAuth = {
  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    const user = validUsers.find(u => u.email === email && u.password === password);
    if (user) {
      const session = {
        user: {
          id: `user-${email}`,
          email,
          user_metadata: { display_name: user.displayName },
        },
      };
      localStorage.setItem("mock_session", JSON.stringify(session));
      authListeners.forEach(listener => listener("SIGNED_IN", session));
      return { error: null };
    }
    return { error: { message: "Invalid credentials" } };
  },
  signUp: async ({ email, password, options }: any) => {
    const user = validUsers.find(u => u.email === email && u.password === password);
    if (user) {
      const session = {
        user: {
          id: `user-${email}`,
          email,
          user_metadata: { display_name: options?.data?.display_name || user.displayName },
        },
      };
      localStorage.setItem("mock_session", JSON.stringify(session));
      authListeners.forEach(listener => listener("SIGNED_UP", session));
      return { error: null };
    }
    return { error: { message: "Invalid credentials" } };
  },
  signOut: async () => {
    localStorage.removeItem("mock_session");
    authListeners.forEach(listener => listener("SIGNED_OUT", null));
    return { error: null };
  },
  getSession: async () => {
    const session = localStorage.getItem("mock_session");
    return { data: { session: session ? JSON.parse(session) : null } };
  },
  onAuthStateChange: (callback: Function) => {
    authListeners.push(callback);
    const session = localStorage.getItem("mock_session");
    callback(null, session ? JSON.parse(session) : null);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            authListeners = authListeners.filter(l => l !== callback);
          }
        }
      }
    };
  },
};

const baseSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export const supabase = {
  ...baseSupabase,
  auth: mockAuth as any,
};
