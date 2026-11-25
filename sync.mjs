#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TARGET = join(homedir(), ".gemini", "config", "plugins", "pstack");

function normalizeLang(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "en") return "en";
  if (v === "zh" || v === "zh-cn" || v === "zh_cn") return "zh";
  throw new Error(`Unsupported --lang value: ${value}. Use "en" or "zh".`);
}

function parseArgs(argv, defaultLang) {
  const opts = {
    pull: true,
    all: false,
    lang: normalizeLang(defaultLang || "en"),
    target: DEFAULT_TARGET,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-pull") {
      opts.pull = false;
    } else if (arg === "--all") {
      opts.all = true;
    } else if (arg === "--lang") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("--lang requires a value (en | zh)");
      }
      opts.lang = normalizeLang(next);
      i += 1;
    } else if (arg.startsWith("--lang=")) {
      opts.lang = normalizeLang(arg.slice("--lang=".length));
    } else if (arg === "--target") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("--target requires a directory path");
      }
      opts.target = resolve(next);
      i += 1;
    } else if (arg === "-h" || arg === "--help") {
      console.log(
        "Usage: node sync.mjs [--lang <en|zh>] [--no-pull] [--all] [--target <path>]\n" +
          "  --lang <en|zh>   Description language for plugin/skills/agents (default: en)\n" +
          "  --no-pull        Skip git pull; rebuild from .upstream/\n" +
          "  --all            Expose all non-excluded, non-principle skills at top-level skills/\n" +
          "  --target <path>  Override output directory (default: ~/.gemini/config/plugins/pstack)"
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return opts;
}

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function syncUpstream(upstreamDir, { repo, branch, subpath }, shouldPull) {
  if (!existsSync(join(upstreamDir, ".git"))) {
    console.log(`Cloning ${repo} (sparse: ${subpath}) -> ${upstreamDir}`);
    mkdirSync(upstreamDir, { recursive: true });
    execFileSync(
      "git",
      [
        "clone",
        "--filter=blob:none",
        "--no-checkout",
        "--depth",
        "1",
        "--branch",
        branch,
        repo,
        upstreamDir,
      ],
      { stdio: "inherit" }
    );
    runGit(["sparse-checkout", "init", "--cone"], upstreamDir);
    runGit(["sparse-checkout", "set", subpath], upstreamDir);
    runGit(["checkout", branch], upstreamDir);
  } else if (shouldPull) {
    console.log(`Pulling upstream (${branch}) in ${upstreamDir}`);
    execFileSync("git", ["-C", upstreamDir, "pull", "--ff-only", "origin", branch], {
      stdio: "inherit",
    });
  } else {
    console.log("Skipping git pull (--no-pull)");
  }

  const commit = runGit(["rev-parse", "--short", "HEAD"], upstreamDir);
  return { commit };
}

function unquoteYamlScalar(val) {
  if (val.startsWith('"') && val.endsWith('"')) {
    try {
      return JSON.parse(val);
    } catch {
      return val.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
  }
  if (val.startsWith("'") && val.endsWith("'")) {
    return val.slice(1, -1).replace(/''/g, "'");
  }
  return val;
}

/**
 * Parse YAML frontmatter block cleanly, handling folded/literal multiline scalars (`>-`, `>`, `|`, `|-`)
 * and quoted values, while preserving the markdown body.
 */
function splitFrontmatter(raw) {
  const normalized = raw.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { fields: {}, body: normalized };
  }

  const yamlLines = match[1].split("\n");
  const fields = {};
  let i = 0;

  while (i < yamlLines.length) {
    const line = yamlLines[i];
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!keyMatch) {
      i += 1;
      continue;
    }

    const key = keyMatch[1];
    let val = keyMatch[2].trim();

    if (/^[>|][+-]?$/.test(val)) {
      const style = val[0];
      const blockLines = [];
      i += 1;
      while (i < yamlLines.length && (/^\s+/.test(yamlLines[i]) || yamlLines[i].trim() === "")) {
        blockLines.push(yamlLines[i].replace(/^\s{2,}/, "").trimEnd());
        i += 1;
      }
      val =
        style === ">"
          ? blockLines.join(" ").replace(/\s+/g, " ").trim()
          : blockLines.join("\n").trim();
    } else if (val === "") {
      const contLines = [];
      i += 1;
      while (i < yamlLines.length && /^\s+/.test(yamlLines[i])) {
        contLines.push(yamlLines[i].trim());
        i += 1;
      }
      val = contLines.join(" ");
    } else {
      val = unquoteYamlScalar(val);
      i += 1;
    }

    fields[key] = val;
  }

  return { fields, body: match[2] };
}

function buildSkillMarkdown(rawContent, skillName, adapterRelPath, lang, zhDict, isPotetoMode = false) {
  const { fields, body } = splitFrontmatter(rawContent);
  const explicitOnly = fields["disable-model-invocation"] === "true";

  let description;
  if (lang === "zh" && zhDict?.skills?.[skillName]) {
    description = zhDict.skills[skillName].replace(/\s+/g, " ").trim();
    if (explicitOnly && !/仅在用户明确|仅当用户明确/.test(description)) {
      description = `${description} 仅在用户明确请求时启用。`;
    }
  } else {
    description = (fields.description || `pstack ${skillName} skill`).replace(/\s+/g, " ").trim();
    if (
      explicitOnly &&
      !/only when explicitly requested|only activate when explicitly/i.test(description)
    ) {
      description = `${description} Only activate when explicitly requested by the user.`;
    }
  }

  const notice =
    `In Antigravity, read [the Antigravity adapter](${adapterRelPath}) once per session before you follow this skill. ` +
    "It maps Cursor names, paths, and subagent fields to Antigravity.";

  let updatedBody = body;
  if (/^# .+/m.test(updatedBody)) {
    updatedBody = updatedBody.replace(/^(# .+)\n+/m, `$1\n\n${notice}\n\n`);
  } else {
    updatedBody = `${notice}\n\n${updatedBody}`;
  }

  if (isPotetoMode) {
    const pathHint =
      "Bundled top-level skills live at `../<name>/SKILL.md`, principle leaf files (`principle-*`) live at `../../references/principles/<name>/SKILL.md`, folded situational skills live at `../../references/extra-skills/<name>/SKILL.md`, and the Antigravity adapter lives at `../../docs/harness/antigravity.md`. Put this file's absolute path in every `poteto-agent` prompt.";
    updatedBody = updatedBody.replace(
      /^Bundled skills live at `[^`]+` from this file[^\n]*$/m,
      pathHint
    );
  }

  const cleanFrontmatter = [
    "---",
    `name: ${skillName}`,
    `description: ${JSON.stringify(description)}`,
    "---",
  ].join("\n");

  return `${cleanFrontmatter}\n\n${updatedBody.replace(/^\n+/, "")}`;
}

function buildPotetoAgent(rawContent, lang, zhDict) {
  const { fields, body } = splitFrontmatter(rawContent);
  const description =
    lang === "zh" && zhDict?.agents?.["poteto-agent"]
      ? zhDict.agents["poteto-agent"]
      : fields.description ||
        "Delegate subagent for code-writing and helper tasks spawned during a poteto-mode run. Reads poteto-mode SKILL.md and the Antigravity adapter before doing any work.";
  const frontmatter = [
    "---",
    "name: poteto-agent",
    `description: ${JSON.stringify(description)}`,
    "subagent: true",
    "mainAgent: false",
    "tools: [read_file, edit_file, write_file, run_command, manage_task, search_web]",
    "---",
  ].join("\n");
  return `${frontmatter}\n\n${body.replace(/^\n+/, "")}`;
}

function buildCommentSickoAgent(rawContent, lang, zhDict) {
  const { body } = splitFrontmatter(rawContent);
  const description =
    lang === "zh" && zhDict?.agents?.["comment-sicko"]
      ? zhDict.agents["comment-sicko"]
      : "Read-only comment reviewer spawned by /no-comments to flag unnecessary comments and workaround suppressions.";
  const frontmatter = [
    "---",
    "name: comment-sicko",
    `description: ${JSON.stringify(description)}`,
    "subagent: true",
    "mainAgent: false",
    "tools: [read_file, run_command]",
    "---",
  ].join("\n");
  return `${frontmatter}\n\n${body.replace(/^\n+/, "")}`;
}

function main() {
  const config = JSON.parse(readFileSync(join(REPO_ROOT, "config.json"), "utf8"));
  const opts = parseArgs(process.argv.slice(2), config.defaultLang);
  const zhDict =
    opts.lang === "zh"
      ? JSON.parse(readFileSync(join(REPO_ROOT, "i18n", "zh.json"), "utf8"))
      : null;

  const upstreamDir = join(REPO_ROOT, ".upstream");
  const { commit } = syncUpstream(upstreamDir, config.upstream, opts.pull);
  const pstackSrc = join(upstreamDir, config.upstream.subpath);
  const skillsSrc = join(pstackSrc, "skills");

  if (!existsSync(join(skillsSrc, "poteto-mode", "SKILL.md"))) {
    throw new Error(`Expected ${join(skillsSrc, "poteto-mode", "SKILL.md")} to exist.`);
  }

  const upstreamManifest = JSON.parse(readFileSync(join(pstackSrc, "plugin.json"), "utf8"));
  const upstreamVersion = upstreamManifest.version || "0.0.0";

  const target = opts.target;
  const stageDir = `${target}.staging-${process.pid}`;
  rmSync(stageDir, { recursive: true, force: true });
  mkdirSync(join(stageDir, "skills"), { recursive: true });
  mkdirSync(join(stageDir, "agents"), { recursive: true });
  mkdirSync(join(stageDir, "docs", "harness"), { recursive: true });
  mkdirSync(join(stageDir, "references", "principles"), { recursive: true });
  mkdirSync(join(stageDir, "references", "extra-skills"), { recursive: true });

  const topLevelSet = new Set(config.topLevelSkills || []);
  const excludedSet = new Set(config.excludedSkills || []);

  const entries = readdirSync(skillsSrc, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(skillsSrc, d.name, "SKILL.md")))
    .map((d) => d.name)
    .sort();

  const counts = {
    topLevel: 0,
    principles: 0,
    extra: 0,
    excluded: 0,
    agents: 0,
  };

  for (const name of entries) {
    if (excludedSet.has(name)) {
      counts.excluded += 1;
      continue;
    }

    const srcDir = join(skillsSrc, name);
    if (name.startsWith("principle-")) {
      const destDir = join(stageDir, "references", "principles", name);
      cpSync(srcDir, destDir, { recursive: true });
      counts.principles += 1;
      continue;
    }

    const isTopLevel = opts.all || topLevelSet.has(name);
    const destDir = isTopLevel
      ? join(stageDir, "skills", name)
      : join(stageDir, "references", "extra-skills", name);
    const adapterRelPath = isTopLevel
      ? "../../docs/harness/antigravity.md"
      : "../../../docs/harness/antigravity.md";

    cpSync(srcDir, destDir, { recursive: true });
    const skillMdPath = join(destDir, "SKILL.md");
    const rawSkill = readFileSync(skillMdPath, "utf8");
    const transformed = buildSkillMarkdown(
      rawSkill,
      name,
      adapterRelPath,
      opts.lang,
      zhDict,
      name === "poteto-mode"
    );
    writeFileSync(skillMdPath, transformed, "utf8");

    if (isTopLevel) {
      counts.topLevel += 1;
    } else {
      counts.extra += 1;
    }
  }

  // Agents
  const rawPotetoAgent = readFileSync(join(REPO_ROOT, "templates", "poteto-agent.md"), "utf8");
  writeFileSync(
    join(stageDir, "agents", "poteto-agent.md"),
    buildPotetoAgent(rawPotetoAgent, opts.lang, zhDict),
    "utf8"
  );
  counts.agents += 1;

  const commentSickoSrc = join(pstackSrc, "agents", "comment-sicko.md");
  if (existsSync(commentSickoSrc)) {
    const rawCommentSicko = readFileSync(commentSickoSrc, "utf8");
    writeFileSync(
      join(stageDir, "agents", "comment-sicko.md"),
      buildCommentSickoAgent(rawCommentSicko, opts.lang, zhDict),
      "utf8"
    );
    counts.agents += 1;
  }

  // Docs, LICENSE, README
  cpSync(
    join(REPO_ROOT, "docs", "harness", "antigravity.md"),
    join(stageDir, "docs", "harness", "antigravity.md")
  );
  const guideSrc = join(pstackSrc, "docs", "guide");
  if (existsSync(guideSrc)) {
    cpSync(guideSrc, join(stageDir, "docs", "guide"), { recursive: true });
  }
  for (const rootFile of ["LICENSE", "README.md"]) {
    const p = join(pstackSrc, rootFile);
    if (existsSync(p)) {
      cpSync(p, join(stageDir, rootFile));
    }
  }

  // Antigravity plugin.json (strictly supported top-level fields)
  const pluginDescription =
    opts.lang === "zh" && zhDict?.plugin?.description
      ? zhDict.plugin.description
      : "Rigorous software engineering workflows, 22 playbooks, and 24 engineering principles adapted from cursor/plugins pstack for Antigravity.";
  const suggestedPrompts =
    opts.lang === "zh" && Array.isArray(zhDict?.plugin?.suggestedPrompts)
      ? zhDict.plugin.suggestedPrompts
      : [
          "Use poteto-mode to reproduce, root-cause, and fix a bug with runtime verification",
          "Use architect to settle data shapes, types, and module boundaries before coding",
          "Use interrogate to run a rigorous adversarial code review on my current diff",
        ];

  const pluginManifest = {
    name: "pstack",
    displayName: "pstack (poteto-mode)",
    version: upstreamVersion,
    description: pluginDescription,
    author: {
      name: "Lauren Tan (adapted for Antigravity)",
    },
    homepage: "https://github.com/cursor/plugins/tree/main/pstack",
    repository: "https://github.com/cursor/plugins",
    suggestedPrompts,
  };
  writeFileSync(
    join(stageDir, "plugin.json"),
    `${JSON.stringify(pluginManifest, null, 2)}\n`,
    "utf8"
  );

  const syncMeta = {
    upstreamRepo: config.upstream.repo,
    upstreamBranch: config.upstream.branch,
    upstreamVersion,
    upstreamCommit: commit,
    syncedAt: new Date().toISOString(),
    mode: opts.all ? "all" : "curated",
    lang: opts.lang,
    counts,
  };
  writeFileSync(
    join(stageDir, ".sync-meta.json"),
    `${JSON.stringify(syncMeta, null, 2)}\n`,
    "utf8"
  );

  // Swap staged directory into target
  mkdirSync(dirname(target), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  cpSync(stageDir, target, { recursive: true });
  rmSync(stageDir, { recursive: true, force: true });

  console.log("\n=== pstack -> Antigravity sync complete ===");
  console.log(`Upstream : ${upstreamVersion} (${commit})`);
  console.log(`Mode     : ${syncMeta.mode}`);
  console.log(`Lang     : ${syncMeta.lang}`);
  console.log(`Target   : ${target}`);
  console.log(
    `Counts   : topLevelSkills=${counts.topLevel}, principles=${counts.principles}, extraSkills=${counts.extra}, excluded=${counts.excluded}, agents=${counts.agents}`
  );
}

main();
