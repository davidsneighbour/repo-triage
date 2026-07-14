import { execFileSync } from "node:child_process";
import { Router } from "express";
import { findRepo } from "../lib/sync.js";

const router = Router();

// All three endpoints validate the repo against the in-memory cache so
// user-supplied :id never reaches a shell. full_name comes from our own cache,
// never from request params or body — no shell injection is possible.

router.post("/repos/:id/gh/open", (req, res) => {
  const repo = findRepo(Number(req.params.id));
  if (!repo) return res.status(404).json({ error: "repo not found" });
  try {
    execFileSync("gh", ["repo", "view", repo.full_name, "--web"], {
      stdio: "ignore",
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

router.get("/repos/:id/gh/prs", (req, res) => {
  const repo = findRepo(Number(req.params.id));
  if (!repo) return res.status(404).json({ error: "repo not found" });
  try {
    const out = execFileSync(
      "gh",
      [
        "pr",
        "list",
        "--repo",
        repo.full_name,
        "--state",
        "open",
        "--json",
        "number,title,url,author,createdAt",
      ],
      { encoding: "utf8" },
    );
    res.json({ prs: JSON.parse(out) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

router.post("/repos/:id/gh/issue", (req, res) => {
  const repo = findRepo(Number(req.params.id));
  if (!repo) return res.status(404).json({ error: "repo not found" });
  const title =
    typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title) return res.status(400).json({ error: "title must not be empty" });
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  try {
    const out = execFileSync(
      "gh",
      [
        "issue",
        "create",
        "--repo",
        repo.full_name,
        "--title",
        title,
        "--body",
        body || " ",
      ],
      { encoding: "utf8" },
    ).trim();
    const lines = out.split("\n");
    const url = lines[lines.length - 1].trim();
    const match = url.match(/\/issues\/(\d+)$/);
    res.json({ ok: true, url, number: match ? Number(match[1]) : null });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

export default router;
