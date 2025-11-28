#!/usr/bin/env python3
"""
Augment the Filatiev AI workflow with site knowledge fetching/context summary.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

WORKFLOW_ID = "o7Lz9xJb1bn9Fe2w"
DB_PATH = Path.home() / ".n8n" / "database.sqlite"


def load_workflow(conn: sqlite3.Connection) -> tuple[list[dict], dict]:
    row = conn.execute(
        "SELECT nodes, connections FROM workflow_entity WHERE id=?", (WORKFLOW_ID,)
    ).fetchone()
    if not row:
        raise SystemExit("Workflow not found")
    nodes = json.loads(row[0])
    connections = json.loads(row[1])
    return nodes, connections


def save_workflow(conn: sqlite3.Connection, nodes: list[dict], connections: dict) -> None:
    conn.execute(
        "UPDATE workflow_entity SET nodes=?, connections=?, updatedAt=STRFTIME('%Y-%m-%d %H:%M:%f','now') WHERE id=?",
        (json.dumps(nodes, ensure_ascii=False), json.dumps(connections, ensure_ascii=False), WORKFLOW_ID),
    )
    conn.commit()


FETCH_NODE_ID = "c8f60d3b-8888-4fd8-9b1d-knowledge"
CONTEXT_NODE_ID = "2dd6f126-75aa-4b1e-85f1-context123"


def ensure_nodes(nodes: list[dict]) -> None:
    fetch_node = next((n for n in nodes if n["name"] == "Fetch Site Knowledge"), None)
    context_node = next((n for n in nodes if n["name"] == "Build Context Summary"), None)

    fetch_code = (
        "const url = 'https://retro.filatiev.pro:8444/filatiev-ai-content.json';\n"
        "let knowledgeBase = {};\n"
        "try {\n"
        "  knowledgeBase = await this.helpers.httpRequest({ method: 'GET', uri: url, json: true });\n"
        "} catch (error) {\n"
        "  console.error('Не удалось загрузить знания сайта', error.message);\n"
        "}\n"
        "return items.map(item => ({ json: { ...item.json, knowledgeBase } }));"
    )

    context_code = (
        "const data = $json.knowledgeBase || {};\n"
        "const sections = [];\n"
        "if (data.meta) {\n"
        "  const metaBits = [];\n"
        "  if (data.meta.title) metaBits.push(`Название: ${data.meta.title}`);\n"
        "  if (data.meta.description) metaBits.push(`Описание: ${data.meta.description}`);\n"
        "  if (metaBits.length) sections.push('META\\n' + metaBits.join('\\n'));\n"
        "}\n"
        "if (Array.isArray(data.startMenu?.items) && data.startMenu.items.length) {\n"
        "  sections.push('МЕНЮ\\n' + data.startMenu.items.map(i => i.label).join(', '));\n"
        "}\n"
        "if (Array.isArray(data.startMenu?.contacts) && data.startMenu.contacts.length) {\n"
        "  sections.push('КОНТАКТЫ\\n' + data.startMenu.contacts.map(c => `${c.label} — ${c.url}`).join('\\n'));\n"
        "}\n"
        "if (Array.isArray(data.desktopIcons) && data.desktopIcons.length) {\n"
        "  sections.push('РАБОЧИЙ СТОЛ\\n' + data.desktopIcons.map(i => i.label).join(', '));\n"
        "}\n"
        "const windowSummaries = (data.windows || [])\n"
        "  .filter(w => w.title)\n"
        "  .slice(0, 8)\n"
        "  .map(w => `${w.title}: ${(w.content || '').slice(0, 240)}`);\n"
        "if (windowSummaries.length) sections.push('ОКНА\\n' + windowSummaries.join('\\n'));\n"
        "return [{ json: { ...$json, contextSummary: sections.join('\\n\\n') } }];"
    )

    if fetch_node:
        fetch_node["parameters"] = {"functionCode": fetch_code}
        fetch_node["type"] = "n8n-nodes-base.function"
    else:
        nodes.append(
            {
                "parameters": {"functionCode": fetch_code},
                "id": FETCH_NODE_ID,
                "name": "Fetch Site Knowledge",
                "type": "n8n-nodes-base.function",
                "typeVersion": 1,
                "position": [-96, 224],
            }
        )

    if context_node:
        context_node["parameters"]["functionCode"] = context_code
    else:
        nodes.append(
            {
                "parameters": {"functionCode": context_code},
                "id": CONTEXT_NODE_ID,
                "name": "Build Context Summary",
                "type": "n8n-nodes-base.function",
                "typeVersion": 1,
                "position": [-96, 320],
            }
        )

    prompt_expression = (
        "={{ [\n"
        "  $json.contextSummary ? `СПРАВОЧНАЯ ИНФОРМАЦИЯ:\\n${$json.contextSummary}` : '',\n"
        "  (() => {\n"
        "    const history = Array.isArray($json.body?.history) ? $json.body.history : [];\n"
        "    const systemEntry = history.find(m => m.role === 'system');\n"
        "    const dialog = history.filter(m => m.role !== 'system');\n"
        "    const blocks = [];\n"
        "    if (systemEntry?.text) blocks.push(`ИНСТРУКЦИЯ:\\n${systemEntry.text}`);\n"
        "    if (dialog.length) {\n"
        "      blocks.push('ДИАЛОГ:\\n' + dialog.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\\n\\n'));\n"
        "    }\n"
        "    return blocks.join('\\n\\n');\n"
        "  })(),\n"
        "  $json.body?.text ? `ВОПРОС: ${$json.body.text}` : ''\n"
        "].filter(Boolean).join('\\n\\n') }}\n"
    )

    for node in nodes:
        if node["name"] == "Basic LLM Chain":
            node["parameters"]["text"] = prompt_expression
            break


def update_connections(connections: dict) -> None:
    connections["Edit Fields"] = {"main": [[{"node": "Fetch Site Knowledge", "type": "main", "index": 0}]]}
    connections["Fetch Site Knowledge"] = {"main": [[{"node": "Build Context Summary", "type": "main", "index": 0}]]}
    connections["Build Context Summary"] = {"main": [[{"node": "Basic LLM Chain", "type": "main", "index": 0}]]}


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    nodes, connections = load_workflow(conn)
    ensure_nodes(nodes)
    update_connections(connections)
    save_workflow(conn, nodes, connections)
    conn.close()
    print("Workflow updated with knowledge context.")


if __name__ == "__main__":
    main()
