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
  // Enable CORS for mobile & web requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter "q"' });
  }

  try {
    const innertube = await getInnertube();
    const search = await innertube.music.search(query, { type: 'song' });

    const results = (search.songs?.contents || []).map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artists?.map((a) => a.name).join(', ') || 'Unknown Artist',
      album: song.album?.name || null,
      duration: song.duration?.seconds || 0,
      durationText: song.duration?.text || '',
      thumbnail: song.thumbnails?.[song.thumbnails.length - 1]?.url || null,
    }));

    return res.status(200).json({ results });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Search failed' });
  }
}
