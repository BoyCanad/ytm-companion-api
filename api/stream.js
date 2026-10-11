import { Innertube, UniversalCache } from 'youtubei.js';

let yt;
async function getInnertube() {
  if (!yt) {
    yt = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: false,
    });
  }
  return yt;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const videoId = req.query.id;
  if (!videoId) {
    return res.status(400).json({ error: 'Missing parameter "id"' });
  }

  try {
    const innertube = await getInnertube();

    // 1. Query TV_EMBEDDED first (bypasses datacenter BotGuard checks on Vercel)
    let info = await innertube.getBasicInfo(videoId, 'TV_EMBEDDED');

    // 2. Fall back to ANDROID if TV_EMBEDDED format is empty
    if (!info.streaming_data) {
      info = await innertube.getBasicInfo(videoId, 'ANDROID');
    }

    // 3. If still blocked, return YouTube's exact playability reason for debugging
    if (!info.streaming_data) {
      const reason = info.playability_status?.reason || 'Restricted or unavailable in datacenter region';
      const status = info.playability_status?.status || 'UNPLAYABLE';
      return res.status(403).json({
        error: `Playback stream unavailable: ${reason}`,
        status,
      });
    }

    // Pick highest quality audio stream (Opus itag 251 or AAC itag 140)
    const format = info.chooseFormat({
      type: 'audio',
      quality: 'best',
    });

    if (!format) {
      return res.status(404).json({ error: 'No audio format found matching query' });
    }

    // Decipher stream URL (or return direct URL if unencrypted)
    const streamUrl = format.decipher(innertube.session.player);

    return res.status(200).json({
      id: videoId,
      streamUrl,
      bitrate: format.bitrate,
      mimeType: format.mime_type,
      audioQuality: format.audio_quality,
    });
  } catch (error) {
    console.error('Stream error:', error);
    return res.status(500).json({ error: error.message || 'Stream resolution failed' });
  }
}
