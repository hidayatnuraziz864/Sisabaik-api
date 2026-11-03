
async function api(path, method = "GET", body, token) {
  const url = new URL(path, base);
  const headers = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    const cause = error.cause;
    const detail = cause
      ? `${cause.code ?? cause.name ?? "ERROR"}: ${cause.message}`
      : error.message;

    throw new Error(
      `Gagal menghubungi API ${url.href}. ` +
      `Pastikan server aktif dan port benar. Detail: ${detail}`,
      { cause: error },
    );
  }

  let responseBody = null;

  if (response.status !== 204) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      try {
        responseBody = await response.json();
      } catch {
        throw new Error(
          `API ${url.href} mengirim JSON yang tidak valid ` +
          `(HTTP ${response.status}).`,
        );
      }
    } else {
      const text = await response.text();

      responseBody = {
        error: {
          code: "NON_JSON_RESPONSE",
          message: text.slice(0, 500),
        },
      };
    }
  }

  return {
    status: response.status,
    headers: response.headers,
    body: responseBody,
  };
}
