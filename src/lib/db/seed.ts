import { db, uid, type Media, type Cosplayer, type Character, type Set, type TagDef } from "@/lib/db/dexie";

// Demo seed uses picsum.photos seeded URLs (deterministic + reliable + CORS-enabled)
const IMG = (w: number, h: number, seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

const VID = (id: string) => `https://storage.googleapis.com/gtv-videos-bucket/sample/${id}`;
// Note: real video poster gen requires CORS; sample videos from Google bucket support CORS.

const TAGS = [
  { name: "studio", color: "#9b59b6" },
  { name: "outdoor", color: "#27ae60" },
  { name: "armor", color: "#c0392b" },
  { name: "casual", color: "#16a085" },
  { name: "event", color: "#f39c12" },
  { name: "portrait", color: "#2980b9" },
  { name: "full-body", color: "#8e44ad" },
  { name: "swimsuit", color: "#1abc9c" },
  { name: "convention", color: "#d35400" },
  { name: "fantasy", color: "#34495e" },
];

const COSPLAYERS = [
  {
    name: "Hoshino Yuki",
    alias: "星野雪",
    notes: "Professional cosplayer based in Tokyo. Specializes in RPG and anime characters.",
    socialLinks: ["https://twitter.com/example", "https://instagram.com/example"],
  },
  {
    name: "Alice Smith",
    alias: "Aly",
    notes: "Cosplay artist and photographer. Often shoots at outdoor locations.",
  },
  {
    name: "Yuki Tanaka",
    alias: "Yuutan",
    notes: "Cosplayer known for armor builds and prop fabrication.",
  },
  {
    name: "Mira Kuro",
    alias: "Mira",
    notes: "European cosplayer, convention regular.",
  },
];

const CHARACTERS_BY_COSPLAYER: Record<string, { name: string; franchise: string; note?: string }[]> = {
  "Hoshino Yuki": [
    { name: "2B", franchise: "NieR:Automata", note: "YoRHa No.2 Type B" },
    { name: "Rei Ayanami", franchise: "Evangelion" },
    { name: "Asuka Langley", franchise: "Evangelion" },
    { name: "Makima", franchise: "Chainsaw Man" },
    { name: "Rem", franchise: "Re:Zero" },
    { name: "Ram", franchise: "Re:Zero" },
    { name: "Emilia", franchise: "Re:Zero" },
    { name: "Raphtalia", franchise: "Shield Hero" },
    { name: "Saber", franchise: "Fate/stay night" },
    { name: "Miku Hatsune", franchise: "Vocaloid" },
    { name: "Aerith", franchise: "Final Fantasy VII" },
    { name: "Tifa", franchise: "Final Fantasy VII" },
  ],
  "Alice Smith": [
    { name: "Wonder Woman", franchise: "DC Comics" },
    { name: "Black Widow", franchise: "Marvel" },
    { name: "Harley Quinn", franchise: "DC Comics" },
    { name: "Lara Croft", franchise: "Tomb Raider" },
    { name: "Leia Organa", franchise: "Star Wars" },
  ],
  "Yuki Tanaka": [
    { name: "Guts (Berserk Armor)", franchise: "Berserk" },
    { name: "Saber Alter", franchise: "Fate/stay night" },
    { name: "Artoria Pendragon", franchise: "Fate/stay night" },
    { name: "Iron Man", franchise: "Marvel" },
    { name: "Gundam Barbatos", franchise: "Mobile Suit Gundam" },
    { name: "EVA Unit-01", franchise: "Evangelion" },
    { name: "Dante", franchise: "Devil May Cry" },
    { name: "Kratos", franchise: "God of War" },
  ],
  "Mira Kuro": [
    { name: "Ciri", franchise: "The Witcher" },
    { name: "Yennefer", franchise: "The Witcher" },
    { name: "Triss", franchise: "The Witcher" },
    { name: "Jinx", franchise: "League of Legends" },
    { name: "Vi", franchise: "League of Legends" },
    { name: "Caitlyn", franchise: "League of Legends" },
    { name: "Aloy", franchise: "Horizon Zero Dawn" },
    { name: "Lara Croft", franchise: "Tomb Raider" },
  ],
};

const SETS_BY_CHARACTER: { cosplayer: string; character: string; sets: { name: string; date: string; location?: string; event?: string; photographer?: string; tags?: string[] }[] }[] = [
  { cosplayer: "Hoshino Yuki", character: "2B", sets: [
    { name: "Studio Shoot 01", date: "2025-03-12", location: "Studio Asahi, Tokyo", photographer: "K. Watanabe", tags: ["studio", "portrait"] },
    { name: "Anime Expo 2026", date: "2026-07-04", location: "Los Angeles Convention Center", event: "Anime Expo 2026", photographer: "M. Lee", tags: ["event", "convention", "full-body"] },
    { name: "Outdoor Rooftop", date: "2026-04-22", location: "Rooftop Shibuya", photographer: "Self", tags: ["outdoor", "full-body"] },
  ]},
  { cosplayer: "Hoshino Yuki", character: "Rei Ayanami", sets: [
    { name: "Studio 02", date: "2025-11-10", location: "Studio Asahi, Tokyo", photographer: "K. Watanabe", tags: ["studio", "portrait"] },
    { name: "Plugsuit Set", date: "2026-01-15", location: "Home Studio", photographer: "Self", tags: ["studio"] },
  ]},
  { cosplayer: "Hoshino Yuki", character: "Makima", sets: [
    { name: "Con Set", date: "2026-05-08", location: "Makuhari Messe", event: "Comiket 102", tags: ["event", "convention"] },
  ]},
  { cosplayer: "Alice Smith", character: "Wonder Woman", sets: [
    { name: "Comic Con 2025", date: "2025-10-25", location: "NYC Javits Center", event: "NYCC 2025", tags: ["event", "convention"] },
    { name: "Studio Editorial", date: "2026-02-02", location: "Brooklyn Studio", photographer: "Self", tags: ["studio", "portrait"] },
  ]},
  { cosplayer: "Alice Smith", character: "Harley Quinn", sets: [
    { name: "Coney Island", date: "2026-06-15", location: "Coney Island, NYC", photographer: "J. Rosario", tags: ["outdoor", "full-body"] },
  ]},
  { cosplayer: "Yuki Tanaka", character: "Saber Alter", sets: [
    { name: "Armored Build", date: "2026-01-08", location: "Workshop", photographer: "Self", tags: ["armor", "studio"] },
    { name: "Outdoor Castle", date: "2026-03-30", location: "Himeji Castle", photographer: "T. Sato", tags: ["armor", "outdoor", "fantasy"] },
  ]},
  { cosplayer: "Yuki Tanaka", character: "Guts (Berserk Armor)", sets: [
    { name: "Armor Reveal", date: "2026-07-01", location: "Workshop", tags: ["armor"] },
  ]},
  { cosplayer: "Mira Kuro", character: "Ciri", sets: [
    { name: "Forest Hunt", date: "2026-05-19", location: "Black Forest, Germany", photographer: "Self", tags: ["outdoor", "fantasy"] },
    { name: "Convention Hall", date: "2026-04-04", location: "Messe Frankfurt", event: "Frankfurt Con 2026", tags: ["event", "convention"] },
  ]},
  { cosplayer: "Mira Kuro", character: "Jinx", sets: [
    { name: "Studio Mayhem", date: "2026-06-08", location: "Studio Berlin", photographer: "Self", tags: ["studio", "casual"] },
  ]},
];

export async function seedDatabaseIfEmpty() {
  const existing = await db.cosplayers.count();
  if (existing > 0) return;

  // Tags
  const tagById = new Map<string, string>();
  const tagRows: TagDef[] = [];
  for (const t of TAGS) {
    const id = uid("tag");
    tagById.set(t.name, id);
    tagRows.push({ id, name: t.name, color: t.color, createdAt: Date.now() });
  }
  await db.tags.bulkPut(tagRows);

  // Cosplayers
  const cosplayerById = new Map<string, string>();
  for (const c of COSPLAYERS) {
    const id = uid("cosp");
    cosplayerById.set(c.name, id);
    const cos: Cosplayer = {
      id,
      name: c.name,
      alias: c.alias,
      notes: c.notes,
      socialLinks: c.socialLinks ?? [],
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.cosplayers.put(cos);
  }

  // Characters
  const characterIdByKey = new Map<string, string>();
  for (const [cospName, chars] of Object.entries(CHARACTERS_BY_COSPLAYER)) {
    const cosplayerId = cosplayerById.get(cospName)!;
    for (const ch of chars) {
      const id = uid("char");
      characterIdByKey.set(`${cospName}|${ch.name}`, id);
      const character: Character = {
        id,
        cosplayerId,
        name: ch.name,
        franchise: ch.franchise,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.characters.put(character);
    }
  }

  // Sets + media
  const mediaBatch: Media[] = [];
  let coverMediaCounter = 0;

  for (const setSpec of SETS_BY_CHARACTER) {
    const cosplayerId = cosplayerById.get(setSpec.cosplayer)!;
    const characterId = characterIdByKey.get(`${setSpec.cosplayer}|${setSpec.character}`)!;
    for (const s of setSpec.sets) {
      const setId = uid("set");
      // 20-80 media per set, mix of image and 1-2 videos
      const mediaCount = 24 + Math.floor(Math.random() * 40);
      const videoCount = Math.random() < 0.6 ? 1 + Math.floor(Math.random() * 2) : 0;
      const videoFiles = [
        "ForBiggerBlazes.mp4", "ForBiggerEscapes.mp4", "ForBiggerFun.mp4",
        "ForBiggerJoyrides.mp4", "ForBiggerMeltdowns.mp4", "Sintel2010-480.mp4",
        "ElephantsDream-480.mp4",
      ];
      const setTagIds = (s.tags ?? []).map((name) => tagById.get(name)).filter(Boolean) as string[];

      for (let i = 0; i < mediaCount; i++) {
        const isVideo = i < videoCount;
        const mId = uid("med");
        // Use cosplayer+character+set as seed for visual variety
        const seedStr = `${setSpec.cosplayer}-${setSpec.character}-${s.name}-${i}`;
        // Picsum supports many sizes; use 800/1200 for nice thumbnails
        const w = 800 + ((i * 37) % 800); // 800-1599
        const h = 600 + ((i * 53) % 800); // 600-1399
        const url = isVideo
          ? VID(videoFiles[i % videoFiles.length])
          : IMG(w, h, seedStr);

        const tags: string[] = [];
        // Add 1-2 random tags
        const tagPool = ["portrait", "full-body", "casual", "armor", "outdoor", "studio"];
        const numTags = 1 + Math.floor(Math.random() * 2);
        for (let j = 0; j < numTags; j++) {
          const name = tagPool[Math.floor(Math.random() * tagPool.length)];
          const tid = tagById.get(name);
          if (tid && !tags.includes(tid)) tags.push(tid);
        }
        // Add set tags
        for (const t of setTagIds) if (!tags.includes(t)) tags.push(t);

        const media: Media = {
          id: mId,
          cosplayerId,
          characterId,
          setId,
          filename: isVideo ? `${seedStr}.mp4` : `${seedStr}.jpg`,
          sourceUrl: url,
          fileSize: isVideo ? 4_000_000 + (i * 100_000) : 400_000 + (i * 1500),
          mimeType: isVideo ? "video/mp4" : "image/jpeg",
          kind: isVideo ? "video" : "image",
          rating: Math.random() < 0.15 ? 5 : Math.random() < 0.4 ? Math.ceil(Math.random() * 5) : 0,
          favorite: Math.random() < 0.18,
          tags,
          importedAt: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 90),
          fileCreated: Date.parse(s.date) / 1000 + i * 60,
          fileModified: Date.parse(s.date) / 1000 + i * 60,
        };
        mediaBatch.push(media);
        // First media becomes the set cover (and propagates to character/cosplayer covers if missing)
        if (i === 0) {
          await db.sets.put({
            id: setId,
            characterId,
            cosplayerId,
            name: s.name,
            date: s.date,
            location: s.location,
            event: s.event,
            photographer: s.photographer,
            tags: setTagIds,
            coverMediaId: mId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          const existingChar = await db.characters.get(characterId);
          if (existingChar && !existingChar.coverMediaId) {
            await db.characters.update(characterId, { coverMediaId: mId });
          }
          const existingCos = await db.cosplayers.get(cosplayerId);
          if (existingCos && !existingCos.coverMediaId) {
            await db.cosplayers.update(cosplayerId, { coverMediaId: mId });
          }
          coverMediaCounter++;
        }
      }
    }
  }

  // Add 30 orphan media (no hierarchy -> Inbox)
  for (let i = 0; i < 30; i++) {
    const mId = uid("med");
    const seedStr = `inbox-unorganized-${i}`;
    const w = 700 + ((i * 41) % 600);
    const h = 500 + ((i * 47) % 600);
    const isVideo = i % 11 === 0;
    const url = isVideo ? VID("ForBiggerFun.mp4") : IMG(w, h, seedStr);
    const tagPool = ["portrait", "full-body", "casual"];
    const tags: string[] = [];
    const tid = tagById.get(tagPool[i % tagPool.length]);
    if (tid) tags.push(tid);
    mediaBatch.push({
      id: mId,
      filename: isVideo ? `${seedStr}.mp4` : `${seedStr}.jpg`,
      sourceUrl: url,
      fileSize: 320_000 + i * 1700,
      mimeType: isVideo ? "video/mp4" : "image/jpeg",
      kind: isVideo ? "video" : "image",
      rating: 0,
      favorite: false,
      tags,
      importedAt: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 14),
    });
  }

  await db.media.bulkPut(mediaBatch);
  console.log(`[seed] inserted ${mediaBatch.length} media, ${coverMediaCounter} sets`);
}
