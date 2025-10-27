from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
CONTENT_ROOT = ROOT / "content"


def load_yaml_like_front_matter(lines: List[str]) -> Dict[str, object]:
    data: Dict[str, object] = {}
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if not value:
            data[key] = ""
            continue
        lower = value.lower()
        if lower in {"true", "false"}:
            data[key] = lower == "true"
            continue
        if re.fullmatch(r"-?\d+", value):
            data[key] = int(value)
            continue
        if value.startswith("[") and value.endswith("]"):
            try:
                py_value = value.replace("true", "True").replace("false", "False")
                data[key] = ast.literal_eval(py_value)
            except Exception:
                data[key] = value
            continue
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            data[key] = value[1:-1]
            continue
        data[key] = value
    return data


ITEM_PATTERN = re.compile(
    r"{{<\s*item\s+\"([^\"]*)\"(?:\s+\"([^\"]*)\")?(?:\s+\"([^\"]*)\")?\s*>}}"
)
TIMER_PATTERN = re.compile(r'{{<\s*timerset\s+(\d+)\s+"([^"]*)"\s*>}}')


def extract_ingredients(lines: List[str], default_group: str | None) -> List[Dict[str, object]]:
    groups: List[Dict[str, object]] = []
    current_group: Dict[str, object] = {"group": "", "items": []}

    def start_new_group(name: str = "") -> None:
        nonlocal current_group
        if current_group["items"]:
            groups.append(current_group)
        current_group = {"group": name, "items": []}

    for line in lines:
        if '<div class="ingredients-container">' in line:
            if current_group["items"]:
                groups.append(current_group)
                current_group = {"group": "", "items": []}
            continue
        match = ITEM_PATTERN.search(line)
        if not match:
            continue
        name, amount, note = match.groups()
        if 'class="title"' in line:
            start_new_group(name.strip())
            continue
        item = {
            "name": name.strip(),
            "amount": (amount or "").strip(),
            "note": (note or "").strip(),
        }
        current_group["items"].append(item)

    if current_group["items"]:
        groups.append(current_group)
    if default_group:
        unnamed = [g for g in groups if not (g.get("group") or "").strip()]
        if unnamed:
            if len(unnamed) == 1:
                unnamed[0]["group"] = default_group.strip()
            else:
                for idx, group in enumerate(unnamed, start=1):
                    group["group"] = f"{default_group.strip()} {idx}"
    return groups


def clean_html_text(text: str) -> str:
    cleaned = re.sub(r"<[^>]+>", "", text)
    cleaned = cleaned.replace("&nbsp;", " ")
    return " ".join(cleaned.split())


def extract_steps(heading: str, block_text: str) -> List[Dict[str, str]]:
    steps: List[Dict[str, str]] = []
    lists = re.findall(r'<ul class="ministep">\s*(.*?)</ul>', block_text, re.S)
    for ul in lists:
        items = re.findall(r"<li[^>]*>(.*?)</li>", ul, re.S)
        for idx, raw in enumerate(items, start=1):
            timer = None
            timer_match = TIMER_PATTERN.search(raw)
            if timer_match:
                timer = timer_match.group(2).strip()
                raw = TIMER_PATTERN.sub("", raw)
            detail = clean_html_text(raw)
            if not detail:
                continue
            title = heading.strip() if heading else f"ステップ {len(steps) + 1}"
            if heading and len(items) > 1:
                title = f"{heading.strip()} {idx}"
            steps.append(
                {
                    "title": title,
                    "detail": detail,
                    "timer": timer,
                }
            )
    return steps


def extract_notes(block_text: str) -> List[str]:
    notes: List[str] = []
    for line in block_text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("{{"):
            continue
        if stripped.startswith("- "):
            notes.append(stripped[2:].strip())
        elif stripped.startswith("・"):
            notes.append(stripped[1:].strip())
        elif "<" not in stripped:
            notes.append(stripped)
    return notes


def toml_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def format_toml_list(values: List[str]) -> str:
    if not values:
        return "[]"
    escaped = [f'"{toml_escape(v)}"' for v in values]
    return "[{}]".format(", ".join(escaped))


def convert_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    if text.startswith("+++"):
        return
    parts = text.split("+++", 2)
    if len(parts) < 3:
        return
    _, front_raw, body = parts
    front_lines = front_raw.strip().splitlines()
    data = load_yaml_like_front_matter(front_lines)

    title = data.get("title", path.stem)
    weight = data.get("weight", 1)
    tags = data.get("tags", [])
    if isinstance(tags, str):
        tags = [tags]
    slug = path.parent.name
    servings = data.get("usernum")
    time_total = data.get("time")

    body_lines = body.strip().splitlines()
    sections: List[Tuple[str, List[str]]] = []
    current_heading: str | None = None
    current_lines: List[str] = []

    for line in body_lines:
        if line.startswith("### "):
            if current_heading is not None:
                sections.append((current_heading, current_lines))
            current_heading = line[4:].strip()
            current_lines = []
        else:
            current_lines.append(line)
    if current_heading is not None:
        sections.append((current_heading, current_lines))

    ingredient_groups: List[Dict[str, object]] = []
    step_entries: List[Dict[str, str]] = []
    notes: List[str] = []
    notes_title: str | None = None

    for heading, lines in sections:
        block_text = "\n".join(lines).strip()
        if not block_text:
            continue
        if "{{< item" in block_text:
            ingredient_groups.extend(extract_ingredients(lines, heading))
            continue
        if '<ul class="ministep">' in block_text:
            step_entries.extend(extract_steps(heading, block_text))
            continue
        extracted_notes = extract_notes(block_text)
        if extracted_notes:
            if notes_title is None:
                notes_title = heading
            notes.extend(extracted_notes)

    if not ingredient_groups:
        raise RuntimeError(f"Failed to parse ingredients for {path}")
    if not step_entries:
        raise RuntimeError(f"Failed to parse steps for {path}")

    description = f"{title}のレシピです。"
    featured = "/images/recipes/nukujaga-placeholder.svg"
    tools: List[str] = []

    serves_label = f"{servings}人分" if isinstance(servings, int) else "1人分"
    cook_label = f"{time_total}分" if isinstance(time_total, int) else ""

    recipe_tags = tags[:] if isinstance(tags, list) else []

    lines_out: List[str] = ["+++"]
    lines_out.append(f'title = "{toml_escape(title)}"')
    lines_out.append(f"weight = {weight}")
    lines_out.append(f'slug = "{slug}"')
    lines_out.append(f'description = "{toml_escape(description)}"')
    lines_out.append(f"tags = {format_toml_list(recipe_tags)}")
    lines_out.append(f'featured = "{featured}"')
    lines_out.append(f"tools = {format_toml_list(tools)}")
    lines_out.append("[recipe]")
    lines_out.append(f'  serves = "{toml_escape(serves_label)}"')
    lines_out.append(f'  prep = ""')
    lines_out.append(f'  cook = "{toml_escape(cook_label)}"')
    lines_out.append(f'  rest = ""')
    lines_out.append(f'  difficulty = "★★☆"')
    lines_out.append(f'  inspiration = ""')
    lines_out.append(f"  tags = {format_toml_list(recipe_tags)}")

    for group in ingredient_groups:
        if not group["items"]:
            continue
        lines_out.append("[[ingredients]]")
        group_name = str(group.get("group") or "").strip()
        if group_name:
            lines_out.append(f'  group = "{toml_escape(group_name)}"')
        for item in group["items"]:
            lines_out.append("  [[ingredients.items]]")
            lines_out.append(f'    name = "{toml_escape(item["name"])}"')
            amount = toml_escape(item.get("amount", ""))
            lines_out.append(f'    amount = "{amount}"')
            note = toml_escape(item.get("note", ""))
            if note:
                lines_out.append(f'    note = "{note}"')

    for step in step_entries:
        lines_out.append("[[steps]]")
        lines_out.append(f'  title = "{toml_escape(step["title"])}"')
        lines_out.append(f'  detail = "{toml_escape(step["detail"])}"')
        timer = step.get("timer") or ""
        lines_out.append(f'  timer = "{toml_escape(timer)}"')

    lines_out.append("+++")
    lines_out.append("")
    lines_out.append("{{< recipe-meta >}}")
    lines_out.append("{{< recipe-tools >}}")
    lines_out.append("{{< ingredients >}}")
    lines_out.append("{{< recipe-steps >}}")

    if notes:
        title_value = notes_title or "メモ"
        lines_out.append(f'{{{{< kitchen-notes title="{toml_escape(title_value)}" >}}}}')
        for note in notes:
            lines_out.append(f"- {note}")
        lines_out.append("{{< /kitchen-notes >}}")

    lines_out.append("")
    new_text = "\n".join(lines_out)
    path.write_text(new_text, encoding="utf-8")


def main() -> None:
    targets = [
        p
        for p in CONTENT_ROOT.rglob("index.md")
        if p.is_file() and p.read_text(encoding="utf-8", errors="ignore").startswith("+++")
    ]
    for target in targets:
        convert_file(target)


if __name__ == "__main__":
    main()
