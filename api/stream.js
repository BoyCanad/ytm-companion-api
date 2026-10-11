import { Innertube, UniversalCache } from 'youtubei.js';

let yt;
async function getInnertube() {
  if (!yt) {
    yt = await Innertube.create({
      cache: new UniversalCache(false),
      // Allow InnerTube to fetch real visitor session data from YouTube
      generate_session_locally: false,
      retrieve_player: true,
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

    // Use getBasicInfo with the 'IOS' or 'ANDROID' client.
    // Mobile clients bypass web restrictions and reliably return streaming_data.
    const info = await innertube.getBasicInfo(videoId, 'IOS');

    if (!info.streaming_data) {
      // Fallback to default web client if mobile format fails
      const fallbackInfo = await innertube.getBasicInfo(videoId);
      if (!fallbackInfo.streaming_data) {
        return res.status(404).json({ error: 'Playback stream unavailable for this video' });
      }
      const format = fallbackInfo.chooseFormat({ type: 'audio', quality: 'best' });
      const streamUrl = format.decipher(innertube.session.player);
      return res.status(200).json({ id: videoId, streamUrl });
    }

    // Select the best audio track (Opus 160kbps or AAC 128kbps)
    const format = info.chooseFormat({
      type: 'audio',
      quality: 'best',
    });

    if (!format) {
      return res.status(404).json({ error: 'No compatible audio format found' });
    }

    // Decipher signature & n-token
    const streamUrl = format.decipher(innertube.session.player);

    return res.status(200).json({
      id: videoId,
      streamUrl,
      bitrate: format.bitrate,
      mimeType: format.mime_type,
    });
  } catch (error) {
    console.error('Stream error:', error);
    return res.status(500).json({ error: error.message || 'Stream resolution failed' });
  }
}
