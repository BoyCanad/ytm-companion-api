import { Innertube, UniversalCache } from 'youtubei.js';

let yt;
async function getInnertube() {
  if (!yt) {
    yt = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
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
    const info = await innertube.music.getInfo(videoId);

    // Select highest quality audio stream (Opus itag 251 or AAC itag 140)
    const format = info.chooseFormat({
      type: 'audio',
      quality: 'best',
      format: 'any',
    });

    if (!format) {
      return res.status(404).json({ error: 'No compatible audio format found' });
    }

    const streamUrl = format.decipher(innertube.session.player);

    return res.status(200).json({
      id: videoId,
      streamUrl,
      bitrate: format.bitrate,
      mimeType: format.mime_type,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Stream resolution failed' });
  }
}
