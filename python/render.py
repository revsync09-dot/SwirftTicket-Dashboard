from datetime import datetime

from .components import action_row, button, container, separator, text_display


STATUS_COLOR = {"OPEN": 0x3B82F6, "CLAIMED": 0xFBBF24, "CLOSED": 0x9CA3AF}
STATUS_LABEL = {"OPEN": "Open", "CLAIMED": "Claimed", "CLOSED": "Closed"}


def _fmt_relative(iso: str | None):
    if not iso:
        return "-"
    epoch = int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp())
    return f"<t:{epoch}:R>"


def _pad_id(ticket_id: int, size: int = 6):
    return str(ticket_id).rjust(size, "0")


def _bullet_block(title: str, rows: list[tuple[str, str]]):
    lines = "\n".join([f"- **{k}:** {v}" for k, v in rows])
    return text_display(f"### {title}\n{lines}")


def render_ticket_message(ticket: dict, creator_mention: str, timezone: str, moderation: dict | None, links: list[int], suggestions: list[str]):
    overview = [
        ("Ticket ID", _pad_id(ticket["id"])),
        ("Status", STATUS_LABEL.get(ticket["status"], ticket["status"])),
        ("Category", ticket.get("category_name") or "-"),
        ("Created", _fmt_relative(ticket.get("created_at"))),
    ]
    handling = [
        ("Claimed by", f"<@{ticket['claimed_by']}>" if ticket.get("claimed_by") else "-"),
        ("Claimed", _fmt_relative(ticket.get("claimed_at"))),
        ("Closed by", f"<@{ticket['closed_by']}>" if ticket.get("closed_by") else "-"),
        ("Closed", _fmt_relative(ticket.get("closed_at"))),
        ("Reopened", _fmt_relative(ticket.get("reopened_at"))),
    ]

    components = [
        text_display(f"## Ticket Created {creator_mention}"),
        separator(),
        _bullet_block("Overview", overview),
        separator(),
        text_display(
            "### Priority\n"
            f"- **Level:** {ticket.get('priority', 'NORMAL')}"
            + (f"\n- **Reason:** {ticket.get('suspicion_reason')}" if ticket.get("suspicion_reason") else "")
        ),
    ]

    if ticket.get("category_description"):
        components.extend([separator(), text_display(f"### Category\n{ticket['category_description']}")])

    components.extend([
        separator(),
        text_display("### Description"),
        text_display(ticket.get("query_text") or "-"),
        separator(),
        _bullet_block("Handling", handling),
    ])

    if moderation:
        components.extend([
            separator(),
            text_display(
                "### Moderation"

                f"- Warnings: {moderation['warnings']} | Mutes: {moderation['mutes']} | Bans: {moderation['bans']}"
            ),
        ])

    ])

    if suggestions:
        components.extend([separator(), text_display("### Suggested Replies\n" + "\n".join([f"- {s}" for s in suggestions]))])

    components.extend([
        separator(),
        text_display("### Linked Tickets\n" + ("\n".join([f"- #{_pad_id(i)}" for i in links]) if links else "- None")),
    ])

    buttons = []
    if ticket["status"] == "OPEN":
        buttons.append(button(custom_id=f"ticket:claim:{ticket['id']}", style=3, label="Claim"))
    elif ticket["status"] == "CLAIMED":
        buttons.append(button(custom_id=f"ticket:close:{ticket['id']}", style=4, label="Close"))
        buttons.append(button(custom_id=f"ticket:transcript:{ticket['id']}", style=2, label="Transcript"))
    elif ticket["status"] == "CLOSED":
        buttons.append(button(custom_id=f"ticket:transcript:{ticket['id']}", style=2, label="Transcript"))
        buttons.append(button(custom_id=f"ticket:reopen:{ticket['id']}", style=1, label="Reopen"))

    buttons.append(button(custom_id=f"ticket:link:{ticket['id']}", style=2, label="Link Ticket"))
    components.extend([separator(), action_row(buttons)])

    return {"flags": 1 << 15, "components": [container(components, STATUS_COLOR.get(ticket["status"], 0x7C5CFF))]}
