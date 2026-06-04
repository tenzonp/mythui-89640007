import { createContext, useContext, useState, type ReactNode } from "react";

export type ThreadFile = {
  name: string;
  mime?: string;
  size?: number;
  url?: string;
  time?: string;
  isImage?: boolean;
  isPdf?: boolean;
};

export type ThreadTask = {
  id: string;
  label: string;
  detail?: string;
  agentId?: string;
  status: "running" | "done" | "queued" | "blocked" | "error";
  time?: string;
};

export type ThreadActivity = {
  threadTitle: string;
  files: ThreadFile[];
  tasks: ThreadTask[];
  /** agent ids currently running */
  working: Set<string>;
  /** agent ids that have finished work in this thread */
  active: Set<string>;
  /** progress 0-100 for the current task */
  progress: number;
  running: boolean;
};

const empty: ThreadActivity = {
  threadTitle: "",
  files: [],
  tasks: [],
  working: new Set(),
  active: new Set(),
  progress: 0,
  running: false,
};

type Ctx = {
  activity: ThreadActivity;
  setActivity: (a: ThreadActivity) => void;
};

const ChatCtx = createContext<Ctx>({ activity: empty, setActivity: () => {} });

export const ChatActivityProvider = ({ children }: { children: ReactNode }) => {
  const [activity, setActivity] = useState<ThreadActivity>(empty);
  return <ChatCtx.Provider value={{ activity, setActivity }}>{children}</ChatCtx.Provider>;
};

export const useChatActivity = () => useContext(ChatCtx);
