/// <reference types="vite/client" />

/** YouTube IFrame Player API types — injected via script tag in index.html */
declare namespace YT {
  class Player {
    constructor(element: HTMLElement | string, options: PlayerOptions);
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    destroy(): void;
    playVideo(): void;
    pauseVideo(): void;
    getCurrentTime(): number;
  }

  interface PlayerOptions {
    videoId?: string;
    playerVars?: {
      modestbranding?: number;
      rel?: number;
      autoplay?: number;
    };
    events?: Record<string, (event: unknown) => void>;
  }
}

interface Window {
  YT: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
