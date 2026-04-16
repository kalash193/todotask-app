import { getSession, requireMethod, sendJson, sessionUserPayload } from "../_lib/helpers.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) {
    return;
  }

  const session = await getSession(req);
  if (!session) {
    sendJson(res, 401, { message: "Unauthorized" });
    return;
  }

  sendJson(res, 200, { user: sessionUserPayload(session.user) });
}
