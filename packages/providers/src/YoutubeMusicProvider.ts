import { MusicProvider } from "./MusicProvider";
import { NormalizedSearchResults, NormalizedTrack, NormalizedAlbum, NormalizedArtist } from "@headless/types";
import ytSearch from "yt-search";

// Scraper Concurrency Limiter: Prevent CPU exhaustion on 1-vCPU server
let activeScrapes = 0;
const MAX_CONCURRENT_SCRAPES = 3;
const scrapeWaitQueue: Array<() => void> = [];

async function acquireScrapeSlot(timeoutMs = 3000): Promise<boolean> {
  if (activeScrapes < MAX_CONCURRENT_SCRAPES) {
    activeScrapes++;
    return true;
  }
  if (scrapeWaitQueue.length >= 15) {
    // Queue too long, reject immediately to protect event loop
    return false;
  }

  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      const idx = scrapeWaitQueue.indexOf(notify);
      if (idx !== -1) scrapeWaitQueue.splice(idx, 1);
      resolve(false);
    }, timeoutMs);

    function notify() {
      clearTimeout(timer);
      resolve(true);
    }
    scrapeWaitQueue.push(notify);
  });
}

function releaseScrapeSlot(): void {
  activeScrapes--;
  if (scrapeWaitQueue.length > 0) {
    activeScrapes++;
    const next = scrapeWaitQueue.shift();
    if (next) next();
  }
}

export class YoutubeMusicProvider implements MusicProvider {
  name = "YouTube Provider";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.YOUTUBE_API_KEY || "";
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  async search(query: string, limit = 10): Promise<NormalizedSearchResults> {
    const hasSlot = await acquireScrapeSlot(3000);
    if (hasSlot) {
      try {
        // Primary: Use InnerTube Scraper with strict 4s timeout
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Scraper timeout")), 4000)
        );

        const searchResult: any = await Promise.race([ytSearch(query), timeoutPromise]);
        const videos = searchResult?.videos ? searchResult.videos.slice(0, limit) : [];

        if (videos.length > 0) {
          const tracks: NormalizedTrack[] = videos.map((video: any) => ({
            id: video.videoId || Math.random().toString(),
            vid: video.videoId,
            title: video.title || "Unknown Title",
            artist: video.author?.name || "Unknown Artist",
            cover: video.image || video.thumbnail || "",
            duration: video.seconds || 240,
            url: video.url || `https://www.youtube.com/watch?v=${video.videoId}`,
            provider: "youtube",
          }));

          const artists: NormalizedArtist[] = videos
            .map((video: any) => ({
              id: video.author?.name || "unknown_channel",
              name: video.author?.name || "Unknown Artist",
              avatar: video.image || "",
              provider: "youtube",
            }))
            .filter((val: any, idx: any, self: any) => self.findIndex((t: any) => t.id === val.id) === idx);

          // Auto-cache tracks to local database in background
          this.cacheTracksInBackground(tracks);

          return {
            tracks,
            albums: [],
            artists,
          };
        }
      } catch (scraperError) {
        // Silently proceed to fallback if scraper times out or fails
      } finally {
        releaseScrapeSlot();
      }
    }

    // Fallback: Official YouTube Data API if API Key is available
    if (this.apiKey) {
      try {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${limit}&q=${encodeURIComponent(
            query
          )}&type=video&key=${this.apiKey}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "YouTube API search failed");
        }

        const data = await response.json();
        const items = data.items || [];

        const tracks: NormalizedTrack[] = items.map((item: any) => {
          const videoId = item.id?.videoId;
          return {
            id: videoId || Math.random().toString(),
            vid: videoId,
            title: item.snippet?.title || "Unknown Title",
            artist: item.snippet?.channelTitle || "Unknown Channel",
            cover: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || "",
            duration: 240,
            url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
            provider: "youtube",
          };
        });

        this.cacheTracksInBackground(tracks);

        const artists: NormalizedArtist[] = items
          .map((item: any) => ({
            id: item.snippet?.channelId || "unknown_channel",
            name: item.snippet?.channelTitle || "Unknown Channel",
            avatar: item.snippet?.thumbnails?.high?.url || "",
            provider: "youtube",
          }))
          .filter((value: any, index: any, self: any) => self.findIndex((t: any) => t.id === value.id) === index);

        return {
          tracks,
          albums: [],
          artists,
        };
      } catch (error) {
        console.error("YouTube API search error:", error);
        throw error;
      }
    }

    return { tracks: [], albums: [], artists: [] };
  }

  async getTrack(id: string): Promise<NormalizedTrack | null> {
    try {
      const videoResult: any = await ytSearch({ videoId: id });
      if (videoResult) {
        const trackObj: NormalizedTrack = {
          id: videoResult.videoId,
          vid: videoResult.videoId,
          title: videoResult.title || "Unknown Title",
          artist: videoResult.author?.name || "Unknown Artist",
          cover: videoResult.image || videoResult.thumbnail || "",
          duration: videoResult.seconds || 240,
          url: videoResult.url || `https://www.youtube.com/watch?v=${videoResult.videoId}`,
          provider: "youtube",
        };
        this.cacheTracksInBackground([trackObj]);
        return trackObj;
      }
    } catch (scraperError) {
      console.warn("yt-search getTrack failed, trying official API if key exists:", scraperError);
    }

    if (!this.apiKey) return null;
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${this.apiKey}`
      );
      if (!response.ok) return null;
      const data = await response.json();
      const item = data.items?.[0];
      if (!item) return null;

      const trackObj = {
        id: item.id,
        vid: item.id,
        title: item.snippet?.title || "Unknown Title",
        artist: item.snippet?.channelTitle || "Unknown Channel",
        cover: item.snippet?.thumbnails?.high?.url || "",
        duration: 240,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        provider: "youtube",
      };

      this.cacheTracksInBackground([trackObj]);
      return trackObj;
    } catch {
      return null;
    }
  }

  async getAlbum(id: string): Promise<NormalizedAlbum | null> {
    return null;
  }

  async getArtist(id: string): Promise<NormalizedArtist | null> {
    if (!this.apiKey) return null;
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${id}&key=${this.apiKey}`
      );
      if (!response.ok) return null;
      const data = await response.json();
      const item = data.items?.[0];
      if (!item) return null;

      return {
        id: item.id,
        name: item.snippet?.title || "Unknown Artist",
        avatar: item.snippet?.thumbnails?.high?.url || "",
        provider: "youtube",
      };
    } catch {
      return null;
    }
  }

  private cacheTracksInBackground(tracks: NormalizedTrack[]) {
    if (tracks.length === 0) return;
    import("@headless/database").then(({ Track }) => {
      const ops = tracks
        .filter(t => Boolean(t.vid))
        .map(t => ({
          updateOne: {
            filter: { vid: t.vid },
            update: {
              $set: {
                vid: t.vid,
                title: t.title,
                artist: t.artist,
                cover: t.cover,
                duration: t.duration,
                provider: "youtube",
              },
            },
            upsert: true,
          },
        }));

      if (ops.length > 0) {
        Track.bulkWrite(ops, { ordered: false }).catch(() => {});
      }
    }).catch(() => {});
  }
}

