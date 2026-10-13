
// Netlify Function - Kakao Mobility Directions API
// REST API Key được lưu an toàn trên Netlify.

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };

  const reply = (statusCode, body) => ({
    statusCode,
    headers,
    body: JSON.stringify(body)
  });

  if (event.httpMethod !== "POST") {
    return reply(405, { error: "POST required" });
  }

  const key = process.env.KAKAO_REST_API_KEY;

  if (!key) {
    return reply(503, {
      error: "Chưa cấu hình KAKAO_REST_API_KEY trên Netlify"
    });
  }

  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, { error: "Invalid JSON" });
  }

  const { origin, destination } = body;

  const valid = (p) =>
    p &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.x >= 124 &&
    p.x <= 132 &&
    p.y >= 33 &&
    p.y <= 39;

  if (!valid(origin) || !valid(destination)) {
    return reply(400, { error: "Tọa độ không hợp lệ" });
  }

  const params = new URLSearchParams({
    origin: `${origin.x},${origin.y}`,
    destination: `${destination.x},${destination.y}`,
    priority: "RECOMMEND"
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let res;

    try {
      res = await fetch(
        `https://apis-navi.kakaomobility.com/v1/directions?${params}`,
        {
          headers: {
            Authorization: `KakaoAK ${key}`
          },
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      return reply(502, {
        error:
          res.status === 401 || res.status === 403
            ? "API chỉ đường chưa được cấp quyền hoặc khóa không hợp lệ"
            : "Kakao Mobility API lỗi HTTP " + res.status
      });
    }

    const data = await res.json();
    const summary = data.routes?.[0]?.summary;

    if (
      !summary ||
      !Number.isFinite(summary.distance) ||
      !Number.isFinite(summary.duration)
    ) {
      return reply(502, {
        error: "Không có tuyến đường ô tô phù hợp"
      });
    }

    return reply(200, {
      distanceKm: summary.distance / 1000,
      durationMinutes: summary.duration / 60
    });
  } catch {
    return reply(502, {
      error: "Không kết nối được API chỉ đường"
    });
  }
};
