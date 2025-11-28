
export type View = 'chat' | 'imageGen' | 'ide' | 'imageEdit' | 'liveTalk';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string;
  sources?: { uri: string; title: string }[];
}
