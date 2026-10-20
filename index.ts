import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
async function robloxJson(url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { "Accept": "application/json", "User-Agent": "VioletAvatarStudio/0.1", ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (body && (body.errors?.[0]?.message || body.message)) || `Roblox API returned ${res.status}`;
    throw new Error(message);
  }
  return body;
}

// Lightweight per-isolate protection against accidental bursts. For a larger public launch,
// put the frontend behind a real rate limiter/WAF as well.
const rateBuckets = new Map<string, { start: number; count: number }>();
function isRateLimited(req: Request) {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const current = rateBuckets.get(ip);
  if (!current || now - current.start > 60_000) {
    rateBuckets.set(ip, { start: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > 45;
}

async function lookupAvatar(usernameRaw: string) {
  const username = usernameRaw.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new Error("Roblox username ต้องยาว 3–20 ตัว และใช้ตัวอักษร ตัวเลข หรือ _ เท่านั้น");

  const lookup = await robloxJson("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  const user = lookup?.data?.[0];
  if (!user?.id) throw new Error(`ไม่พบ Roblox username: ${username}`);

  const [avatarData, thumbData] = await Promise.all([
    robloxJson(`https://avatar.roblox.com/v4/avatar/users/${user.id}`).catch(() => null),
    robloxJson(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${user.id}&size=720x720&format=Png&isCircular=false`).catch(() => null),
  ]);
  const thumbnailUrl = thumbData?.data?.[0]?.imageUrl || null;
  const realRig = avatarData?.playerAvatarType === "R6" ? "R6" : "R15";
  let modelUrl: string | null = null;
  let modelStatus = "not-configured";
  const apiKey = Deno.env.get("ROBLOX_OPEN_CLOUD_API_KEY");
  if (apiKey) {
    try {
      let model = await robloxJson(`https://thumbnails.roblox.com/v1/users/avatar-3d?userId=${user.id}`, { headers: { "x-api-key": apiKey } });
      if (model?.state !== "Completed" || !model?.imageUrl) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        model = await robloxJson(`https://thumbnails.roblox.com/v1/users/avatar-3d?userId=${user.id}`, { headers: { "x-api-key": apiKey } });
      }
      if (model?.state === "Completed" && model?.imageUrl) {
        modelUrl = model.imageUrl;
        modelStatus = "ready";
      } else {
        modelStatus = model?.state || "pending";
      }
    } catch (_error) {
      modelStatus = "unavailable";
    }
  }

  const assets = Array.isArray(avatarData?.assets) ? avatarData.assets.map((asset: any) => ({
    id: asset.id ?? asset.assetId ?? null,
    name: asset.name ?? "Roblox asset",
    assetType: asset.assetType ?? null,
  })).filter((asset: any) => asset.id != null) : [];

  return {
    userId: user.id,
    username: user.name,
    displayName: user.displayName || user.name,
    avatarType: realRig,
    thumbnailUrl,
    modelUrl,
    modelStatus,
    assets,
    scales: avatarData?.scales || null,
  };
}

async function catalogSearch(keywordRaw: string) {
  const keyword = String(keywordRaw || "").trim().slice(0, 80);
  if (!keyword) throw new Error("พิมพ์คำค้นก่อนค้นหา Catalog");
  const searchUrl = new URL("https://catalog.roblox.com/v1/search/items/details");
  searchUrl.searchParams.set("Keyword", keyword);
  searchUrl.searchParams.set("Limit", "30");
  searchUrl.searchParams.set("SortType", "0");
  const result = await robloxJson(searchUrl.toString());
  const items = Array.isArray(result?.data) ? result.data : [];
  const ids = items.map((item: any) => item.id).filter((id: unknown) => typeof id === "number").slice(0, 30);
  let thumbs: Record<string, string> = {};
  if (ids.length) {
    try {
      const thumbResult = await robloxJson(`https://thumbnails.roblox.com/v1/assets?assetIds=${ids.join(",")}&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false`);
      for (const thumb of thumbResult?.data || []) thumbs[String(thumb.targetId)] = thumb.imageUrl;
    } catch (_error) { /* Catalog still works when thumbnail lookup is temporarily unavailable. */ }
  }
  return { items: items.map((item: any) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    itemType: item.itemType || item.assetType?.name || "Catalog item",
    assetType: item.assetType,
    price: item.price ?? null,
    lowestPrice: item.lowestPrice ?? null,
    creatorName: item.creatorName || item.creator?.name || "Roblox Creator",
    thumbnail: thumbs[String(item.id)] || null,
  })) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  if (isRateLimited(req)) return reply(429, { error: "คำขอเยอะเกินไป ลองใหม่ในอีกสักครู่" });
  try {
    const body = await req.json();
    if (body.action === "lookup") {
      if (typeof body.username !== "string") return reply(400, { error: "กรุณาระบุ username" });
      return reply(200, await lookupAvatar(body.username));
    }
    if (body.action === "catalog") {
      if (typeof body.keyword !== "string") return reply(400, { error: "กรุณาระบุคำค้น" });
      return reply(200, await catalogSearch(body.keyword));
    }
    return reply(400, { error: "Unknown action" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return reply(400, { error: message });
  }
});
